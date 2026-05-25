import type { OdinfraAgentConfig } from "@odinfra/schema";

export interface CommandTemplate {
  fileName: string;
  description: string;
  agent?: string;
  body: string;
}

export function renderAgentBody(agent: OdinfraAgentConfig, selectedAgents: OdinfraAgentConfig[]): string {
  const peers = selectedAgents.filter((candidate) => candidate.id !== agent.id);
  const scopeSection = agent.scopes?.length
    ? ["", "## Suggested Scopes", "", ...agent.scopes.map((scope) => `- \`${scope}\``)].join("\n")
    : "";

  if (agent.id === "odin-orchestrator") {
    const delegation = peers.length
      ? peers.map((peer) => `- \`${peer.id}\`: ${peer.description}`).join("\n")
      : "- No subagents were selected during setup.";

    return [
      `# ${agent.label}`,
      "",
      "You are Odin, the orchestrator agent for this project.",
      "",
      "Coordinate work, create concise plans, and delegate implementation or review tasks to selected subagents. Do not directly implement code by default unless the user explicitly asks you to.",
      "",
      "## Available Subagents",
      "",
      delegation,
      "",
      "## Operating Rules",
      "",
      "- Prefer small, safe, verifiable changes.",
      "- Preserve user-owned project files.",
      "- Ask before destructive actions or broad permission expansion.",
      "- Summarize decisions and verification results clearly."
    ].join("\n");
  }

  return [
    `# ${agent.label}`,
    "",
    `You are the ${agent.label} subagent for this project.`,
    "",
    agent.description,
    "",
    "## Operating Rules",
    "",
    "- Stay within your assigned role boundary.",
    "- Prefer minimal, testable changes.",
    "- Do not exceed configured permissions.",
    "- Escalate unclear or destructive work to the primary agent or user.",
    scopeSection
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderCommandTemplates(selectedAgents: OdinfraAgentConfig[]): CommandTemplate[] {
  const hasAgent = (id: string) => selectedAgents.some((agent) => agent.id === id);

  return [
    {
      fileName: "odinfra-plan.md",
      description: "Create an Odinfra-guided implementation plan.",
      agent: hasAgent("odin-orchestrator") ? "odin-orchestrator" : undefined,
      body: [
        "Create a concise implementation plan for the user's request.",
        "",
        "Include scope, impacted files, risk points, and verification steps.",
        "Do not edit files unless the user explicitly asks you to proceed."
      ].join("\n")
    },
    {
      fileName: "odinfra-check.md",
      description: "Check mechanical rule compliance for the current change.",
      agent: hasAgent("checker") ? "checker" : undefined,
      body: [
        "Check the current change for mechanical rule compliance.",
        "",
        "Focus on repository rules, naming, forbidden patterns, formatting assumptions, and generated-file boundaries.",
        "Return findings with file references and do not edit files."
      ].join("\n")
    },
    {
      fileName: "odinfra-review.md",
      description: "Review correctness and implementation quality.",
      agent: hasAgent("reviewer") ? "reviewer" : undefined,
      body: [
        "Review the current change for correctness, maintainability, security, edge cases, and architecture risks.",
        "",
        "Return findings first, ordered by severity, with file and line references when possible.",
        "Do not perform mechanical checker work unless it affects correctness."
      ].join("\n")
    }
  ];
}
