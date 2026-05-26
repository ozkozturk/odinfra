import { describe, expect, it } from "vitest";
import { defaultSelectedAgentIds, getPermissionForRole, roleDefinitions, toKebabAgentId } from "@odinfra/schema";

describe("schema role defaults", () => {
  it("selects only Odin by default", () => {
    expect(defaultSelectedAgentIds()).toEqual(["odin-orchestrator"]);
    expect(roleDefinitions.filter((role) => role.defaultSelected)).toHaveLength(1);
  });

  it("generates stable kebab-case agent IDs", () => {
    expect(toKebabAgentId("Frontend Engineer!")).toBe("frontend-engineer");
    expect(toKebabAgentId("  Security Reviewer  ")).toBe("security-reviewer");
  });

  it("maps orchestrator permissions to selected subagents", () => {
    const permission = getPermissionForRole("orchestrator", ["odin-orchestrator", "researcher"]);
    expect(permission.edit).toBe("deny");
    expect(permission.task).toEqual({ "*": "deny", researcher: "allow" });
  });

  it("keeps implementation roles cautious by default", () => {
    const permission = getPermissionForRole("backend-engineer");
    expect(permission.edit).toBe("ask");
    expect(permission.bash["pnpm test*"]).toBe("allow");
    expect(permission.bash["yarn test*"]).toBe("allow");
    expect(permission.bash["bun test*"]).toBe("allow");
    expect(permission.external_directory).toBe("deny");
  });
});
