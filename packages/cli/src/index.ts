import { Command } from "commander";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runInspect } from "./commands/inspect.js";

const program = new Command();

program.name("odinfra").description("Install governed AI subagent setup files into a project.").version("0.1.0");

program
  .command("init")
  .description("Generate or update Odinfra-managed OpenCode subagent files.")
  .option("--project-root <path>", "Project root to update.", ".")
  .option("--dry-run", "Print the file plan without writing files.", false)
  .option("--yes", "Use safe defaults and skip prompts.", false)
  .option("--commands", "Generate optional Odinfra command files.", false)
  .action(async (options: { projectRoot: string; dryRun: boolean; yes: boolean; commands: boolean }) => {
    await runInit(options);
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
