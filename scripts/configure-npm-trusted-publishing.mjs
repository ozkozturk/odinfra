import { spawnSync } from "node:child_process";

const packages = [
  "odinfra",
  "@odinfra/schema",
  "@odinfra/generator",
  "@odinfra/templates",
  "@odinfra/adapter-opencode"
];

const npmCommand = ["npx", "-y", "npm@^11.10.0"];
const trustArgs = [
  "trust",
  "github",
  "--repo",
  "ozkozturk/odinfra",
  "--file",
  "release.yml",
  "--environment",
  "npm",
  "--allow-publish"
];

console.log("Configuring npm Trusted Publishing for GitHub Actions.");
console.log("Provider: GitHub Actions");
console.log("Repository: ozkozturk/odinfra");
console.log("Workflow: .github/workflows/release.yml");
console.log("Environment: npm");
console.log("");

run([...npmCommand, "whoami"], "You must be logged in to npm before configuring trusted publishers.");

console.log("");
console.log("The first package may require npm two-factor authentication.");
console.log("If npm opens a browser page, complete the 2FA challenge and choose the option to skip 2FA for 5 minutes.");
console.log("The remaining packages will then be configured non-interactively.");

for (const [index, packageName] of packages.entries()) {
  console.log(`\nConfiguring ${packageName}...`);
  const automaticFlags = index === 0 ? [] : ["--yes"];
  run(
    [...npmCommand, ...trustArgs, ...automaticFlags, packageName],
    `Failed to configure trusted publishing for ${packageName}.`
  );

  if (index === 0 && packages.length > 1) {
    console.log("\nContinuing with the remaining packages in the npm 2FA skip window...");
  }

  if (index < packages.length - 1) {
    sleep(2000);
  }
}

console.log("\nTrusted Publishing configuration complete.");

function run(command, failureMessage) {
  const [binary, ...args] = command;
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n${failureMessage}`);
    console.error("If this failed with E403 after npm mentioned 2FA, rerun this command in an interactive terminal.");
    console.error("Use npm login --auth-type=web if your current npm session was created with legacy auth.");
    process.exit(result.status ?? 1);
  }
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
