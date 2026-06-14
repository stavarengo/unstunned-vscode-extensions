# VS Code Extensions Monorepo

A pnpm workspace that houses VS Code extensions (and any shared internal packages they grow into).

## Layout

```text
extensions/
  reset-sizes/        # "Reset Sizes" extension — resets UI/editor/terminal zoom & size settings
packages/             # (reserved) shared internal packages, bundled into extensions
```

## Prerequisites

This repo pins pnpm via Corepack (the `packageManager` field in the root `package.json`). With a recent Node:

```bash
corepack enable pnpm
```

## Common commands (from the repo root)

```bash
pnpm install          # install all workspace deps
pnpm run build        # build every package (type-check + bundle)
pnpm test             # run each package's tests
pnpm run lint         # lint every package
pnpm run package      # build a .vsix for every extension
```

Per-extension work runs in that extension's folder, e.g.:

```bash
pnpm --dir extensions/reset-sizes run build
pnpm --dir extensions/reset-sizes test
pnpm --dir extensions/reset-sizes run package
```

See `extensions/reset-sizes/README.md` for the extension's own docs.
