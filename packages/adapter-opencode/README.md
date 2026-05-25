# @odinfra/adapter-opencode

Renderer that converts Odinfra agent configuration into OpenCode-compatible artifacts.

## Usage

```ts
import { renderOpenCodeArtifacts } from "@odinfra/adapter-opencode";
```

The adapter returns config patches, managed `AGENTS.md` content, the generated `.opencode/ROLE_SYSTEM.md`
artifact, agent files, and optional command files. It does not write to disk.

## Runtime

This package is ESM-only and requires Node.js 20 or newer.
