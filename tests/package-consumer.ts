import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import { createFilePlan } from "@odinfra/generator";
import { createDefaultAgents, ODINFRA_SCHEMA_VERSION } from "@odinfra/schema";
import { renderAgentBody, renderRoleSystem } from "@odinfra/templates";

const agents = createDefaultAgents();
const artifacts = renderOpenCodeArtifacts({ agents, includeCommands: false });

artifacts.roleSystemFile.content satisfies string;
renderAgentBody(agents[0], agents);
renderRoleSystem(agents);
await createFilePlan({
  projectRoot: ".",
  agents,
  existingFiles: {},
  generatedAt: new Date("2026-01-01T00:00:00.000Z")
});

ODINFRA_SCHEMA_VERSION satisfies string;
