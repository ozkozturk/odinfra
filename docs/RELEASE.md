# Release Process

Odinfra publishes with npm Trusted Publishing from GitHub Actions. This avoids long-lived `NPM_TOKEN` secrets and lets npm issue short-lived publish credentials from the workflow identity.

## One-Time npm Setup

The npm package owner must run this once from a machine logged in to npm:

```bash
npm login
pnpm release:trust
```

The script configures these packages to trust `ozkozturk/odinfra`, workflow `.github/workflows/release.yml`, environment `npm`, with publish permission:

- `odinfra`
- `@odinfra/schema`
- `@odinfra/generator`
- `@odinfra/templates`
- `@odinfra/adapter-opencode`

Do not add `NPM_TOKEN` unless Trusted Publishing is unavailable.

## Normal Release

1. Add a changeset for user-facing package changes:

   ```bash
   pnpm changeset
   ```

2. Merge or push the versioned release commit to `main`.
3. GitHub Actions runs `Release` in the `npm` environment and publishes unpublished package versions.

The `npm` GitHub environment is restricted to the `main` branch and does not require a manual approval gate. This keeps releases simple while preventing non-main branches from using the trusted publisher environment.

## Verification

Before publishing, CI runs:

```bash
pnpm check
```

`pnpm check` includes linting, formatting, type checking, tests, builds, tarball content checks, CLI smoke tests, and package consumer type checks.
