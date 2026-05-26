import { describe, expect, it } from "vitest";
import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import {
  analyzeProject,
  createFilePlan,
  detectPackageManager,
  formatFilePlan,
  mergeOpenCodeConfig,
  upsertManagedBlock
} from "@odinfra/generator";
import { createAgentConfigFromRole, createDefaultAgents, getRoleDefinition } from "@odinfra/schema";

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
    const artifacts = renderOpenCodeArtifacts({ agents: createDefaultAgents(), includeCommands: false });
    const merged = JSON.parse(
      mergeOpenCodeConfig(
        JSON.stringify({ custom: true, instructions: ["README.md"], agent: { existing: { mode: "primary" } } }),
        artifacts.opencodeConfigPatch,
        false
      )
    ) as Record<string, unknown>;

    expect(merged.custom).toBe(true);
    expect(merged.default_agent).toBe("odin-orchestrator");
    expect(merged.instructions).toEqual(["README.md", "AGENTS.md", ".opencode/ROLE_SYSTEM.md"]);
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
        ".opencode/ROLE_SYSTEM.md",
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
    expect(plan.manifest.managedFiles).toContain(".opencode/ROLE_SYSTEM.md");
    expect(plan.manifest.generatedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".opencode/agents/odin-orchestrator.md",
          contentHash: expect.stringMatching(/^sha256:/),
          lastAppliedPackageVersion: "0.0.0",
          userModified: false
        })
      ])
    );
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

  it("marks generated files as user-modified when their manifest hash no longer matches", async () => {
    const initial = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      existingFiles: {},
      generatedAt: new Date("2026-01-01T00:00:00.000Z")
    });
    const agentItem = initial.items.find((item) => item.path === ".opencode/agents/odin-orchestrator.md");
    if (!agentItem?.content) {
      throw new Error("missing generated agent fixture");
    }

    const next = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      existingFiles: {
        ".odinfra/manifest.json": `${JSON.stringify(initial.manifest, null, 2)}\n`,
        ".opencode/agents/odin-orchestrator.md": `${agentItem.content}\nUser edit\n`
      }
    });

    const changedItem = next.items.find((item) => item.path === ".opencode/agents/odin-orchestrator.md");
    expect(changedItem?.action).toBe("user-modified");
    expect(changedItem?.userModified).toBe(true);
    expect(next.manifest.generatedFiles?.find((file) => file.path === changedItem?.path)?.userModified).toBe(true);
  });

  it("marks generated template updates as needing confirmation when requested", async () => {
    const initial = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      existingFiles: {},
      generatedAt: new Date("2026-01-01T00:00:00.000Z")
    });
    const agentItem = initial.items.find((item) => item.path === ".opencode/agents/odin-orchestrator.md");
    const researcher = getRoleDefinition("researcher");
    if (!agentItem?.content || !researcher) {
      throw new Error("missing generated fixture");
    }

    const next = await createFilePlan({
      projectRoot: ".",
      agents: [...createDefaultAgents(), createAgentConfigFromRole(researcher)],
      existingFiles: {
        ".odinfra/manifest.json": `${JSON.stringify(initial.manifest, null, 2)}\n`,
        ".opencode/agents/odin-orchestrator.md": agentItem.content
      },
      requireConfirmation: true
    });

    expect(next.items.find((item) => item.path === ".opencode/agents/odin-orchestrator.md")?.action).toBe(
      "needs-confirmation"
    );
  });

  it("can format the file plan as JSON", async () => {
    const plan = await createFilePlan({
      projectRoot: ".",
      agents: createDefaultAgents(),
      existingFiles: {}
    });

    const parsed = JSON.parse(formatFilePlan(plan, { style: "json" })) as { items: { path: string }[] };
    expect(parsed.items.some((item) => item.path === ".odinfra/manifest.json")).toBe(true);
  });
});

describe("package manager and project profile", () => {
  it("detects packageManager metadata before lockfile fallbacks", async () => {
    const detected = await detectPackageManager(".", {
      "package.json": JSON.stringify({ packageManager: "bun@1.2.0" }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'"
    });

    expect(detected.name).toBe("bun");
    expect(detected.commands.executeOdinfra).toBe("bunx odinfra");
    expect(detected.warnings).toEqual(expect.arrayContaining([expect.stringContaining("pnpm-lock.yaml")]));
  });

  it("profiles monorepo and framework signals for adopt", async () => {
    const profile = await analyzeProject(".", {
      "package.json": JSON.stringify({
        packageManager: "pnpm@9.15.4",
        workspaces: ["apps/*", "packages/*"],
        dependencies: { next: "^15.0.0", react: "^19.0.0" }
      }),
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      "apps/web": "",
      packages: "",
      docs: "",
      "AGENTS.md": "# Rules\n",
      "opencode.json": "{}"
    });

    expect(profile.packageManager.name).toBe("pnpm");
    expect(profile.monorepo.detected).toBe(true);
    expect(profile.frameworks).toEqual(expect.arrayContaining(["Next.js", "React"]));
    expect(profile.suggestedScopes).toEqual(expect.arrayContaining(["apps/web/**", "packages/**", "docs/**"]));
    expect(profile.agentFiles).toContain("AGENTS.md");
  });
});
