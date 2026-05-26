import { createFilePlan } from "@odinfra/generator";
import {
  manifestIncludesCommands,
  outputAndMaybeWritePlan,
  readOptionalManifest,
  readRequiredConfig,
  resolveProjectRoot,
  type PlanCommandOptions
} from "./shared.js";

export interface UpdateOptions extends PlanCommandOptions {
  packageVersion?: string;
}

export async function runUpdate(options: UpdateOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const config = await readRequiredConfig(projectRoot);
  const manifest = await readOptionalManifest(projectRoot);
  const plan = await createFilePlan({
    projectRoot,
    targetTool: config.target.tool,
    agents: config.agents,
    includeCommands: manifestIncludesCommands(manifest),
    packageVersion: options.packageVersion,
    previousManifest: manifest,
    requireConfirmation: !options.yes
  });

  await outputAndMaybeWritePlan(projectRoot, plan, options);
}
