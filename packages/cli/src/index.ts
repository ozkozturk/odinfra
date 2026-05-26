import { readFileSync } from "node:fs";
import { Command } from "commander";
import { runAdopt } from "./commands/adopt.js";
import { runConfigure } from "./commands/configure.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runInspect } from "./commands/inspect.js";
import { runUpdate } from "./commands/update.js";

const program = new Command();
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version?: string;
};

program
  .name("odinfra")
  .description("Install governed AI subagent setup files into a project.")
  .version(packageJson.version ?? "0.0.0");

program
  .command("init")
  .description("Generate or update Odinfra-managed OpenCode subagent files.")
  .option("--project-root <path>", "Project root to update.", ".")
  .option("--dry-run", "Print the file plan without writing files.", false)
  .option("--yes", "Use safe defaults and skip prompts.", false)
  .option("--commands", "Generate optional Odinfra command files.", false)
  .action(async (options: { projectRoot: string; dryRun: boolean; yes: boolean; commands: boolean }) => {
    await runInit({ ...options, packageVersion: packageJson.version });
  });

program
  .command("update")
  .description("Regenerate Odinfra-managed files from the existing project config.")
  .option("--project-root <path>", "Project root to update.", ".")
  .option("--dry-run", "Print the file plan without writing files.", false)
  .option("--yes", "Skip confirmation and write safe generated updates.", false)
  .option("--json", "Print the file plan as JSON.", false)
  .option("--include <patterns>", "Comma-separated file path patterns to include.")
  .option("--exclude <patterns>", "Comma-separated file path patterns to exclude.")
  .action(
    async (options: {
      projectRoot: string;
      dryRun: boolean;
      yes: boolean;
      json: boolean;
      include?: string;
      exclude?: string;
    }) => {
      await runUpdate({ ...options, packageVersion: packageJson.version });
    }
  );

program
  .command("configure")
  .description("Change Odinfra agent selections and regenerate the managed file plan.")
  .option("--project-root <path>", "Project root to update.", ".")
  .option("--dry-run", "Print the file plan without writing files.", false)
  .option("--yes", "Skip prompts and confirmation.", false)
  .option("--json", "Print the file plan as JSON.", false)
  .option("--agent <id>", "Agent ID to update when using --model. Defaults to all agents.")
  .option("--model <provider/model>", "Set the model for the selected agent or all agents.")
  .option("--add-agent <ids>", "Comma-separated built-in agent IDs to add.")
  .option("--remove-agent <ids>", "Comma-separated configured agent IDs to remove.")
  .option("--include <patterns>", "Comma-separated file path patterns to include.")
  .option("--exclude <patterns>", "Comma-separated file path patterns to exclude.")
  .action(
    async (options: {
      projectRoot: string;
      dryRun: boolean;
      yes: boolean;
      json: boolean;
      agent?: string;
      model?: string;
      addAgent?: string;
      removeAgent?: string;
      include?: string;
      exclude?: string;
    }) => {
      await runConfigure({ ...options, packageVersion: packageJson.version });
    }
  );

program
  .command("adopt")
  .description("Analyze an existing project and print a read-only Odinfra adoption plan.")
  .option("--project-root <path>", "Project root to analyze.", ".")
  .option("--json", "Print the adoption profile as JSON.", false)
  .action(async (options: { projectRoot: string; json: boolean }) => {
    await runAdopt(options);
  });

program
  .command("inspect")
  .description("Inspect the current Odinfra manifest and selected agents.")
  .option("--project-root <path>", "Project root to inspect.", ".")
  .action(async (options: { projectRoot: string }) => {
    await runInspect(options);
  });

program
  .command("doctor")
  .description("Check whether Odinfra/OpenCode setup files look healthy.")
  .option("--project-root <path>", "Project root to check.", ".")
  .action(async (options: { projectRoot: string }) => {
    await runDoctor(options);
  });

try {
  const argv = process.argv[2] === "--" ? [process.argv[0], process.argv[1], ...process.argv.slice(3)] : process.argv;
  await program.parseAsync(argv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
