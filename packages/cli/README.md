# odinfra

CLI for installing governed, role-based AI subagent setup files into existing projects.

## Usage

```bash
npx odinfra init --dry-run --yes
npx odinfra init --yes --commands
npx odinfra inspect
npx odinfra doctor
```

The package is intentionally CLI-only. It does not expose a supported JavaScript import API.

## Generated Files

Odinfra writes OpenCode-compatible files, an Odinfra manifest, and an Odinfra-managed block in `AGENTS.md`. User-owned content outside managed blocks is preserved.
