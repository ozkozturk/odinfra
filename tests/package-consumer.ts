import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
import { analyzeProject, createFilePlan, detectPackageManager } from "@odinfra/generator";
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
await detectPackageManager(".", { "package.json": JSON.stringify({ packageManager: "pnpm@9.15.4" }) });
await analyzeProject(".", { "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }) });

ODINFRA_SCHEMA_VERSION satisfies string;
