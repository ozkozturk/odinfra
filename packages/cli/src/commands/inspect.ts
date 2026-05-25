import { readFile } from "node:fs/promises";
import path from "node:path";
import { odinfraConfigSchema, odinfraManifestSchema } from "@odinfra/schema";

export interface InspectOptions {
  projectRoot: string;
}

export async function runInspect(options: InspectOptions): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), options.projectRoot);
  const config = await readJson(path.join(projectRoot, ".odinfra/config.json"));
  const manifest = await readJson(path.join(projectRoot, ".odinfra/manifest.json"));

  if (!config && !manifest) {
    console.log("No Odinfra config or manifest found. Run `odinfra init` first.");
    return;
  }

  if (config) {
    const parsed = odinfraConfigSchema.safeParse(config);
    if (!parsed.success) {
      console.log(".odinfra/config.json exists but is invalid.");
    } else {
      console.log(`Target: ${parsed.data.target.tool}`);
      console.log(`Project root: ${parsed.data.target.projectRoot}`);
      console.log("Agents:");
      for (const agent of parsed.data.agents) {
        console.log(`- ${agent.id} (${agent.mode}) - ${agent.description}`);
      }
    }
  }

  if (manifest) {
    const parsed = odinfraManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      console.log(".odinfra/manifest.json exists but is invalid.");
    } else {
      console.log("Managed files:");
      for (const file of parsed.data.managedFiles) {
        console.log(`- ${file}`);
      }
    }
  }
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
