import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface DoctorOptions {
  projectRoot: string;
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export async function runDoctor(options: DoctorOptions): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), options.projectRoot);
  const checks: Check[] = [];

  checks.push(await checkPath(projectRoot, "Project root exists"));
  checks.push(await checkPath(path.join(projectRoot, "AGENTS.md"), "AGENTS.md exists"));
  checks.push(await checkAgentsBlock(projectRoot));
  checks.push(await checkAnyPath(projectRoot, ["opencode.json", "opencode.jsonc"], "OpenCode config exists"));
  checks.push(await checkPath(path.join(projectRoot, ".odinfra/config.json"), ".odinfra/config.json exists"));
  checks.push(await checkPath(path.join(projectRoot, ".odinfra/manifest.json"), ".odinfra/manifest.json exists"));
  checks.push(await checkAgentFiles(projectRoot));

  for (const check of checks) {
    console.log(`${check.ok ? "[OK]" : "[WARN]"} ${check.label} - ${check.detail}`);
  }

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}

async function checkPath(filePath: string, label: string): Promise<Check> {
  try {
    await access(filePath);
    return { label, ok: true, detail: filePath };
  } catch {
    return { label, ok: false, detail: "missing" };
  }
}

async function checkAnyPath(projectRoot: string, relativePaths: string[], label: string): Promise<Check> {
  for (const relativePath of relativePaths) {
    try {
      await access(path.join(projectRoot, relativePath));
      return { label, ok: true, detail: relativePath };
    } catch {
      // Continue checking alternatives.
    }
  }
  return { label, ok: false, detail: `missing one of: ${relativePaths.join(", ")}` };
}

async function checkAgentsBlock(projectRoot: string): Promise<Check> {
  try {
    const content = await readFile(path.join(projectRoot, "AGENTS.md"), "utf8");
    const ok = content.includes("<!-- odinfra:start subagent-management -->") && content.includes("<!-- odinfra:end subagent-management -->");
    return { label: "Odinfra managed block exists", ok, detail: ok ? "found" : "missing" };
  } catch {
    return { label: "Odinfra managed block exists", ok: false, detail: "AGENTS.md missing" };
  }
}

async function checkAgentFiles(projectRoot: string): Promise<Check> {
  try {
    const files = await readdir(path.join(projectRoot, ".opencode/agents"));
    const markdownFiles = files.filter((file) => file.endsWith(".md"));
    return {
      label: ".opencode/agents contains markdown agents",
      ok: markdownFiles.length > 0,
      detail: markdownFiles.length > 0 ? `${markdownFiles.length} file(s)` : "no markdown agent files"
    };
  } catch {
    return { label: ".opencode/agents contains markdown agents", ok: false, detail: "missing" };
  }
}
