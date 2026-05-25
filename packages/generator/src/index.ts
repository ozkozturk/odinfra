import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import {
  getPermissionForRole,
  ODINFRA_SCHEMA_VERSION,
  odinfraAgentConfigSchema,
  type OdinfraAgentConfig,
  type OdinfraConfig,
  type OdinfraManifest,
  type TargetTool
} from "@odinfra/schema";

export const SUBAGENT_BLOCK = {
  file: "AGENTS.md",
  name: "subagent-management",
  start: "<!-- odinfra:start subagent-management -->",
  end: "<!-- odinfra:end subagent-management -->"
} as const;

export type FilePlanAction = "create" | "update" | "unchanged" | "skip";

export interface FilePlanItem {
  path: string;
  action: FilePlanAction;
  content?: string;
  reason?: string;
}

export interface FilePlan {
  items: FilePlanItem[];
  warnings: string[];
  config: OdinfraConfig;
  manifest: OdinfraManifest;
}

export interface CreateFilePlanOptions {
  projectRoot: string;
  targetTool?: TargetTool;
  agents: OdinfraAgentConfig[];
  includeCommands?: boolean;
  generatedAt?: Date;
  existingFiles?: Record<string, string | undefined>;
}

export async function createFilePlan(options: CreateFilePlanOptions): Promise<FilePlan> {
  const targetTool = options.targetTool ?? "opencode";
  if (targetTool !== "opencode") {
    throw new Error(`Unsupported target tool for v0: ${targetTool}`);
  }

  const agents = normalizeAgents(options.agents);
  const artifacts = renderOpenCodeArtifacts({ agents, includeCommands: options.includeCommands ?? false });
  const warnings: string[] = [];
  const items: FilePlanItem[] = [];
  const readExisting = createReader(options.projectRoot, options.existingFiles);

  const agentsPath = "AGENTS.md";
  const existingAgents = await readExisting(agentsPath);
  addContentItem(items, agentsPath, existingAgents, upsertManagedBlock(existingAgents, artifacts.agentsBlock));

  const existingJson = await readExisting("opencode.json");
  const existingJsonc = await readExisting("opencode.jsonc");
  if (existingJson !== undefined && existingJsonc !== undefined) {
    warnings.push(
      "Both opencode.json and opencode.jsonc exist; using opencode.json and leaving opencode.jsonc untouched."
    );
  }

  const opencodeConfigPath =
    existingJson !== undefined ? "opencode.json" : existingJsonc !== undefined ? "opencode.jsonc" : "opencode.json";
  const existingOpenCodeConfig = opencodeConfigPath === "opencode.json" ? existingJson : existingJsonc;
  try {
    const mergedConfig = mergeOpenCodeConfig(
      existingOpenCodeConfig,
      artifacts.opencodeConfigPatch,
      opencodeConfigPath.endsWith(".jsonc")
    );
    addContentItem(items, opencodeConfigPath, existingOpenCodeConfig, mergedConfig);
  } catch (error) {
    items.push({
      path: opencodeConfigPath,
      action: "skip",
      reason: error instanceof Error ? error.message : String(error)
    });
    warnings.push(`Skipped ${opencodeConfigPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const artifact of [...artifacts.agentFiles, ...artifacts.commandFiles]) {
    const existing = await readExisting(artifact.path);
    addContentItem(items, artifact.path, existing, artifact.content);
  }

  const managedFiles = unique([
    agentsPath,
    opencodeConfigPath,
    ...artifacts.agentFiles.map((artifact) => artifact.path),
    ...artifacts.commandFiles.map((artifact) => artifact.path),
    ".odinfra/config.json",
    ".odinfra/manifest.json"
  ]);

  const config: OdinfraConfig = {
    version: ODINFRA_SCHEMA_VERSION,
    target: {
      tool: targetTool,
      projectRoot: options.projectRoot
    },
    agents
  };

  const manifest: OdinfraManifest = {
    version: ODINFRA_SCHEMA_VERSION,
    createdBy: "odinfra",
    targetTool,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    managedFiles,
    managedBlocks: [SUBAGENT_BLOCK]
  };

  addContentItem(
    items,
    ".odinfra/config.json",
    await readExisting(".odinfra/config.json"),
    `${JSON.stringify(config, null, 2)}\n`
  );
  addContentItem(
    items,
    ".odinfra/manifest.json",
    await readExisting(".odinfra/manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  return { items, warnings, config, manifest };
}

export async function writeFilePlan(projectRoot: string, plan: FilePlan): Promise<void> {
  for (const item of plan.items) {
    if ((item.action !== "create" && item.action !== "update") || item.content === undefined) {
      continue;
    }

    const absolutePath = path.resolve(projectRoot, item.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, item.content, "utf8");
  }
}

export function formatFilePlan(plan: FilePlan): string {
  const lines = ["File plan:"];
  for (const item of plan.items) {
    const suffix = item.reason ? ` - ${item.reason}` : "";
    lines.push(`- ${item.action.padEnd(9)} ${item.path}${suffix}`);
  }

  if (plan.warnings.length) {
    lines.push("", "Warnings:");
    for (const warning of plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

export function upsertManagedBlock(existingContent: string | undefined, generatedContent: string): string {
  const block = renderManagedBlock(generatedContent);
  if (!existingContent || !existingContent.trim()) {
    return [
      "# Project Agents",
      "",
      "This project uses Odinfra to manage tool-specific subagent configuration.",
      "",
      block,
      ""
    ].join("\n");
  }

  const startIndex = existingContent.indexOf(SUBAGENT_BLOCK.start);
  const endIndex = existingContent.indexOf(SUBAGENT_BLOCK.end);
  if (startIndex >= 0 && endIndex > startIndex) {
    const before = existingContent.slice(0, startIndex + SUBAGENT_BLOCK.start.length);
    const after = existingContent.slice(endIndex);
    return ensureTrailingNewline(`${before}\n\n${generatedContent.trim()}\n\n${after}`);
  }

  return ensureTrailingNewline(`${existingContent.trimEnd()}\n\n${block}\n`);
}

export function renderManagedBlock(generatedContent: string): string {
  return ["## Subagent Management", "", SUBAGENT_BLOCK.start, "", generatedContent.trim(), "", SUBAGENT_BLOCK.end].join(
    "\n"
  );
}

export function mergeOpenCodeConfig(
  existingContent: string | undefined,
  patch: Record<string, unknown>,
  jsonc: boolean
): string {
  if (!existingContent || !existingContent.trim()) {
    return `${JSON.stringify(patch, null, 2)}\n`;
  }

  if (!jsonc) {
    const existing = JSON.parse(existingContent) as unknown;
    assertPlainObject(existing, "opencode.json must contain a JSON object");
    return `${JSON.stringify(deepMerge(existing, patch), null, 2)}\n`;
  }

  const errors: ParseError[] = [];
  const parsed = parse(existingContent, errors, { allowTrailingComma: true, disallowComments: false }) as unknown;
  if (errors.length) {
    throw new Error("opencode.jsonc contains parse errors; leaving it untouched");
  }
  assertPlainObject(parsed, "opencode.jsonc must contain a JSON object");

  const merged = deepMerge(parsed, patch) as Record<string, unknown>;
  let next = existingContent;
  for (const key of Object.keys(patch)) {
    const edits = modify(next, [key], merged[key], {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" }
    });
    next = applyEdits(next, edits);
  }

  return ensureTrailingNewline(next);
}

export function deepMerge(existing: unknown, patch: unknown): unknown {
  if (Array.isArray(existing) && Array.isArray(patch)) {
    return unique([...existing, ...patch]);
  }

  if (!isPlainObject(existing) || !isPlainObject(patch)) {
    return patch;
  }

  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (key in merged) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function normalizeAgents(agents: OdinfraAgentConfig[]): OdinfraAgentConfig[] {
  const selectedIds = agents.map((agent) => agent.id);
  return agents.map((agent) => {
    const parsed = odinfraAgentConfigSchema.parse(agent);
    return {
      ...parsed,
      permission: parsed.permission ?? getPermissionForRole(parsed.permissionPreset, selectedIds)
    };
  });
}

function addContentItem(
  items: FilePlanItem[],
  relativePath: string,
  existingContent: string | undefined,
  nextContent: string
): void {
  const action: FilePlanAction =
    existingContent === undefined ? "create" : existingContent === nextContent ? "unchanged" : "update";
  items.push({ path: relativePath, action, content: nextContent });
}

function createReader(projectRoot: string, existingFiles?: Record<string, string | undefined>) {
  return async (relativePath: string): Promise<string | undefined> => {
    if (existingFiles && Object.prototype.hasOwnProperty.call(existingFiles, relativePath)) {
      return existingFiles[relativePath];
    }

    try {
      return await readFile(path.resolve(projectRoot, relativePath), "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  };
}

function assertPlainObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(message);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
