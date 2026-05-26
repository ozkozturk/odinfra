import { z } from "zod";

export const ODINFRA_SCHEMA_VERSION = "0.2.0";
/**
 * Version of the generated Odinfra config and manifest schema.
 *
 * @deprecated Use ODINFRA_SCHEMA_VERSION for new code. This is not the CLI package version.
 */
export const ODINFRA_VERSION = ODINFRA_SCHEMA_VERSION;
export const OPENCODE_GO_MODELS = [
  {
    value: "opencode-go/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    description: "Powerful general-purpose coding model"
  },
  {
    value: "opencode-go/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    description: "Fast, cost-effective coding model"
  },
  { value: "opencode-go/kimi-k2.6", name: "Kimi K2.6", description: "Strong reasoning and code generation" },
  { value: "opencode-go/kimi-k2.5", name: "Kimi K2.5", description: "Strong reasoning capability" },
  { value: "opencode-go/glm-5.1", name: "GLM-5.1", description: "Highest capability, premium tier" },
  { value: "opencode-go/glm-5", name: "GLM-5", description: "High capability, balanced cost" },
  { value: "opencode-go/mimo-v2.5-pro", name: "MiMo-V2.5-Pro", description: "Strong coding performance" },
  { value: "opencode-go/mimo-v2.5", name: "MiMo-V2.5", description: "Balanced performance and cost" },
  { value: "opencode-go/minimax-m2.7", name: "MiniMax M2.7", description: "Efficient and fast responses" },
  { value: "opencode-go/minimax-m2.5", name: "MiniMax M2.5", description: "Budget-friendly, high throughput" },
  { value: "opencode-go/qwen3.6-plus", name: "Qwen3.6 Plus", description: "Excellent code generation" },
  { value: "opencode-go/qwen3.5-plus", name: "Qwen3.5 Plus", description: "Most cost-effective option" }
] as const;

export const DEFAULT_MODEL_ID = OPENCODE_GO_MODELS[0].value;

export const permissionActionSchema = z.enum(["allow", "ask", "deny"]);
export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const agentModeSchema = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof agentModeSchema>;

export const targetToolSchema = z.enum(["opencode"]);
export type TargetTool = z.infer<typeof targetToolSchema>;

export type BashPermission = Record<string, PermissionAction>;
export type TaskPermission = PermissionAction | Record<string, PermissionAction>;

export interface AgentPermission {
  read: PermissionAction;
  glob: PermissionAction;
  grep: PermissionAction;
  list: PermissionAction;
  edit: PermissionAction;
  bash: BashPermission;
  task: TaskPermission;
  external_directory: PermissionAction;
  webfetch: PermissionAction;
  websearch: PermissionAction;
  lsp: PermissionAction;
  skill: PermissionAction;
}

export const agentPermissionSchema: z.ZodType<AgentPermission> = z.object({
  read: permissionActionSchema,
  glob: permissionActionSchema,
  grep: permissionActionSchema,
  list: permissionActionSchema,
  edit: permissionActionSchema,
  bash: z.record(permissionActionSchema),
  task: z.union([permissionActionSchema, z.record(permissionActionSchema)]),
  external_directory: permissionActionSchema,
  webfetch: permissionActionSchema,
  websearch: permissionActionSchema,
  lsp: permissionActionSchema,
  skill: permissionActionSchema
});

export interface RoleDefinition {
  id: string;
  label: string;
  role: string;
  description: string;
  mode: AgentMode;
  permissionPreset: string;
  defaultSelected: boolean;
  optional: boolean;
  defaultModel: string;
  suggestedScopes: string[];
}

export interface OdinfraAgentConfig {
  id: string;
  label: string;
  role: string;
  mode: AgentMode;
  model: string;
  description: string;
  permissionPreset: string;
  customizedPermissions: boolean;
  permission?: AgentPermission;
  scopes?: string[];
}

export const odinfraAgentConfigSchema: z.ZodType<OdinfraAgentConfig> = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(1),
  role: z.string().min(1),
  mode: agentModeSchema,
  model: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  description: z.string().min(1),
  permissionPreset: z.string().min(1),
  customizedPermissions: z.boolean(),
  permission: agentPermissionSchema.optional(),
  scopes: z.array(z.string()).optional()
});

export interface OdinfraConfig {
  version: string;
  target: {
    tool: TargetTool;
    projectRoot: string;
  };
  agents: OdinfraAgentConfig[];
}

export const odinfraConfigSchema: z.ZodType<OdinfraConfig> = z.object({
  version: z.string(),
  target: z.object({
    tool: targetToolSchema,
    projectRoot: z.string()
  }),
  agents: z.array(odinfraAgentConfigSchema).min(1)
});

export interface OdinfraManagedBlock {
  file: string;
  name: string;
  start: string;
  end: string;
}

export interface OdinfraManifestFile {
  path: string;
  contentHash: string;
  templateVersion: string;
  lastAppliedPackageVersion: string;
  userModified: boolean;
}

export interface OdinfraManifest {
  version: string;
  createdBy: "odinfra";
  targetTool: TargetTool;
  generatedAt: string;
  packageVersion?: string;
  managedFiles: string[];
  managedBlocks: OdinfraManagedBlock[];
  generatedFiles?: OdinfraManifestFile[];
}

export const odinfraManifestSchema: z.ZodType<OdinfraManifest> = z.object({
  version: z.string(),
  createdBy: z.literal("odinfra"),
  targetTool: targetToolSchema,
  generatedAt: z.string(),
  packageVersion: z.string().optional(),
  managedFiles: z.array(z.string()),
  managedBlocks: z.array(
    z.object({
      file: z.string(),
      name: z.string(),
      start: z.string(),
      end: z.string()
    })
  ),
  generatedFiles: z
    .array(
      z.object({
        path: z.string(),
        contentHash: z.string(),
        templateVersion: z.string(),
        lastAppliedPackageVersion: z.string(),
        userModified: z.boolean()
      })
    )
    .optional()
});

export const roleDefinitions: RoleDefinition[] = [
  {
    id: "odin-orchestrator",
    label: "Odin (Orchestrator)",
    role: "orchestrator",
    description:
      "Plans work, coordinates subagents, tracks progress, and synthesizes results. Never implements code directly unless the user explicitly overrides this rule.",
    mode: "primary",
    permissionPreset: "orchestrator",
    defaultSelected: true,
    optional: false,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "researcher",
    label: "Researcher",
    role: "researcher",
    description:
      "Investigates codebase structure, dependencies, conventions, and existing patterns. Produces structured summaries and recommendations without modifying any files.",
    mode: "subagent",
    permissionPreset: "researcher",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "frontend-engineer",
    label: "Frontend Engineer",
    role: "frontend-engineer",
    description:
      "Implements UI components, styles, and client-side logic within designated frontend scopes following existing framework and design conventions.",
    mode: "subagent",
    permissionPreset: "frontend-engineer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: ["apps/web/**", "src/**", "packages/ui/**", "components/**", "pages/**", "app/**"]
  },
  {
    id: "backend-engineer",
    label: "Backend Engineer",
    role: "backend-engineer",
    description:
      "Implements APIs, services, data models, and server-side logic within designated backend scopes following existing architecture patterns.",
    mode: "subagent",
    permissionPreset: "backend-engineer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: [
      "apps/api/**",
      "apps/server/**",
      "packages/server/**",
      "packages/db/**",
      "src/server/**",
      "src/api/**"
    ]
  },
  {
    id: "checker",
    label: "Checker",
    role: "checker",
    description:
      "Audits code against project conventions, naming rules, forbidden patterns, and generated-file boundaries. Reports violations without editing code. Not a reviewer.",
    mode: "subagent",
    permissionPreset: "checker",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "reviewer",
    label: "Reviewer",
    role: "reviewer",
    description:
      "Reviews correctness, edge cases, race conditions, security implications, architecture alignment, and production risk. Reports by severity without editing code.",
    mode: "subagent",
    permissionPreset: "reviewer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "docs-writer",
    label: "Docs Writer",
    role: "docs-writer",
    description:
      "Creates and maintains documentation, README files, API references, and architecture decision records. Keeps docs accurate and in sync with code.",
    mode: "subagent",
    permissionPreset: "docs-writer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: ["README.md", "docs/**", "*.md", "*.mdx", "AGENTS.md"]
  },
  {
    id: "test-engineer",
    label: "Test Engineer",
    role: "test-engineer",
    description:
      "Designs and implements tests, identifies untested paths, and verifies test reliability. Does not modify production source code.",
    mode: "subagent",
    permissionPreset: "test-engineer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: ["**/*.test.*", "**/*.spec.*", "tests/**", "__tests__/**"]
  },
  {
    id: "devops-engineer",
    label: "DevOps Engineer",
    role: "devops-engineer",
    description:
      "Manages CI/CD pipelines, container configurations, deployment scripts, and infrastructure-as-code. Applies changes cautiously with rollback awareness.",
    mode: "subagent",
    permissionPreset: "devops-engineer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: [".github/**", "Dockerfile", "docker-compose.yml", "compose.yml", "infra/**", "scripts/**"]
  },
  {
    id: "security-reviewer",
    label: "Security Reviewer",
    role: "security-reviewer",
    description:
      "Analyzes code for security vulnerabilities including injection, auth bypass, secret exposure, dependency CVEs, and permission escalation. Reports without editing code.",
    mode: "subagent",
    permissionPreset: "security-reviewer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "architect",
    label: "Architect",
    role: "architect",
    description:
      "Evaluates system architecture, module boundaries, dependency direction, API contracts, and scalability patterns. Produces recommendations, not code.",
    mode: "subagent",
    permissionPreset: "architect",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  },
  {
    id: "refactor-engineer",
    label: "Refactor Engineer",
    role: "refactor-engineer",
    description:
      "Executes behavior-preserving refactors: extract, inline, rename, restructure. Verifies equivalence through existing tests.",
    mode: "subagent",
    permissionPreset: "refactor-engineer",
    defaultSelected: false,
    optional: true,
    defaultModel: DEFAULT_MODEL_ID,
    suggestedScopes: []
  }
];

const safeRead: PermissionAction = "allow";
const safeAsk: PermissionAction = "ask";
const safeDeny: PermissionAction = "deny";

export const rolePermissionPresets: Record<string, AgentPermission> = {
  orchestrator: {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: { "*": safeAsk, "git status*": safeRead, "git diff*": safeRead },
    task: { "*": safeDeny },
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  researcher: {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: { "*": safeAsk, "git status*": safeRead, "git diff*": safeRead, "ls *": safeRead, "find *": safeAsk },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  "frontend-engineer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: {
      "*": safeAsk,
      "pnpm lint*": safeRead,
      "pnpm test*": safeRead,
      "pnpm typecheck*": safeRead,
      "npm run lint*": safeRead,
      "npm run test*": safeRead,
      "npm run typecheck*": safeRead,
      "yarn lint*": safeRead,
      "yarn test*": safeRead,
      "yarn typecheck*": safeRead,
      "bun run lint*": safeRead,
      "bun test*": safeRead,
      "bun run typecheck*": safeRead
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeRead,
    skill: safeAsk
  },
  "backend-engineer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: {
      "*": safeAsk,
      "pnpm lint*": safeRead,
      "pnpm test*": safeRead,
      "pnpm typecheck*": safeRead,
      "npm run lint*": safeRead,
      "npm run test*": safeRead,
      "npm run typecheck*": safeRead,
      "yarn lint*": safeRead,
      "yarn test*": safeRead,
      "yarn typecheck*": safeRead,
      "bun run lint*": safeRead,
      "bun test*": safeRead,
      "bun run typecheck*": safeRead
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeRead,
    skill: safeAsk
  },
  checker: {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: {
      "*": safeAsk,
      "git status*": safeRead,
      "git diff*": safeRead,
      "pnpm lint*": safeRead,
      "pnpm typecheck*": safeRead,
      "npm run lint*": safeRead,
      "npm run typecheck*": safeRead,
      "yarn lint*": safeRead,
      "yarn typecheck*": safeRead,
      "bun run lint*": safeRead,
      "bun run typecheck*": safeRead
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeDeny,
    websearch: safeDeny,
    lsp: safeAsk,
    skill: safeAsk
  },
  reviewer: {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: {
      "*": safeAsk,
      "git status*": safeRead,
      "git diff*": safeRead,
      "pnpm test*": safeAsk,
      "pnpm typecheck*": safeAsk,
      "npm run test*": safeAsk,
      "npm run typecheck*": safeAsk,
      "yarn test*": safeAsk,
      "yarn typecheck*": safeAsk,
      "bun test*": safeAsk,
      "bun run typecheck*": safeAsk
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  "docs-writer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: { "*": safeAsk, "git diff*": safeRead, "git status*": safeRead },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  "test-engineer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: {
      "*": safeAsk,
      "pnpm test*": safeRead,
      "npm run test*": safeRead,
      "yarn test*": safeRead,
      "bun test*": safeRead,
      "pnpm typecheck*": safeAsk,
      "npm run typecheck*": safeAsk,
      "yarn typecheck*": safeAsk,
      "bun run typecheck*": safeAsk
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeRead,
    skill: safeAsk
  },
  "devops-engineer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: {
      "*": safeAsk,
      "git status*": safeRead,
      "git diff*": safeRead,
      "docker *": safeAsk,
      "docker compose *": safeAsk,
      "pnpm build*": safeAsk,
      "npm run build*": safeAsk,
      "yarn build*": safeAsk,
      "bun run build*": safeAsk
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  "security-reviewer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: {
      "*": safeAsk,
      "git status*": safeRead,
      "git diff*": safeRead,
      "pnpm audit*": safeAsk,
      "npm audit*": safeAsk,
      "yarn npm audit*": safeAsk,
      "bun audit*": safeAsk
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  architect: {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeDeny,
    bash: { "*": safeAsk, "git status*": safeRead, "git diff*": safeRead },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeAsk,
    skill: safeAsk
  },
  "refactor-engineer": {
    read: safeRead,
    glob: safeRead,
    grep: safeRead,
    list: safeRead,
    edit: safeAsk,
    bash: {
      "*": safeAsk,
      "pnpm lint*": safeRead,
      "pnpm test*": safeAsk,
      "pnpm typecheck*": safeRead,
      "npm run lint*": safeRead,
      "npm run test*": safeAsk,
      "npm run typecheck*": safeRead,
      "yarn lint*": safeRead,
      "yarn test*": safeAsk,
      "yarn typecheck*": safeRead,
      "bun run lint*": safeRead,
      "bun test*": safeAsk,
      "bun run typecheck*": safeRead
    },
    task: safeDeny,
    external_directory: safeDeny,
    webfetch: safeAsk,
    websearch: safeAsk,
    lsp: safeRead,
    skill: safeAsk
  }
};

export function clonePermission(permission: AgentPermission): AgentPermission {
  return JSON.parse(JSON.stringify(permission)) as AgentPermission;
}

export function getPermissionForRole(permissionPreset: string, selectedAgentIds: string[] = []): AgentPermission {
  const base = rolePermissionPresets[permissionPreset];
  if (!base) {
    throw new Error(`Unknown permission preset: ${permissionPreset}`);
  }

  const permission = clonePermission(base);
  if (permissionPreset === "orchestrator") {
    const task: Record<string, PermissionAction> = { "*": "deny" };
    for (const agentId of selectedAgentIds) {
      if (agentId !== "odin-orchestrator") {
        task[agentId] = "allow";
      }
    }
    permission.task = task;
  }

  return permission;
}

export function defaultSelectedAgentIds(): string[] {
  return roleDefinitions.filter((role) => role.defaultSelected).map((role) => role.id);
}

export function getRoleDefinition(id: string): RoleDefinition | undefined {
  return roleDefinitions.find((role) => role.id === id);
}

export function createAgentConfigFromRole(role: RoleDefinition, model = role.defaultModel): OdinfraAgentConfig {
  return {
    id: role.id,
    label: role.label,
    role: role.role,
    mode: role.mode,
    model,
    description: role.description,
    permissionPreset: role.permissionPreset,
    customizedPermissions: false,
    scopes: role.suggestedScopes
  };
}

export function createDefaultAgents(model = DEFAULT_MODEL_ID): OdinfraAgentConfig[] {
  return roleDefinitions.filter((role) => role.defaultSelected).map((role) => createAgentConfigFromRole(role, model));
}

export function toKebabAgentId(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function isValidAgentId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isValidModelId(value: string): boolean {
  return /^[^/\s]+\/[^/\s]+$/.test(value);
}
