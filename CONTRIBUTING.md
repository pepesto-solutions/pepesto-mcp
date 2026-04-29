# Contributing

## Releases

This project uses `semantic-release`.

Releases are created automatically from commits merged into `main`.

Do not manually change the version in `package.json`.

## Commit Format

Use Conventional Commits.

Patch release:

```bash
fix: correct input validation
```

Minor release:

```bash
feat: add config option
```

Major release:

```bash
feat!: remove legacy API
```

Or:

```text
BREAKING CHANGE: old API removed
```

Other common types:

```bash
docs: docs changes
chore: maintenance
refactor: internal cleanup
test: tests
ci: workflow changes
```

## Testing

Use the GitHub Actions dry-run workflow to preview releases without publishing.