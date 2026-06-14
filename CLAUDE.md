# CLAUDE.md — Workspace

pnpm workspace monorepo for VS Code extensions. This file covers the **workspace**;
each extension carries its own `CLAUDE.md` with the detail.

## Layout

```
package.json          # workspace root: recursive scripts + packageManager pin
pnpm-workspace.yaml   # workspace globs: extensions/*, packages/*
tsconfig.base.json    # shared compiler options
tsconfig.json         # solution-style root (tsc -b)
.npmrc                # pnpm config
extensions/
└── reset-sizes/      # "Reset Sizes" extension (self-contained: src, configs,
                      #   docs/, CLAUDE.md, AGENTS.md, TESTING.md, .vscode/)
packages/             # (reserved) shared internal packages, bundled into extensions
```

## Package manager

pnpm, pinned via Corepack (`packageManager` in the root `package.json`). One-time:

```bash
corepack enable pnpm
```

## Commands (from the repo root — scripts are recursive over the workspace)

```bash
pnpm install        # install all workspace deps
pnpm run build      # type-check + esbuild bundle every package
pnpm test           # run every package's tests
pnpm run lint       # lint every package
pnpm run check      # tsc -b solution type-check
pnpm run package    # build a .vsix for every extension
```

Per-extension work: `pnpm --dir extensions/<name> run <script>`, or `cd` into the
extension and run the plain script.

## Working on an extension

Read that extension's own context files, e.g. for Reset Sizes:
`extensions/reset-sizes/CLAUDE.md` (architecture, conventions, testing policy),
`extensions/reset-sizes/AGENTS.md`, and `extensions/reset-sizes/docs/`.
