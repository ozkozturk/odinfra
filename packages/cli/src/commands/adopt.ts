import { analyzeProject, formatAdoptReport } from "@odinfra/generator";
import { resolveProjectRoot } from "./shared.js";

export interface AdoptOptions {
  projectRoot: string;
  json: boolean;
}

export async function runAdopt(options: AdoptOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const profile = await analyzeProject(projectRoot);
  if (options.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  console.log(formatAdoptReport(profile));
}
