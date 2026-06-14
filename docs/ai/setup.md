# Development Setup

## Prerequisites

- **Node.js**: 18.x or higher
- **pnpm**: Activated via Corepack (pinned in the root `package.json`)
- **VS Code**: Latest stable version
- **Git**: For version control

## Initial Setup

This repo is a pnpm workspace monorepo. The "Reset Sizes" extension lives at `extensions/reset-sizes/`.

```bash
# Clone the repository
git clone https://github.com/stavarengo/vscode-reset-ui-sizes-extension.git
cd vscode-reset-ui-sizes-extension

# Activate pnpm (one-time, via Corepack)
corepack enable pnpm

# Install dependencies for the whole workspace
pnpm install

# Type-check + bundle every package
pnpm run build
```

## Development Workflow

### 1. Start Watch Mode

```bash
pnpm run watch
```

This type-checks and re-bundles on every file change. Keep this running in a terminal.

### 2. Launch Extension Development Host

In VS Code:
1. Press `F5` (or Run > Start Debugging)
2. The "Run reset-sizes" configuration launches the extension from `extensions/reset-sizes` (it runs the `build:reset-sizes` preLaunchTask first)
3. A new VS Code window opens with your extension loaded

### 3. Test Your Changes

In the Extension Development Host window:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type "Reset All Sizes"
3. Press Enter
4. Check the "Reset Sizes" output channel for logs

### 4. Run Automated Tests

```bash
pnpm test
```

Tests are pure Node + Mocha against the compiled output in `dist/test/unit/**/*.test.js` (the `pretest` step compiles via `tsc`). They run against an in-memory `vscode` shim, not a real VS Code host — there is no VS Code test instance and no `@vscode/test-electron`.

## Common Commands

| Command | Purpose |
|---------|---------|
| `corepack enable pnpm` | One-time, activate pnpm |
| `pnpm install` | Install workspace dependencies |
| `pnpm run check` | Type-check only (`tsc -b`, no bundle) |
| `pnpm run build` | Type-check + esbuild bundle every package |
| `pnpm run watch` | Watch mode (type-check + bundle) |
| `pnpm test` | Run test suite |
| `pnpm run lint` | Run ESLint |

## Environment Variables

**None required.** This extension uses only VS Code APIs and has no external service dependencies.

## Secrets/Credentials

**None required.** The extension manipulates local VS Code settings only.

## Common Gotchas

### 1. "Cannot find module" errors

**Cause**: TypeScript not built
**Fix**: Run `pnpm run build` or start `pnpm run watch`

### 2. Extension not loading changes

**Cause**: Need to reload Extension Development Host
**Fix**: Press `Ctrl+R` in the Extension Development Host window, or close and press F5 again

### 3. Tests fail after source changes

**Cause**: Stale compiled output in `dist/`
**Fix**: Re-run `pnpm test` (its `pretest` step recompiles via `tsc`)

### 4. Terminal font zoom reset "fails"

**Expected behavior**: If no terminal is open, the command fails gracefully. This is normal.

### 5. Settings don't seem to change

**Cause**: Looking at wrong scope (user vs workspace)
**Fix**: Check the correct settings.json file for the configured scope

## Debug Configurations

The root `.vscode/launch.json` includes one configuration:

- **Run reset-sizes**: Launch the Extension Development Host with the extension loaded from `extensions/reset-sizes` (runs the `build:reset-sizes` preLaunchTask first)

Tests are not run through the VS Code test host; use `pnpm test` from the terminal.

## Output Locations

| Output | Location |
|--------|----------|
| Bundled/compiled JS | `extensions/reset-sizes/dist/` |
| Test output | Console (Mocha) |
| Extension logs | "Reset Sizes" output channel in VS Code |

## Building for Distribution

```bash
# Type-check + bundle
pnpm --dir extensions/reset-sizes run build

# Package as .vsix
pnpm --dir extensions/reset-sizes run package
```

The `.vsix` file can be installed manually or published to the VS Code Marketplace.
