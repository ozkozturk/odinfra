import path from "node:path";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { createFilePlan, formatFilePlan, writeFilePlan } from "@odinfra/generator";
import {
  createAgentConfigFromRole,
  createDefaultAgents,
  DEFAULT_MODEL_ID,
  getPermissionForRole,
  isValidAgentId,
  isValidModelId,
  roleDefinitions,
  toKebabAgentId,
  type AgentMode,
  type OdinfraAgentConfig,
  type PermissionAction
} from "@odinfra/schema";

export interface InitOptions {
  projectRoot: string;
  dryRun: boolean;
  yes: boolean;
  commands: boolean;
}

const permissionChoices = [
  { name: "allow", value: "allow" as const },
  { name: "ask", value: "ask" as const },
  { name: "deny", value: "deny" as const }
];

export async function runInit(options: InitOptions): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), options.projectRoot);
  const answers = options.yes ? createDefaultAnswers(options.commands) : await promptForAnswers(options.commands);

  const plan = await createFilePlan({
    projectRoot,
    targetTool: "opencode",
    agents: answers.agents,
    includeCommands: answers.includeCommands
  });

  console.log(formatFilePlan(plan));

  if (options.dryRun) {
    console.log("Dry run enabled; no files were written.");
    return;
  }

  const shouldWrite = options.yes ? true : await confirm({ message: "Write these files?", default: false });

  if (!shouldWrite) {
    console.log("No files were written.");
    return;
  }

  await writeFilePlan(projectRoot, plan);
  console.log("Odinfra files written.");
}

function createDefaultAnswers(includeCommands: boolean): { agents: OdinfraAgentConfig[]; includeCommands: boolean } {
  return {
    agents: createDefaultAgents(DEFAULT_MODEL_ID),
    includeCommands
  };
}

async function promptForAnswers(
  includeCommandsFromFlag: boolean
): Promise<{ agents: OdinfraAgentConfig[]; includeCommands: boolean }> {
  await select({
    message: "Select target tool",
    choices: [{ name: "OpenCode (v0 active target)", value: "opencode" as const }]
  });

  const selectedIds = await checkbox<string>({
    message: "Select roles to generate. Odin is required for v0.",
    required: true,
    choices: [
      ...roleDefinitions.map((role) => ({
        name: `${role.label} - ${role.description}`,
        value: role.id,
        checked: role.defaultSelected
      })),
      {
        name: "Custom Agent - Define a custom role, permissions, and scopes.",
        value: "custom-agent",
        checked: false
      }
    ]
  });

  if (!selectedIds.includes("odin-orchestrator")) {
    throw new Error("Odin (Orchestrator) is required for v0.");
  }

  const builtInIds = selectedIds.filter((id) => id !== "custom-agent");
  const builtInAgents = [] as OdinfraAgentConfig[];
  for (const role of roleDefinitions.filter((candidate) => builtInIds.includes(candidate.id))) {
    const model = await input({
      message: `Model ID for ${role.label}`,
      default: role.defaultModel,
      validate: (value) => (isValidModelId(value) ? true : "Use provider/model-id format.")
    });
    builtInAgents.push(createAgentConfigFromRole(role, model));
  }

  const customAgents = selectedIds.includes("custom-agent") ? await promptForCustomAgents(builtInAgents) : [];
  let agents = [...builtInAgents, ...customAgents];

  const customizePermissions = await confirm({
    message: "Customize permissions now?",
    default: false
  });

  if (customizePermissions) {
    agents = await promptForPermissionOverrides(agents);
  }

  const includeCommands =
    includeCommandsFromFlag ||
    (await confirm({
      message: "Generate optional .opencode/commands/ files?",
      default: false
    }));

  return { agents, includeCommands };
}

async function promptForCustomAgents(existingAgents: OdinfraAgentConfig[]): Promise<OdinfraAgentConfig[]> {
  const customAgents: OdinfraAgentConfig[] = [];
  let addAnother = true;

  while (addAnother) {
    const label = await input({ message: "Custom agent display name", validate: required });
    const defaultId = toKebabAgentId(label);
    const id = await input({
      message: "Custom agent ID",
      default: defaultId,
      validate: (value) => {
        if (!isValidAgentId(value)) return "Use lowercase kebab-case.";
        if ([...existingAgents, ...customAgents].some((agent) => agent.id === value)) return "Agent ID already exists.";
        return true;
      }
    });
    const description = await input({ message: "Custom agent description", validate: required });
    const mode = await select<AgentMode>({
      message: "Custom agent mode",
      choices: [
        { name: "subagent", value: "subagent" },
        { name: "primary", value: "primary" },
        { name: "all", value: "all" }
      ]
    });
    const model = await input({
      message: "Custom agent model ID",
      default: DEFAULT_MODEL_ID,
      validate: (value) => (isValidModelId(value) ? true : "Use provider/model-id format.")
    });
    const basePreset = await select<string>({
      message: "Base permission preset",
      choices: roleDefinitions.map((role) => ({ name: role.label, value: role.permissionPreset }))
    });
    const scopes = splitList(
      await input({
        message: "Allowed file scopes, comma-separated",
        default: ""
      })
    );
    const bashCommands = splitList(
      await input({
        message: "Bash command patterns to allow, comma-separated",
        default: ""
      })
    );

    const permission = getPermissionForRole(basePreset);
    permission.edit = await selectPermission("File edit permission", permission.edit);
    for (const command of bashCommands) {
      permission.bash[command] = "allow";
    }
    permission.task = (await confirm({ message: "Can launch other agents?", default: false }))
      ? { "*": "ask" }
      : "deny";
    permission.webfetch = await selectPermission("Web fetch permission", permission.webfetch);
    permission.websearch = await selectPermission("Web search permission", permission.websearch);
    permission.lsp = await selectPermission("LSP permission", permission.lsp);
    permission.skill = await selectPermission("Skill permission", permission.skill);

    customAgents.push({
      id,
      label,
      role: id,
      mode,
      model,
      description,
      permissionPreset: basePreset,
      customizedPermissions: true,
      permission,
      scopes
    });

    addAnother = await confirm({ message: "Add another custom agent?", default: false });
  }

  return customAgents;
}

async function promptForPermissionOverrides(agents: OdinfraAgentConfig[]): Promise<OdinfraAgentConfig[]> {
  const selectedIds = agents.map((agent) => agent.id);
  const next: OdinfraAgentConfig[] = [];

  for (const agent of agents) {
    const customize = await confirm({ message: `Customize ${agent.label}?`, default: false });
    if (!customize) {
      next.push(agent);
      continue;
    }

    const permission = agent.permission ?? getPermissionForRole(agent.permissionPreset, selectedIds);
    permission.edit = await selectPermission(`${agent.label}: edit`, permission.edit);
    permission.webfetch = await selectPermission(`${agent.label}: webfetch`, permission.webfetch);
    permission.websearch = await selectPermission(`${agent.label}: websearch`, permission.websearch);
    permission.lsp = await selectPermission(`${agent.label}: lsp`, permission.lsp);
    permission.skill = await selectPermission(`${agent.label}: skill`, permission.skill);

    next.push({ ...agent, permission, customizedPermissions: true });
  }

  return next;
}

async function selectPermission(message: string, current: PermissionAction): Promise<PermissionAction> {
  return select<PermissionAction>({
    message,
    default: current,
    choices: permissionChoices
  });
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function required(value: string): true | string {
  return value.trim() ? true : "Required.";
}
