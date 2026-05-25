# Odinfra

Odinfra installs governed, role-based AI subagent setups into existing projects.

v0 is a TypeScript CLI that generates safe OpenCode-compatible files from a tool-agnostic internal schema. It does not run agents or provide a hosted runtime.

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm dev -- init --dry-run --yes
```

The published CLI binary is `odinfra`.

## Generated Files

```txt
AGENTS.md
opencode.json or opencode.jsonc
.opencode/agents/*.md
.opencode/commands/*.md
.odinfra/config.json
.odinfra/manifest.json
```

Existing user content is preserved. `AGENTS.md` is updated through an Odinfra-managed block, and OpenCode JSON config is deep-merged.
