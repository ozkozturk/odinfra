# @odinfra/generator

File-plan and write helpers for Odinfra-managed project files.

## Usage

```ts
import {
  analyzeProject,
  createFilePlan,
  detectPackageManager,
  formatFilePlan,
  writeFilePlan
} from "@odinfra/generator";
```

`createFilePlan` produces a dry-run friendly plan before any files are written. `writeFilePlan` writes only create/update actions from that plan.
Generated-file hashes in the manifest allow callers to detect user-modified files before applying template updates.

`detectPackageManager` and `analyzeProject` power read-only adoption flows for npm, pnpm, yarn, and bun projects.

## Runtime

This package is ESM-only and requires Node.js 20 or newer.
