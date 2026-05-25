# @odinfra/schema

Shared TypeScript schema, role defaults, and permission presets for Odinfra packages.

## Usage

```ts
import { createDefaultAgents, getPermissionForRole, odinfraConfigSchema } from "@odinfra/schema";
```

`ODINFRA_SCHEMA_VERSION` is the generated config and manifest schema version. It is not the CLI package version.

## Runtime

This package is ESM-only and requires Node.js 20 or newer.
