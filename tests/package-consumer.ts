import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import { createFilePlan } from "@odinfra/generator";
import { createDefaultAgents, ODINFRA_SCHEMA_VERSION } from "@odinfra/schema";
import { renderAgentBody } from "@odinfra/templates";

const agents = createDefaultAgents();

renderOpenCodeArtifacts({ agents, includeCommands: false });
renderAgentBody(agents[0], agents);
await createFilePlan({
  projectRoot: ".",
  agents,
  existingFiles: {},
  generatedAt: new Date("2026-01-01T00:00:00.000Z")
});

ODINFRA_SCHEMA_VERSION satisfies string;
