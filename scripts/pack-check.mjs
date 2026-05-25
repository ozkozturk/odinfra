import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  { name: "odinfra", directory: "packages/cli", kind: "cli" },
  { name: "@odinfra/schema", directory: "packages/schema", kind: "library" },
  { name: "@odinfra/generator", directory: "packages/generator", kind: "library" },
  { name: "@odinfra/templates", directory: "packages/templates", kind: "library" },
  { name: "@odinfra/adapter-opencode", directory: "packages/adapter-opencode", kind: "library" }
];

const tempDirectory = mkdtempSync(path.join(tmpdir(), "odinfra-pack-check-"));
const packedTarballs = new Map();

try {
  for (const packageInfo of packages) {
    await checkPackage(packageInfo);
  }

  checkCliSmoke();
  checkLibraryImportSmoke();
  console.log("Pack checks passed.");
} finally {
  rmSync(tempDirectory, { force: true, recursive: true });
}

async function checkPackage(packageInfo) {
  const packageDirectory = path.join(root, packageInfo.directory);
  const packed = run("pnpm", ["pack", "--pack-destination", tempDirectory, "--json"], { cwd: packageDirectory });
  const packResult = JSON.parse(packed.stdout);
  const tarball = Array.isArray(packResult) ? packResult[0]?.filename : packResult.filename;
  if (!tarball) {
    throw new Error(`pnpm pack did not return a tarball for ${packageInfo.name}`);
  }
  packedTarballs.set(packageInfo.name, tarball);

  const files = new Set(run("tar", ["-tf", tarball]).stdout.trim().split("\n"));
  const manifest = JSON.parse(run("tar", ["-xO", "-f", tarball, "package/package.json"]).stdout);

  assert(manifest.name === packageInfo.name, `${packageInfo.name}: packed manifest has the wrong name`);
  assert(manifest.description, `${packageInfo.name}: missing description`);
  assert(Array.isArray(manifest.keywords) && manifest.keywords.length > 0, `${packageInfo.name}: missing keywords`);
  assert(manifest.license === "MIT", `${packageInfo.name}: missing MIT license metadata`);
  assert(manifest.repository?.url?.startsWith("git+https://"), `${packageInfo.name}: repository URL must use HTTPS`);
  assert(manifest.publishConfig?.access === "public", `${packageInfo.name}: publishConfig.access must be public`);
  assert(manifest.engines?.node === ">=20", `${packageInfo.name}: engines.node must stay at >=20`);

  assertHas(files, "package/package.json", packageInfo.name);
  assertHas(files, "package/README.md", packageInfo.name);
  assertHas(files, "package/LICENSE", packageInfo.name);
  assertHas(files, "package/dist/index.js", packageInfo.name);

  assertNoWorkspaceDependencies(manifest, packageInfo.name);
  assertNoSrcExport(manifest.exports, packageInfo.name);

  if (packageInfo.kind === "library") {
    assert(manifest.types === "./dist/index.d.ts", `${packageInfo.name}: missing top-level types`);
    assert(manifest.sideEffects === false, `${packageInfo.name}: libraries must declare sideEffects false`);
    assertHas(files, "package/dist/index.d.ts", packageInfo.name);
  } else {
    assert(!("exports" in manifest), `${packageInfo.name}: CLI package should not expose import exports`);
    assert(!("types" in manifest), `${packageInfo.name}: CLI package should not publish meaningless types`);
    assert(!files.has("package/dist/index.d.ts"), `${packageInfo.name}: CLI package should not include type stubs`);
    assert(manifest.bin?.odinfra === "./dist/index.js", `${packageInfo.name}: missing odinfra binary`);
  }
}

function checkCliSmoke() {
  const cliEntry = path.join(root, "packages/cli/dist/index.js");
  const cliManifest = JSON.parse(
    run("tar", ["-xO", "-f", packedTarballs.get("odinfra"), "package/package.json"]).stdout
  );
  const help = run(process.execPath, [cliEntry, "--help"]);
  assert(help.stdout.includes("Usage: odinfra"), "CLI help output is missing usage text");

  const version = run(process.execPath, [cliEntry, "--version"]);
  assert(version.stdout.trim() === cliManifest.version, "CLI --version must match package.json");

  const dryRunProject = path.join(tempDirectory, "dry-run-project");
  const dryRun = run(process.execPath, [
    cliEntry,
    "init",
    "--dry-run",
    "--yes",
    "--commands",
    "--project-root",
    dryRunProject
  ]);
  assert(dryRun.stdout.includes("Dry run enabled; no files were written."), "CLI init dry-run smoke failed");

  const doctor = run(
    process.execPath,
    [cliEntry, "doctor", "--project-root", path.join(tempDirectory, "missing-project")],
    {
      expectedStatus: 1
    }
  );
  assert(doctor.stdout.includes("[WARN] Project root exists"), "CLI doctor smoke failed");
}

function checkLibraryImportSmoke() {
  for (const packageInfo of packages.filter((item) => item.kind === "library")) {
    const script = `const module = await import(${JSON.stringify(packageInfo.name)});
if (Object.keys(module).length === 0) {
  throw new Error("empty module");
}`;
    run(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: path.join(root, packageInfo.directory)
    });
  }
}

function assertHas(files, file, packageName) {
  assert(files.has(file), `${packageName}: packed tarball is missing ${file}`);
}

function assertNoWorkspaceDependencies(manifest, packageName) {
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      assert(!String(version).startsWith("workspace:"), `${packageName}: ${field}.${name} still uses workspace:`);
    }
  }
}

function assertNoSrcExport(exportsValue, packageName) {
  const serialized = JSON.stringify(exportsValue ?? {});
  assert(!serialized.includes("./src/"), `${packageName}: package exports must not point at unpublished src files`);
  assert(
    !serialized.includes('"development"'),
    `${packageName}: package exports must not include development conditions`
  );
}

function run(command, args, options = {}) {
  const expected = Array.isArray(options.expectedStatus) ? options.expectedStatus : [options.expectedStatus ?? 0];
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8"
  });

  if (!expected.includes(result.status ?? 1)) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `status: ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
