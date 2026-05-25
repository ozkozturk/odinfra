import { describe, expect, it } from "vitest";
import { createAgentConfigFromRole, getRoleDefinition, type OdinfraAgentConfig } from "@odinfra/schema";
import { renderRoleSystem } from "@odinfra/templates";

function roleAgent(id: string): OdinfraAgentConfig {
  const role = getRoleDefinition(id);
  if (!role) {
    throw new Error(`Unknown test role: ${id}`);
  }

  return createAgentConfigFromRole(role);
}

describe("role system template", () => {
  it("renders selected agents with markdown-safe role summaries", () => {
    const customAgent: OdinfraAgentConfig = {
      ...roleAgent("researcher"),
      id: "custom-researcher",
      label: "Custom Researcher",
      role: "custom-researcher",
      description: "Reads docs | tests\nand reports findings"
    };

    const body = renderRoleSystem([roleAgent("odin-orchestrator"), customAgent]);

    expect(body).toContain("| Agent | Mode | Role Summary |");
    expect(body).toContain("| `custom-researcher` | subagent | Reads docs \\| tests and reports findings |");
  });

  it("renders checker and reviewer boundary when both roles are selected", () => {
    const body = renderRoleSystem([roleAgent("odin-orchestrator"), roleAgent("checker"), roleAgent("reviewer")]);

    expect(body).toContain("## 5. Checker vs Reviewer Boundary");
    expect(body).toContain(
      "| Focus | Conformance, conventions, formatting | Correctness, security, architecture, risk |"
    );
  });

  it("omits unselected subagent sections when only the orchestrator is active", () => {
    const body = renderRoleSystem([roleAgent("odin-orchestrator")]);

    expect(body).toContain("### Orchestrator");
    expect(body).not.toContain("### Researcher");
    expect(body).not.toContain("### Engineers");
    expect(body).not.toContain("Checker vs Reviewer Boundary");
  });
});
