# @odinfra/generator

File-plan and write helpers for Odinfra-managed project files.

## Usage

```ts
import { createFilePlan, formatFilePlan, writeFilePlan } from "@odinfra/generator";
```

`createFilePlan` produces a dry-run friendly plan before any files are written. `writeFilePlan` writes only create/update actions from that plan.

## Runtime

This package is ESM-only and requires Node.js 20 or newer.
