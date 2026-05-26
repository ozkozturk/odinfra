# Odinfra

Odinfra installs governed, role-based AI subagent setups into existing projects.

v0 is a TypeScript CLI that generates safe OpenCode-compatible files from a tool-agnostic internal schema. It does not run agents, call models, or provide a hosted runtime.

## Install

Run the CLI with your package manager of choice:

```bash
pnpm dlx odinfra init
npx odinfra init
yarn dlx odinfra init
bunx odinfra init
```

The published binary is `odinfra` and requires Node.js 20 or newer.

## Usage

Initialize a project with safe defaults:

```bash
odinfra init --yes
```

Preview the file plan without writing files:

```bash
odinfra init --dry-run --yes
```

Generate optional OpenCode command files:

```bash
odinfra init --yes --commands
```

Inspect or validate an existing setup:

```bash
odinfra inspect
odinfra doctor
```

Regenerate, reconfigure, or adopt an existing project safely:

```bash
odinfra update --dry-run
odinfra configure --agent researcher --model opencode-go/kimi-k2.6 --dry-run
odinfra adopt
```

## Generated File Contract

Odinfra may create or update the following files:

```txt
AGENTS.md
opencode.json or opencode.jsonc
.opencode/agents/*.md
.opencode/commands/*.md
.odinfra/config.json
.odinfra/manifest.json
```

Existing user content is preserved. `AGENTS.md` is updated through an Odinfra-managed block, and OpenCode JSON config is deep-merged. If both `opencode.json` and `opencode.jsonc` exist, Odinfra updates `opencode.json` and leaves `opencode.jsonc` untouched.

Repeated runs are intended to be idempotent: generated files are rewritten only when their expected content changes, and user-owned content outside Odinfra-managed blocks remains in place.

Generated file metadata is tracked in `.odinfra/manifest.json` with content hashes and package/template versions. Fully generated files that differ from the last Odinfra-managed hash are reported as `user-modified` so updates do not silently overwrite local changes.

`odinfra adopt` is read-only. It analyzes project structure, package manager signals, existing rules/workflows/skills, and agent/tool files, then prints an adoption plan and LLM prompt without writing files.

## Packages

- `odinfra`: CLI-only package.
- `@odinfra/schema`: shared schema, role defaults, and permission presets.
- `@odinfra/templates`: Markdown templates for generated agents and commands.
- `@odinfra/adapter-opencode`: renderer for OpenCode-compatible artifacts.
- `@odinfra/generator`: file plan and write helpers used by the CLI.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
pnpm dev -- init --dry-run --yes
pnpm dev -- adopt
```

`pnpm check` runs linting, formatting checks, type checking, tests, build, and package smoke checks.

## Release

This repo uses Changesets. Add a changeset for user-facing package changes with `pnpm changeset`, then merge the generated release PR. Publishing is handled by GitHub Actions with npm Trusted Publishing.
