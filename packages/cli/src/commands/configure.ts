import { search, select } from "@inquirer/prompts";
import { createFilePlan } from "@odinfra/generator";
import {
  createAgentConfigFromRole,
  getRoleDefinition,
  isValidModelId,
  OPENCODE_GO_MODELS,
  type OdinfraAgentConfig
} from "@odinfra/schema";
import {
  manifestIncludesCommands,
  outputAndMaybeWritePlan,
  parsePatternList,
  readOptionalManifest,
  readRequiredConfig,
  resolveProjectRoot,
  type PlanCommandOptions
} from "./shared.js";

export interface ConfigureOptions extends PlanCommandOptions {
  packageVersion?: string;
  model?: string;
  agent?: string;
  addAgent?: string;
  removeAgent?: string;
}

export async function runConfigure(options: ConfigureOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const config = await readRequiredConfig(projectRoot);
  const manifest = await readOptionalManifest(projectRoot);
  let agents = config.agents.map((agent) => ({ ...agent }));
  let changed = false;

  for (const id of parsePatternList(options.addAgent)) {
    if (agents.some((agent) => agent.id === id)) {
      continue;
    }
    const role = getRoleDefinition(id);
    if (!role) {
      throw new Error(`Unknown built-in agent: ${id}`);
    }
    agents = [...agents, createAgentConfigFromRole(role)];
    changed = true;
  }

  for (const id of parsePatternList(options.removeAgent)) {
    if (id === "odin-orchestrator") {
      throw new Error("Odin (Orchestrator) cannot be removed in v0.");
    }
    if (!agents.some((agent) => agent.id === id)) {
      throw new Error(`Unknown configured agent: ${id}`);
    }
    const nextAgents = agents.filter((agent) => agent.id !== id);
    if (nextAgents.length !== agents.length) {
      agents = nextAgents;
      changed = true;
    }
  }

  if (options.model) {
    agents = updateAgentModels(agents, options.agent ?? "all", options.model);
    changed = true;
  } else if (!changed && !options.yes) {
    const targetAgent = await select<string>({
      message: "Select agent to update",
      choices: [
        { name: "All agents", value: "all" },
        ...agents.map((agent) => ({ name: `${agent.label} (${agent.id})`, value: agent.id }))
      ]
    });
    const model = await searchModel("Model ID");
    agents = updateAgentModels(agents, targetAgent, model);
    changed = true;
  }

  if (!changed) {
    throw new Error("No configure changes requested. Pass --model, --add-agent, or --remove-agent.");
  }

  const plan = await createFilePlan({
    projectRoot,
    targetTool: config.target.tool,
    agents,
    includeCommands: manifestIncludesCommands(manifest),
    packageVersion: options.packageVersion,
    previousManifest: manifest,
    requireConfirmation: !options.yes
  });

  await outputAndMaybeWritePlan(projectRoot, plan, options);
}

function updateAgentModels(agents: OdinfraAgentConfig[], targetAgent: string, model: string): OdinfraAgentConfig[] {
  if (!isValidModelId(model)) {
    throw new Error("Model ID must use provider/model format.");
  }

  if (targetAgent !== "all" && !agents.some((agent) => agent.id === targetAgent)) {
    throw new Error(`Unknown configured agent: ${targetAgent}`);
  }

  return agents.map((agent) => (targetAgent === "all" || agent.id === targetAgent ? { ...agent, model } : agent));
}

async function searchModel(message: string): Promise<string> {
  return search<string>({
    message,
    source: (term) => {
      if (!term) return [...OPENCODE_GO_MODELS];
      const query = term.toLowerCase();
      return OPENCODE_GO_MODELS.filter(
        (model) => model.name.toLowerCase().includes(query) || model.value.toLowerCase().includes(query)
      );
    },
    pageSize: 10
  });
}
