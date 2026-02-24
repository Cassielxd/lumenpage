# Changesets Workflow

## 1) Create a changeset

Run:

```bash
pnpm changeset
```

Select changed package(s), choose version bump, and describe the change.

## 2) Apply versioning

Run:

```bash
pnpm changeset:version
```

This updates package versions and changelog files based on `.changeset/*.md`.

## 3) Build and publish

Run:

```bash
pnpm build
pnpm changeset:publish
```

## Notes

- `apps/*` are ignored by changesets: `lumenpage-lumen`, `lumenpage-playground`.
- Only `packages/*` are expected to be versioned/published.
- Pre-commit hook can enforce version/changelog update on each package commit.
- In this repo hook flow, all bumps are normalized to `patch` (minimal increment).
- If `packages/*` changed and no pending changeset exists, hook auto-generates a patch changeset.

## Enable Git Hook

Run once:

```bash
git config core.hooksPath .githooks
```
