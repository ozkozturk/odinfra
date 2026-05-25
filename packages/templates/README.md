# @odinfra/templates

Markdown templates for Odinfra-generated agent and command files.

## Usage

```ts
import { renderAgentBody, renderCommandTemplates, renderRoleSystem } from "@odinfra/templates";
```

The package contains pure rendering helpers for agent files, command files, and the shared `ROLE_SYSTEM.md`
instructions document. It does not read or write files.

## Runtime

This package is ESM-only and requires Node.js 20 or newer.
