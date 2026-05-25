import { getPermissionForRole, type AgentPermission, type OdinfraAgentConfig } from "@odinfra/schema";
import { renderAgentBody, renderCommandTemplates } from "@odinfra/templates";

export interface GeneratedArtifact {
  path: string;
  content: string;
}

export interface OpenCodeArtifacts {
  opencodeConfigPatch: Record<string, unknown>;
  agentsBlock: string;
  agentFiles: GeneratedArtifact[];
  commandFiles: GeneratedArtifact[];
  defaultAgentId: string;
}

export interface RenderOpenCodeOptions {
  agents: OdinfraAgentConfig[];
  includeCommands: boolean;
}

export function renderOpenCodeArtifacts(options: RenderOpenCodeOptions): OpenCodeArtifacts {
  const selectedAgentIds = options.agents.map((agent) => agent.id);
  const defaultAgentId = selectDefaultAgentId(options.agents);
  const agentFiles = options.agents.map((agent) => ({
    path: `.opencode/agents/${agent.id}.md`,
    content: renderAgentFile(agent, options.agents, selectedAgentIds)
  }));

  const commandFiles = options.includeCommands
    ? renderCommandTemplates(options.agents).map((command) => ({
        path: `.opencode/commands/${command.fileName}`,
        content: renderCommandFile(command)
      }))
    : [];

  return {
    defaultAgentId,
    agentFiles,
    commandFiles,
    agentsBlock: renderAgentsBlock(options.agents, defaultAgentId, [...agentFiles, ...commandFiles]),
    opencodeConfigPatch: {
      $schema: "https://opencode.ai/config.json",
      default_agent: defaultAgentId,
      instructions: ["AGENTS.md"],
      agent: {}
    }
  };
}

function selectDefaultAgentId(agents: OdinfraAgentConfig[]): string {
  const primary = agents.find((agent) => agent.mode === "primary" || agent.mode === "all");
  return primary?.id ?? agents[0]?.id ?? "odin-orchestrator";
}

function renderAgentFile(
  agent: OdinfraAgentConfig,
  allAgents: OdinfraAgentConfig[],
  selectedAgentIds: string[]
): string {
  const permission = agent.permission ?? getPermissionForRole(agent.permissionPreset, selectedAgentIds);
  const frontmatter = [
    "---",
    `description: ${yamlScalar(agent.description)}`,
    `mode: ${agent.mode}`,
    `model: ${yamlScalar(agent.model)}`,
    "temperature: 0.2",
    "permission:",
    renderPermission(permission, 2),
    "---"
  ].join("\n");

  return `${frontmatter}\n\n${renderAgentBody(agent, allAgents)}\n`;
}

function renderCommandFile(command: { description: string; agent?: string; body: string }): string {
  const lines = ["---", `description: ${yamlScalar(command.description)}`];
  if (command.agent) {
    lines.push(`agent: ${command.agent}`);
  }
  lines.push("---", "", command.body, "");
  return lines.join("\n");
}

function renderAgentsBlock(
  agents: OdinfraAgentConfig[],
  defaultAgentId: string,
  artifacts: GeneratedArtifact[]
): string {
  const agentLines = agents.map((agent) => `- \`${agent.id}\` (${agent.mode}) - ${agent.description}`);
  const fileLines = artifacts.map((artifact) => `- \`${artifact.path}\``);

  return [
    "Managed by Odinfra. Prefer updating this block with `odinfra init`.",
    "",
    "Target tool: OpenCode",
    `Default agent: \`${defaultAgentId}\``,
    "",
    "Selected agents:",
    ...agentLines,
    "",
    "Generated OpenCode files:",
    ...fileLines
  ].join("\n");
}

function renderPermission(permission: AgentPermission, indent: number): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(permission)) {
    if (typeof value === "string") {
      lines.push(`${spaces(indent)}${yamlKey(key)}: ${value}`);
      continue;
    }

    lines.push(`${spaces(indent)}${yamlKey(key)}:`);
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      lines.push(`${spaces(indent + 2)}${yamlKey(nestedKey)}: ${nestedValue}`);
    }
  }
  return lines.join("\n");
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function yamlKey(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) ? value : JSON.stringify(value);
}

function spaces(count: number): string {
  return " ".repeat(count);
}
