import { z } from "zod";

export const ODINFRA_SCHEMA_VERSION = "0.1.0";
/**
 * Version of the generated Odinfra config and manifest schema.
 *
 * @deprecated Use ODINFRA_SCHEMA_VERSION for new code. This is not the CLI package version.
 */
export const ODINFRA_VERSION = ODINFRA_SCHEMA_VERSION;
export const OPENCODE_GO_MODELS = [
  { value: "opencode-go/deepseek-v4-pro", name: "DeepSeek V4 Pro", description: "Powerful general-purpose coding model" },
  { value: "opencode-go/deepseek-v4-flash", name: "DeepSeek V4 Flash", description: "Fast, cost-effective coding model" },
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

export interface OdinfraManifest {
  version: string;
  createdBy: "odinfra";
  targetTool: TargetTool;
  generatedAt: string;
  managedFiles: string[];
  managedBlocks: OdinfraManagedBlock[];
}

export const odinfraManifestSchema: z.ZodType<OdinfraManifest> = z.object({
  version: z.string(),
  createdBy: z.literal("odinfra"),
  targetTool: targetToolSchema,
  generatedAt: z.string(),
  managedFiles: z.array(z.string()),
  managedBlocks: z.array(
    z.object({
      file: z.string(),
      name: z.string(),
      start: z.string(),
      end: z.string()
    })
  )
});

export const roleDefinitions: RoleDefinition[] = [
  {
    id: "odin-orchestrator",
    label: "Odin (Orchestrator)",
    role: "orchestrator",
    description:
      "Coordinates selected subagents, plans workflows, and delegates work. It should not directly implement code by default.",
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
      "Reads project context, existing files, rules, dependencies, and summarizes findings without changing files.",
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
    description: "Implements frontend changes within allowed frontend scopes.",
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
    description: "Implements backend, API, service, or database-related changes within allowed backend scopes.",
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
      "Checks mechanical rule compliance without editing code. It verifies conventions and rules compliance; it is not a reviewer.",
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
      "Reviews correctness, maintainability, security, architecture, edge cases, and implementation quality without editing code.",
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
    description: "Writes or updates documentation, README files, usage guides, and agent-facing docs.",
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
    description: "Creates, updates, or suggests tests and verifies the test strategy.",
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
      "Works on CI/CD, Docker, scripts, deployment, and infrastructure-related files with cautious permissions.",
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
      "Reviews security-sensitive changes, auth flows, secret handling, permissions, unsafe patterns, and dependency risks.",
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
      "Helps with high-level structure, boundaries, module design, package boundaries, and technical decisions.",
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
    description: "Performs focused refactors without changing product behavior.",
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
      "yarn typecheck*": safeRead
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
      "npm run typecheck*": safeRead
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
      "npm run typecheck*": safeRead
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
      "npm run typecheck*": safeAsk
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
      "pnpm typecheck*": safeAsk,
      "npm run typecheck*": safeAsk
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
      "npm run build*": safeAsk
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
      "npm audit*": safeAsk
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
      "npm run typecheck*": safeRead
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
