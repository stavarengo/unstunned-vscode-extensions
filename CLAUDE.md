# CLAUDE.md - AI Agent Context

This file provides context for Claude Code and other AI coding agents working in this repository.

## Project Summary

**Reset Sizes for VS Code** - A VS Code extension that resets all size-related changes (UI zoom, editor font zoom, terminal font zoom, and optionally size-related settings) back to defaults with a single command.

## Quick Reference

```bash
# Development
npm install          # Install dependencies
npm run compile      # Build TypeScript
npm run watch        # Watch mode for development
npm test             # Run tests
npm run lint         # Run ESLint

# Launch extension in VS Code
# Press F5 in VS Code to open Extension Development Host
```

## Repository Structure

```
src/
├── extension.ts              # Entry point - registers command
├── commands/
│   └── resetAllSizes.ts      # Main command implementation
├── types/
│   └── index.ts              # TypeScript interfaces
├── utils/
│   └── index.ts              # Utility functions
└── test/                     # Test suite
```

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Extension entry point, command registration |
| `src/commands/resetAllSizes.ts` | Core command logic |
| `src/utils/index.ts` | Config loading, command execution, settings management |
| `src/types/index.ts` | TypeScript type definitions |
| `package.json` | Extension manifest, contributes commands/settings |

## Architecture

1. **Extension activates** on `resetSizes.resetAll` command
2. **Command reads config** via `getExtensionConfig()` from workspace settings
3. **Preset system** determines which commands/settings to use (zoom, zoomAndSettings, custom)
4. **VS Code commands executed** via `vscode.commands.executeCommand()`
5. **Settings updated** via `WorkspaceConfiguration.update()` across scopes
6. **User feedback** via notifications and output channel

## Coding Conventions

- **TypeScript** with strict mode enabled
- **ES6 target**, CommonJS modules
- **No external runtime dependencies** - only VS Code API
- **Async/await** for asynchronous operations
- **Explicit return types** on functions
- **Descriptive variable names** following camelCase

## Testing policy

> **No `@vscode/test-electron`.** It was removed after a real VS Code Electron
> host crashed during a test run and dumped 42 GB of core to the host's disk.
> All automated tests run as pure Node + Mocha against a local `vscode` shim
> (`src/test/shims/vscode-pkg/`, wired in as a `file:` devDependency).

- **Run tests**: `npm test` (compiles via `pretest`, then plain Mocha against `dist/test/unit/**/*.test.js`).
- **Test location**: `src/test/unit/*.test.ts` (pure Node). No `src/test/suite/` or `runTest.ts`.
- **vscode shim**: `src/test/shims/vscode-pkg/vscode.js` is the in-memory stand-in for the `vscode` module. Test helpers exposed: `_testResetConfigStore`, `_testSetRemoteName`, `_testSetExtensions`, `_testSetWorkspaceFolders`.
- **When a test genuinely needs a real VS Code host** (real `WebviewPanel` lifecycle, command-registry dispatch, actual settings.json writes the shim doesn't simulate): add the scenario to `docs/ai/manual-smoke.md` and run it by hand via `npm run install-local` + Reload Window. Do not reintroduce `@vscode/test-electron`. If you (Claude) cannot test something automatically, ask the user to manually smoke it.
- **VRT**: Playwright + headless Chromium for HTML/CSS verification of `renderPreviewHtml` output. Slice 2's pipeline (browsers under `/opt/playwright-browsers/`) is kept; reuse it instead of reinstalling. Don't use Playwright as a stand-in for VS Code runtime semantics — it can only render HTML/CSS, not simulate `vscode.window.createWebviewPanel`.
- **Lint**: `npm run lint`.

## Common Tasks

### Adding a new configuration option

1. Add property to `package.json` under `contributes.configuration.properties`
2. Add type to `ExtensionConfig` interface in `src/types/index.ts`
3. Update `getExtensionConfig()` in `src/utils/index.ts`
4. Use the config in `resetAllSizes()` command

### Adding a new preset

1. Add enum value in `package.json` for `resetSizes.preset`
2. Add preset config to `PRESET_CONFIGS` in `src/utils/index.ts`
3. Update documentation

### Modifying command behavior

1. Edit `src/commands/resetAllSizes.ts`
2. Update tests in `src/test/unit/resetAllSizes.test.ts`
3. Run `npm test` to verify

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
