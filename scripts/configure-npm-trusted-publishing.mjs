import { spawnSync } from "node:child_process";

const packages = [
  "odinfra",
  "@odinfra/schema",
  "@odinfra/generator",
  "@odinfra/templates",
  "@odinfra/adapter-opencode"
];

const npmCommand = ["npx", "-y", "npm@^11.10.0"];
const trustArgs = [
  "trust",
  "github",
  "--repo",
  "ozkozturk/odinfra",
  "--file",
  "release.yml",
  "--environment",
  "npm",
  "--allow-publish",
  "--yes"
];

console.log("Configuring npm Trusted Publishing for GitHub Actions.");
console.log("Provider: GitHub Actions");
console.log("Repository: ozkozturk/odinfra");
console.log("Workflow: .github/workflows/release.yml");
console.log("Environment: npm");
console.log("");

run([...npmCommand, "whoami"], "You must be logged in to npm before configuring trusted publishers.");

for (const packageName of packages) {
  console.log(`\nConfiguring ${packageName}...`);
  run([...npmCommand, ...trustArgs, packageName], `Failed to configure trusted publishing for ${packageName}.`);
}

console.log("\nTrusted Publishing configuration complete.");

function run(command, failureMessage) {
  const [binary, ...args] = command;
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\n${failureMessage}`);
    process.exit(result.status ?? 1);
  }
}
