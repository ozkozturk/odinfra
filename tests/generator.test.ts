import { describe, expect, it } from "vitest";
import {
  createFilePlan,
  mergeOpenCodeConfig,
  upsertManagedBlock
} from "@odinfra/generator";
import { createDefaultAgents } from "@odinfra/schema";

describe("managed AGENTS.md block", () => {
  it("creates a project-neutral file when AGENTS.md is absent", () => {
    const next = upsertManagedBlock(undefined, "Selected agents:\n- `odin-orchestrator`");
    expect(next).toContain("# Project Agents");
    expect(next).toContain("<!-- odinfra:start subagent-management -->");
    expect(next).toContain("`odin-orchestrator`");
  });

  it("preserves existing user content when appending the managed block", () => {
    const next = upsertManagedBlock("# Existing Rules\n\nKeep this.", "Generated content");
    expect(next).toContain("# Existing Rules");
    expect(next).toContain("Keep this.");
    expect(next).toContain("Generated content");
  });

  it("updates only the existing Odinfra managed block", () => {
    const existing = [
      "# Existing Rules",
      "",
      "before",
      "",
      "## Subagent Management",
      "",
      "<!-- odinfra:start subagent-management -->",
      "",
      "old generated content",
      "",
      "<!-- odinfra:end subagent-management -->",
      "",
      "after"
    ].join("\n");

    const next = upsertManagedBlock(existing, "new generated content");
    expect(next).toContain("before");
    expect(next).toContain("after");
    expect(next).toContain("new generated content");
    expect(next).not.toContain("old generated content");
  });
});

describe("OpenCode config merge", () => {
  it("deep-merges opencode.json without removing user keys", () => {
    const merged = JSON.parse(
      mergeOpenCodeConfig(
        JSON.stringify({ custom: true, instructions: ["README.md"], agent: { existing: { mode: "primary" } } }),
        {
          $schema: "https://opencode.ai/config.json",
          default_agent: "odin-orchestrator",
          instructions: ["AGENTS.md"],
          agent: {}
        },
        false
      )
    ) as Record<string, unknown>;

    expect(merged.custom).toBe(true);
    expect(merged.default_agent).toBe("odin-orchestrator");
    expect(merged.instructions).toEqual(["README.md", "AGENTS.md"]);
    expect(merged.agent).toEqual({ existing: { mode: "primary" } });
  });

  it("updates opencode.jsonc while preserving comments", () => {
    const merged = mergeOpenCodeConfig(
      '{\n  // keep this comment\n  "instructions": ["README.md"]\n}\n',
      {
        $schema: "https://opencode.ai/config.json",
        default_agent: "odin-orchestrator",
        instructions: ["AGENTS.md"],
        agent: {}
      },
      true
    );

    expect(merged).toContain("// keep this comment");
    expect(merged).toContain('"AGENTS.md"');
    expect(merged).toContain('"default_agent"');
  });
});

describe("file plan", () => {
  it("generates the required v0 files", async () => {
    const plan = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      includeCommands: true,
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
      existingFiles: {}
    });

    expect(plan.items.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        "opencode.json",
        ".opencode/agents/odin-orchestrator.md",
        ".opencode/commands/odinfra-plan.md",
        ".opencode/commands/odinfra-check.md",
        ".opencode/commands/odinfra-review.md",
        ".odinfra/config.json",
        ".odinfra/manifest.json"
      ])
    );
    expect(plan.manifest.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(plan.manifest.managedFiles).toContain("AGENTS.md");
  });

  it("plans updates without writing files", async () => {
    const plan = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      existingFiles: { "AGENTS.md": "# Existing\n" }
    });

    const agentsItem = plan.items.find((item) => item.path === "AGENTS.md");
    expect(agentsItem?.action).toBe("update");
    expect(agentsItem?.content).toContain("# Existing");
  });
});
