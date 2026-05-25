# Changesets

Create a changeset for every user-facing package change:

```bash
pnpm changeset
```

Merge the generated release PR to publish packages from GitHub Actions.

Use `pnpm release` or `pnpm release:check` to run local validation and inspect
pending changesets. `pnpm release:publish` is the publish command used by CI; it
only publishes package versions that are not already on npm.

The npm packages should use Trusted Publishing for `.github/workflows/release.yml`
with the `npm` environment so releases do not require a long-lived npm token.
