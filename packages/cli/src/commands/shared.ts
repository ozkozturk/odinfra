import { readFile } from "node:fs/promises";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { filterFilePlan, formatFilePlan, writeFilePlan, type FilePlan } from "@odinfra/generator";
import { odinfraConfigSchema, odinfraManifestSchema, type OdinfraConfig, type OdinfraManifest } from "@odinfra/schema";

export interface PlanCommandOptions {
  projectRoot: string;
  dryRun: boolean;
  yes: boolean;
  json: boolean;
  include?: string;
  exclude?: string;
}

export function resolveProjectRoot(projectRoot: string): string {
  return path.resolve(process.cwd(), projectRoot);
}

export async function readRequiredConfig(projectRoot: string): Promise<OdinfraConfig> {
  const filePath = path.join(projectRoot, ".odinfra/config.json");
  const raw = await readJsonFile(filePath, ".odinfra/config.json");
  const parsed = odinfraConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(".odinfra/config.json exists but is invalid. Run `odinfra init` again or fix the config first.");
  }
  return parsed.data;
}

export async function readOptionalManifest(projectRoot: string): Promise<OdinfraManifest | undefined> {
  const filePath = path.join(projectRoot, ".odinfra/manifest.json");
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const parsed = odinfraManifestSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export function manifestIncludesCommands(manifest: OdinfraManifest | undefined): boolean {
  return manifest?.managedFiles.some((file) => file.startsWith(".opencode/commands/")) ?? false;
}

export async function outputAndMaybeWritePlan(
  projectRoot: string,
  plan: FilePlan,
  options: PlanCommandOptions
): Promise<void> {
  const filteredPlan = filterFilePlan(plan, {
    include: parsePatternList(options.include),
    exclude: parsePatternList(options.exclude)
  });
  const style = options.json ? "json" : "detailed";
  console.log(formatFilePlan(filteredPlan, { style }));

  if (options.dryRun) {
    if (!options.json) {
      console.log("Dry run enabled; no files were written.");
    }
    return;
  }

  const shouldWrite = options.yes ? true : await confirm({ message: "Write these files?", default: false });
  if (!shouldWrite) {
    if (!options.json) {
      console.log("No files were written.");
    }
    return;
  }

  await writeFilePlan(projectRoot, filteredPlan, { includeConfirmationRequired: true });
  if (!options.json) {
    console.log("Odinfra files written.");
  }
}

export function parsePatternList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJsonFile(filePath: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`${label} was not found. Run \`odinfra init\` first.`, { cause: error });
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
