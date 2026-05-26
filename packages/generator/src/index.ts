import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import {
  getPermissionForRole,
  ODINFRA_SCHEMA_VERSION,
  odinfraAgentConfigSchema,
  odinfraManifestSchema,
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

export const ODINFRA_TEMPLATE_VERSION = ODINFRA_SCHEMA_VERSION;

export type FilePlanAction =
  | "create"
  | "update"
  | "unchanged"
  | "skip"
  | "conflict"
  | "needs-confirmation"
  | "user-modified";

export interface FilePlanItem {
  path: string;
  action: FilePlanAction;
  content?: string;
  reason?: string;
  contentHash?: string;
  previousHash?: string;
  userModified?: boolean;
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
  packageVersion?: string;
  previousManifest?: OdinfraManifest;
  requireConfirmation?: boolean;
}

export interface WriteFilePlanOptions {
  includeConfirmationRequired?: boolean;
}

export interface FormatFilePlanOptions {
  style?: "summary" | "detailed" | "json";
}

export interface FilePlanFilters {
  include?: string[];
  exclude?: string[];
}

interface GeneratedFileRecord {
  path: string;
  content: string;
  userModified: boolean;
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
  const generatedFileRecords: GeneratedFileRecord[] = [];
  const readExisting = createReader(options.projectRoot, options.existingFiles);
  const existingManifestContent = await readExisting(".odinfra/manifest.json");
  const previousManifest =
    options.previousManifest ?? parseExistingManifest(existingManifestContent, warnings, ".odinfra/manifest.json");
  const packageVersion = options.packageVersion ?? "0.0.0";

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
    const reason = error instanceof Error ? error.message : String(error);
    items.push({
      path: opencodeConfigPath,
      action: "conflict",
      reason
    });
    warnings.push(`Skipped ${opencodeConfigPath}: ${reason}`);
  }

  for (const artifact of [artifacts.roleSystemFile, ...artifacts.agentFiles, ...artifacts.commandFiles]) {
    const existing = await readExisting(artifact.path);
    addGeneratedFileItem(
      items,
      generatedFileRecords,
      artifact.path,
      existing,
      artifact.content,
      previousManifest,
      options.requireConfirmation ?? false
    );
  }

  const managedFiles = unique([
    agentsPath,
    opencodeConfigPath,
    artifacts.roleSystemFile.path,
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

  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  addGeneratedFileItem(
    items,
    generatedFileRecords,
    ".odinfra/config.json",
    await readExisting(".odinfra/config.json"),
    configContent,
    previousManifest,
    options.requireConfirmation ?? false
  );

  const manifest: OdinfraManifest = {
    version: ODINFRA_SCHEMA_VERSION,
    createdBy: "odinfra",
    targetTool,
    generatedAt: selectGeneratedAt(options.generatedAt, previousManifest, items),
    packageVersion,
    managedFiles,
    managedBlocks: [SUBAGENT_BLOCK],
    generatedFiles: generatedFileRecords.map((file) => ({
      path: file.path,
      contentHash: hashContent(file.content),
      templateVersion: ODINFRA_TEMPLATE_VERSION,
      lastAppliedPackageVersion: packageVersion,
      userModified: file.userModified
    }))
  };

  addContentItem(items, ".odinfra/manifest.json", existingManifestContent, `${JSON.stringify(manifest, null, 2)}\n`);

  return { items, warnings, config, manifest };
}

export async function writeFilePlan(
  projectRoot: string,
  plan: FilePlan,
  options: WriteFilePlanOptions = {}
): Promise<void> {
  for (const item of plan.items) {
    const isWritable =
      item.action === "create" ||
      item.action === "update" ||
      (item.action === "needs-confirmation" && options.includeConfirmationRequired === true);
    if (!isWritable || item.content === undefined) {
      continue;
    }

    const absolutePath = path.resolve(projectRoot, item.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, item.content, "utf8");
  }
}

export function formatFilePlan(plan: FilePlan, options: FormatFilePlanOptions = {}): string {
  if (options.style === "json") {
    return `${JSON.stringify(plan, null, 2)}\n`;
  }

  const actionWidth = Math.max(9, ...plan.items.map((item) => item.action.length));
  const lines = ["File plan:"];
  for (const item of plan.items) {
    const suffix = item.reason && options.style !== "detailed" ? ` - ${item.reason}` : "";
    lines.push(`- ${item.action.padEnd(actionWidth)} ${item.path}${suffix}`);
    if (options.style === "detailed") {
      if (item.reason) lines.push(`  reason: ${item.reason}`);
      if (item.contentHash) lines.push(`  contentHash: ${item.contentHash}`);
      if (item.previousHash) lines.push(`  previousHash: ${item.previousHash}`);
      if (item.userModified) lines.push("  userModified: true");
    }
  }

  if (plan.warnings.length) {
    lines.push("", "Warnings:");
    for (const warning of plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

export function filterFilePlan(plan: FilePlan, filters: FilePlanFilters): FilePlan {
  const include = filters.include?.filter(Boolean) ?? [];
  const exclude = filters.exclude?.filter(Boolean) ?? [];

  return {
    ...plan,
    items: plan.items.filter((item) => {
      const included = include.length === 0 || matchesAnyPattern(item.path, include);
      const excluded = exclude.length > 0 && matchesAnyPattern(item.path, exclude);
      return included && !excluded;
    })
  };
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

export type PackageManagerName = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

export interface PackageManagerCommands {
  install: string;
  runScript: string;
  executeOdinfra: string;
  updateOdinfra: string;
}

export interface PackageManagerDetection {
  name: PackageManagerName;
  source: string;
  packageManager?: string;
  lockfiles: string[];
  warnings: string[];
  commands: PackageManagerCommands;
}

export interface ProjectProfile {
  projectRoot: string;
  packageManager: PackageManagerDetection;
  monorepo: {
    detected: boolean;
    signals: string[];
  };
  frameworks: string[];
  docs: string[];
  ruleFiles: string[];
  workflowFiles: string[];
  skillDirs: string[];
  toolFiles: string[];
  agentFiles: string[];
  suggestedScopes: string[];
  warnings: string[];
}

export async function detectPackageManager(
  projectRoot: string,
  existingFiles?: Record<string, string | undefined>
): Promise<PackageManagerDetection> {
  const readExisting = createReader(projectRoot, existingFiles);
  const warnings: string[] = [];
  const packageJsonContent = await readExisting("package.json");
  const packageJson = parseJsonObject(packageJsonContent, "package.json", warnings);
  const packageManager = typeof packageJson?.packageManager === "string" ? packageJson.packageManager : undefined;
  const packageManagerName = packageManager ? packageManager.split("@")[0] : undefined;
  const lockfiles = await detectLockfiles(projectRoot, existingFiles);

  let name = normalizePackageManagerName(packageManagerName);
  let source = packageManager ? `packageManager:${packageManager}` : "fallback:npm";

  if (packageManagerName && name === "unknown") {
    warnings.push(`Unsupported packageManager value "${packageManager}". Falling back to npm command recommendations.`);
  }

  if (name === "unknown" && lockfiles.length === 1) {
    name = lockfiles[0].manager;
    source = `lockfile:${lockfiles[0].file}`;
  }

  if (name === "unknown" && lockfiles.length > 1) {
    warnings.push(
      `Multiple lockfiles found (${lockfiles.map((lockfile) => lockfile.file).join(", ")}); defaulting to npm.`
    );
  }

  if (packageManager && lockfiles.length > 0) {
    const conflicting = lockfiles.filter((lockfile) => lockfile.manager !== name);
    if (conflicting.length > 0) {
      warnings.push(
        `packageManager is ${packageManager}, but also found ${conflicting
          .map((lockfile) => lockfile.file)
          .join(", ")}.`
      );
    }
  }

  return {
    name,
    source,
    packageManager,
    lockfiles: lockfiles.map((lockfile) => lockfile.file),
    warnings,
    commands: packageManagerCommands(name)
  };
}

export async function analyzeProject(
  projectRoot: string,
  existingFiles?: Record<string, string | undefined>
): Promise<ProjectProfile> {
  const readExisting = createReader(projectRoot, existingFiles);
  const packageManager = await detectPackageManager(projectRoot, existingFiles);
  const packageJsonContent = await readExisting("package.json");
  const warnings = [...packageManager.warnings];
  const packageJson = parseJsonObject(packageJsonContent, "package.json", warnings);
  const dependencies = collectDependencies(packageJson);
  const monorepoSignals = await detectMonorepoSignals(projectRoot, packageJson, existingFiles);

  const docs = await detectExistingPaths(projectRoot, existingFiles, ["README.md", "docs", "docs/README.md"]);
  const ruleFiles = await detectExistingPaths(projectRoot, existingFiles, [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules",
    ".github/copilot-instructions.md"
  ]);
  const workflowFiles = await detectExistingPaths(projectRoot, existingFiles, [
    ".github/workflows",
    "workflows",
    ".windsurfrules"
  ]);
  const skillDirs = await detectExistingPaths(projectRoot, existingFiles, [
    "skills",
    ".codex/skills",
    ".agents/skills"
  ]);
  const toolFiles = await detectExistingPaths(projectRoot, existingFiles, [
    "opencode.json",
    "opencode.jsonc",
    ".opencode",
    ".odinfra/config.json"
  ]);
  const agentFiles = await detectExistingPaths(projectRoot, existingFiles, [
    "AGENTS.md",
    "CLAUDE.md",
    ".opencode/agents",
    ".agents"
  ]);

  return {
    projectRoot,
    packageManager,
    monorepo: {
      detected: monorepoSignals.length > 0,
      signals: monorepoSignals
    },
    frameworks: detectFrameworks(dependencies),
    docs,
    ruleFiles,
    workflowFiles,
    skillDirs,
    toolFiles,
    agentFiles,
    suggestedScopes: await suggestScopes(projectRoot, existingFiles),
    warnings
  };
}

export function formatAdoptReport(profile: ProjectProfile): string {
  const lines = [
    "Odinfra adopt analysis",
    "",
    "Project profile:",
    `- Package manager: ${profile.packageManager.name} (${profile.packageManager.source})`,
    `- Monorepo: ${profile.monorepo.detected ? "yes" : "no"}`,
    `- Frameworks: ${formatList(profile.frameworks)}`,
    `- Docs: ${formatList(profile.docs)}`,
    `- Rule files: ${formatList(profile.ruleFiles)}`,
    `- Workflows: ${formatList(profile.workflowFiles)}`,
    `- Skills: ${formatList(profile.skillDirs)}`,
    `- Existing agent/tool files: ${formatList(unique([...profile.agentFiles, ...profile.toolFiles]))}`,
    "",
    "Suggested Odinfra scopes:",
    ...formatBullets(profile.suggestedScopes),
    "",
    "Proposed adoption tasks:",
    "- Review existing project rules before adding Odinfra-managed blocks.",
    "- Keep user-owned agent instructions intact and place Odinfra changes inside managed boundaries.",
    "- Map frontend, backend, docs, test, security, and infrastructure agents only to scopes that exist in this project.",
    "- Run `odinfra init --dry-run` or `odinfra update --dry-run` before writing any generated files.",
    "",
    "LLM prompt:",
    "```text",
    renderAdoptPrompt(profile),
    "```"
  ];

  if (profile.warnings.length) {
    lines.splice(2, 0, "Warnings:", ...formatBullets(profile.warnings), "");
  }

  return lines.join("\n");
}

function renderAdoptPrompt(profile: ProjectProfile): string {
  return [
    "You are helping adopt Odinfra into an existing project.",
    "Preserve all user-owned files, rules, workflows, skills, and agent instructions.",
    "Only propose changes inside Odinfra-managed blocks or generated files after explicit user approval.",
    `Package manager: ${profile.packageManager.name}. Recommended CLI command: ${profile.packageManager.commands.executeOdinfra}.`,
    `Monorepo signals: ${formatList(profile.monorepo.signals)}.`,
    `Framework signals: ${formatList(profile.frameworks)}.`,
    `Existing rule files: ${formatList(profile.ruleFiles)}.`,
    `Existing tool/agent files: ${formatList(unique([...profile.agentFiles, ...profile.toolFiles]))}.`,
    `Suggested scopes: ${formatList(profile.suggestedScopes)}.`,
    "Produce a scoped integration plan for Odinfra-managed OpenCode subagents without overwriting existing project logic."
  ].join("\n");
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

function addGeneratedFileItem(
  items: FilePlanItem[],
  generatedFileRecords: GeneratedFileRecord[],
  relativePath: string,
  existingContent: string | undefined,
  nextContent: string,
  previousManifest: OdinfraManifest | undefined,
  requireConfirmation: boolean
): void {
  const previousFile = previousManifest?.generatedFiles?.find((file) => file.path === relativePath);
  const contentHash = hashContent(nextContent);
  const currentHash = existingContent === undefined ? undefined : hashContent(existingContent);
  const userModified =
    existingContent !== undefined &&
    existingContent !== nextContent &&
    previousFile !== undefined &&
    currentHash !== previousFile.contentHash;
  const action: FilePlanAction =
    existingContent === undefined
      ? "create"
      : existingContent === nextContent
        ? "unchanged"
        : userModified
          ? "user-modified"
          : requireConfirmation
            ? "needs-confirmation"
            : "update";
  const reason =
    action === "user-modified"
      ? "Existing content differs from the last Odinfra-managed hash; review before overwriting."
      : action === "needs-confirmation"
        ? "Generated content changed and requires confirmation before writing."
        : undefined;

  items.push({
    path: relativePath,
    action,
    content: nextContent,
    reason,
    contentHash,
    previousHash: previousFile?.contentHash,
    userModified
  });
  generatedFileRecords.push({ path: relativePath, content: nextContent, userModified });
}

function selectGeneratedAt(
  generatedAt: Date | undefined,
  previousManifest: OdinfraManifest | undefined,
  items: FilePlanItem[]
): string {
  if (generatedAt) {
    return generatedAt.toISOString();
  }

  if (previousManifest && items.every((item) => item.action === "unchanged")) {
    return previousManifest.generatedAt;
  }

  return new Date().toISOString();
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

function parseExistingManifest(
  content: string | undefined,
  warnings: string[],
  relativePath: string
): OdinfraManifest | undefined {
  if (!content?.trim()) {
    return undefined;
  }

  try {
    const parsed = odinfraManifestSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsed.success) {
      warnings.push(`${relativePath} exists but does not match the current Odinfra manifest schema.`);
      return undefined;
    }
    return parsed.data;
  } catch {
    warnings.push(`${relativePath} exists but is not valid JSON.`);
    return undefined;
  }
}

function parseJsonObject(
  content: string | undefined,
  relativePath: string,
  warnings: string[]
): Record<string, unknown> | undefined {
  if (!content?.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isPlainObject(parsed)) {
      warnings.push(`${relativePath} must contain a JSON object.`);
      return undefined;
    }
    return parsed;
  } catch {
    warnings.push(`${relativePath} contains invalid JSON.`);
    return undefined;
  }
}

async function detectLockfiles(
  projectRoot: string,
  existingFiles?: Record<string, string | undefined>
): Promise<{ file: string; manager: Exclude<PackageManagerName, "unknown"> }[]> {
  const candidates = [
    { file: "pnpm-lock.yaml", manager: "pnpm" as const },
    { file: "package-lock.json", manager: "npm" as const },
    { file: "npm-shrinkwrap.json", manager: "npm" as const },
    { file: "yarn.lock", manager: "yarn" as const },
    { file: "bun.lock", manager: "bun" as const },
    { file: "bun.lockb", manager: "bun" as const }
  ];
  const found = [] as { file: string; manager: Exclude<PackageManagerName, "unknown"> }[];
  for (const candidate of candidates) {
    if (await pathExists(projectRoot, candidate.file, existingFiles)) {
      found.push(candidate);
    }
  }
  return found;
}

function normalizePackageManagerName(value: string | undefined): PackageManagerName {
  if (value === "pnpm" || value === "npm" || value === "yarn" || value === "bun") {
    return value;
  }
  return "unknown";
}

function packageManagerCommands(name: PackageManagerName): PackageManagerCommands {
  switch (name) {
    case "pnpm":
      return {
        install: "pnpm install",
        runScript: "pnpm",
        executeOdinfra: "pnpm dlx odinfra",
        updateOdinfra: "pnpm update odinfra"
      };
    case "yarn":
      return {
        install: "yarn install",
        runScript: "yarn",
        executeOdinfra: "yarn dlx odinfra",
        updateOdinfra: "yarn up odinfra"
      };
    case "bun":
      return {
        install: "bun install",
        runScript: "bun run",
        executeOdinfra: "bunx odinfra",
        updateOdinfra: "bun update odinfra"
      };
    case "npm":
    case "unknown":
      return {
        install: "npm install",
        runScript: "npm run",
        executeOdinfra: "npx odinfra",
        updateOdinfra: "npm update odinfra"
      };
  }
}

function collectDependencies(packageJson: Record<string, unknown> | undefined): Set<string> {
  const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const dependencies = new Set<string>();
  for (const field of dependencyFields) {
    const value = packageJson?.[field];
    if (!isPlainObject(value)) {
      continue;
    }
    for (const name of Object.keys(value)) {
      dependencies.add(name);
    }
  }
  return dependencies;
}

function detectFrameworks(dependencies: Set<string>): string[] {
  const frameworkSignals = [
    ["next", "Next.js"],
    ["react", "React"],
    ["vite", "Vite"],
    ["vue", "Vue"],
    ["nuxt", "Nuxt"],
    ["svelte", "Svelte"],
    ["@sveltejs/kit", "SvelteKit"],
    ["astro", "Astro"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["@nestjs/core", "NestJS"],
    ["remix", "Remix"]
  ] as const;
  return frameworkSignals.filter(([dependency]) => dependencies.has(dependency)).map(([, label]) => label);
}

async function detectMonorepoSignals(
  projectRoot: string,
  packageJson: Record<string, unknown> | undefined,
  existingFiles?: Record<string, string | undefined>
): Promise<string[]> {
  const signals: string[] = [];
  for (const candidate of ["pnpm-workspace.yaml", "turbo.json", "nx.json", "lerna.json", "rush.json"]) {
    if (await pathExists(projectRoot, candidate, existingFiles)) {
      signals.push(candidate);
    }
  }
  if (Array.isArray(packageJson?.workspaces) || isPlainObject(packageJson?.workspaces)) {
    signals.push("package.json#workspaces");
  }
  for (const directory of ["apps", "packages"]) {
    if (await pathExists(projectRoot, directory, existingFiles)) {
      signals.push(`${directory}/`);
    }
  }
  return unique(signals);
}

async function detectExistingPaths(
  projectRoot: string,
  existingFiles: Record<string, string | undefined> | undefined,
  candidates: string[]
): Promise<string[]> {
  const found: string[] = [];
  for (const candidate of candidates) {
    if (await pathExists(projectRoot, candidate, existingFiles)) {
      found.push(candidate);
    }
  }
  return found;
}

async function suggestScopes(
  projectRoot: string,
  existingFiles?: Record<string, string | undefined>
): Promise<string[]> {
  const candidates = [
    ["apps/web", "apps/web/**"],
    ["apps/api", "apps/api/**"],
    ["apps/server", "apps/server/**"],
    ["packages", "packages/**"],
    ["src", "src/**"],
    ["docs", "docs/**"],
    ["tests", "tests/**"],
    [".github", ".github/**"]
  ] as const;
  const scopes: string[] = [];
  for (const [probe, scope] of candidates) {
    if (await pathExists(projectRoot, probe, existingFiles)) {
      scopes.push(scope);
    }
  }
  return scopes.length > 0 ? scopes : ["**/*"];
}

async function pathExists(
  projectRoot: string,
  relativePath: string,
  existingFiles?: Record<string, string | undefined>
): Promise<boolean> {
  if (existingFiles && Object.prototype.hasOwnProperty.call(existingFiles, relativePath)) {
    return existingFiles[relativePath] !== undefined;
  }

  try {
    await access(path.resolve(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "none";
}

function formatBullets(values: string[]): string[] {
  return values.length ? values.map((value) => `- ${value}`) : ["- none"];
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(value, pattern));
}

function matchesPattern(value: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return false;
  }
  if (!trimmed.includes("*")) {
    const prefix = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    return value === trimmed || value.startsWith(prefix);
  }

  const escaped = trimmed
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(value);
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

function hashContent(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
