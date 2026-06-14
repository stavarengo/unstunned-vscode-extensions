# CLAUDE.md - AI Agent Context

This file provides context for Claude Code and other AI coding agents working in this repository.

## Project Summary

**Reset Sizes for VS Code** - A VS Code extension that resets all size-related changes (UI zoom, editor font zoom, terminal font zoom, and optionally size-related settings) back to defaults with a single command.

## Quick Reference

```bash
# Development (run from repo root; scripts are recursive over the workspace)
corepack enable pnpm # One-time: activate the pinned pnpm
pnpm install         # Install all workspace dependencies
pnpm run build       # Type-check (tsc) + esbuild bundle every package
pnpm run watch       # Watch mode for extensions
pnpm test            # Run tests (pretest compiles via tsc)
pnpm run lint        # Run ESLint
pnpm run check       # tsc -b solution type-check (no bundle)
pnpm run package     # Build a .vsix for every extension

# Work on a single extension (from repo root)
pnpm --dir extensions/reset-sizes run build
pnpm --dir extensions/reset-sizes test

# Launch extension in VS Code
# Press F5 (root .vscode/launch.json runs preLaunchTask build:reset-sizes,
# then opens the Extension Development Host for extensions/reset-sizes)
```

## Repository Structure

This is a pnpm workspace monorepo. The root holds workspace files; each VS Code
extension is a self-contained package under `extensions/`.

```
package.json                  # Workspace root (recursive scripts, packageManager)
pnpm-workspace.yaml           # Workspace globs: extensions/*, packages/*
tsconfig.base.json            # Shared compiler options
tsconfig.json                 # Solution-style root (tsc -b)
.npmrc                        # pnpm config
README.md
extensions/
└── reset-sizes/              # The "Reset Sizes" extension (self-contained)
    ├── package.json          # Extension manifest, contributes commands/settings
    ├── tsconfig.json
    ├── esbuild.mjs           # Bundles src/extension.ts -> dist/extension.js
    ├── .mocharc.json
    ├── .vscodeignore
    ├── .eslintrc.json
    ├── images/
    ├── scripts/
    ├── test-fixtures/
    ├── src/
    │   ├── extension.ts          # Entry point - registers command
    │   ├── commands/
    │   │   └── resetAllSizes.ts  # Main command implementation
    │   ├── preview/              # Preview panel + HTML rendering
    │   ├── types/
    │   │   └── index.ts          # TypeScript interfaces
    │   ├── utils/
    │   │   └── index.ts          # Utility functions
    │   └── test/                 # Test suite
    └── dist/                 # Build output (esbuild bundle + tsc-emitted tree)
packages/                     # Shared workspace packages (currently none)
```

## Key Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Workspace package globs (root) |
| `tsconfig.base.json` | Shared compiler options (root) |
| `tsconfig.json` | Solution-style root tsconfig for `tsc -b` (root) |
| `extensions/reset-sizes/src/extension.ts` | Extension entry point, command registration |
| `extensions/reset-sizes/src/commands/resetAllSizes.ts` | Core command logic |
| `extensions/reset-sizes/src/utils/index.ts` | Config loading, command execution, settings management |
| `extensions/reset-sizes/src/types/index.ts` | TypeScript type definitions |
| `extensions/reset-sizes/esbuild.mjs` | esbuild bundler (`src/extension.ts` -> `dist/extension.js`, `vscode` external) |
| `extensions/reset-sizes/package.json` | Extension manifest, contributes commands/settings |

## Architecture

1. **Extension activates** on `resetSizes.resetAll` command
2. **Command reads config** via `getExtensionConfig()` from workspace settings
3. **Preset system** determines which commands/settings to use (zoom, zoomAndSettings, custom)
4. **VS Code commands executed** via `vscode.commands.executeCommand()`
5. **Settings updated** via `WorkspaceConfiguration.update()` across scopes
6. **User feedback** via notifications and output channel

## Coding Conventions

- **TypeScript** with strict mode enabled
- **ES2022 target** (shared via `tsconfig.base.json`), CommonJS modules
- **No external runtime dependencies** - only VS Code API
- **Async/await** for asynchronous operations
- **Explicit return types** on functions
- **Descriptive variable names** following camelCase

## Testing policy

> **No `@vscode/test-electron`.** It was removed after a real VS Code Electron
> host crashed during a test run and dumped 42 GB of core to the host's disk.
> All automated tests run as pure Node + Mocha against a local `vscode` shim
> (`extensions/reset-sizes/src/test/shims/vscode-pkg/`, wired in as a `file:`
> devDependency relative to the extension's `package.json`).

- **Build system**: the extension ships as an esbuild bundle (`esbuild.mjs` bundles `src/extension.ts` -> `dist/extension.js` with `vscode` marked external). TypeScript (`tsc`) is still used to type-check AND emit the full source tree that the unit tests run against. There is no longer an `npm run compile`; use `pnpm run build` (type-check + bundle) or `pnpm run check` (type-check only).
- **Run tests**: `pnpm test` from the repo root (or `pnpm --dir extensions/reset-sizes test`). `pretest` compiles via `tsc`, then plain Mocha runs against `dist/test/unit/**/*.test.js`.
- **Test location**: `extensions/reset-sizes/src/test/unit/*.test.ts` (pure Node). No `src/test/suite/` or `runTest.ts`.
- **vscode shim**: `extensions/reset-sizes/src/test/shims/vscode-pkg/vscode.js` is the in-memory stand-in for the `vscode` module. Test helpers exposed: `_testResetConfigStore`, `_testSetRemoteName`, `_testSetExtensions`, `_testSetWorkspaceFolders`.
- **When a test genuinely needs a real VS Code host** (real `WebviewPanel` lifecycle, command-registry dispatch, actual settings.json writes the shim doesn't simulate): add the scenario to `docs/ai/manual-smoke.md` and run it by hand via `pnpm --dir extensions/reset-sizes run install-local` + Reload Window. Do not reintroduce `@vscode/test-electron`. If you (Claude) cannot test something automatically, ask the user to manually smoke it.
- **VRT**: Playwright + headless Chromium for HTML/CSS verification of `renderPreviewHtml` output. Slice 2's pipeline (browsers under `/opt/playwright-browsers/`) is kept; reuse it instead of reinstalling. Don't use Playwright as a stand-in for VS Code runtime semantics — it can only render HTML/CSS, not simulate `vscode.window.createWebviewPanel`.
- **Lint**: `pnpm run lint`.

## Common Tasks

### Adding a new configuration option

1. Add property to `extensions/reset-sizes/package.json` under `contributes.configuration.properties`
2. Add type to `ExtensionConfig` interface in `extensions/reset-sizes/src/types/index.ts`
3. Update `getExtensionConfig()` in `extensions/reset-sizes/src/utils/index.ts`
4. Use the config in `resetAllSizes()` command

### Adding a new preset

1. Add enum value in `extensions/reset-sizes/package.json` for `resetSizes.preset`
2. Add preset config to `PRESET_CONFIGS` in `extensions/reset-sizes/src/utils/index.ts`
3. Update documentation

### Modifying command behavior

1. Edit `extensions/reset-sizes/src/commands/resetAllSizes.ts`
2. Update tests in `extensions/reset-sizes/src/test/unit/resetAllSizes.test.ts`
3. Run `pnpm test` to verify

## Important Notes

- **Zero external dependencies** - keeps extension lightweight
- **Graceful error handling** - commands may fail (e.g., no terminal open)
- **Multi-scope support** - settings can be reset at user/workspace/folder level
- **VS Code API version** - minimum 1.74.0

## AI Documentation

For detailed AI-focused documentation, see:
- `docs/ai/overview.md` - System overview
- `docs/ai/setup.md` - Development setup
- `docs/ai/architecture.md` - Architecture details
- `docs/ai/conventions.md` - Coding conventions
- `docs/ai/ownership.md` - Module ownership
- `docs/ai/commands.md` - Dev commands reference

## Claude Code Commands

Custom commands available via `.claude/commands/`:
- `/plan` - Create implementation plan
- `/implement` - Execute plan step-by-step
- `/review` - Code review checklist
- `/update-ai-docs` - Sync AI documentation
