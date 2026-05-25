# Contributing

Thanks for helping improve Odinfra.

## Local Setup

```bash
pnpm install
pnpm check
```

`pnpm check` runs linting, formatting checks, type checking, tests, build, and package smoke checks.

## Changesets

Create a changeset for every user-facing package change:

```bash
pnpm changeset
```

Use patch changes for bug fixes, package metadata changes, and documentation that ships with a package. Use minor changes for new public behavior.

## Pull Requests

Keep changes focused, update tests when behavior changes, and include generated package or release metadata only when the workflow requires it. Do not commit `dist`, `node_modules`, coverage output, or local agent configuration.
