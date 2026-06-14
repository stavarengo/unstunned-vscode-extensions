# Dev Commands Reference

Copy-paste ready commands for common development tasks.

Run these from the extension directory (`extensions/reset-sizes`). The same scripts also run recursively from the repo root (`pnpm run build` / `pnpm test`) and per-extension via `pnpm --dir extensions/reset-sizes <script>`.

## Setup

```bash
# Activate pnpm (one-time, via Corepack)
corepack enable pnpm

# Install workspace dependencies
pnpm install

# Type-check + bundle every package
pnpm run build
```

## Development

```bash
# Watch mode - type-checks and re-bundles on file changes
pnpm run watch
```

## Testing

```bash
# Run all tests (pure Node + Mocha; pretest compiles via tsc)
pnpm test
```

## Linting

```bash
# Run ESLint
pnpm run lint
```

## Building

```bash
# Type-check only (no bundle)
pnpm run check

# Type-check + esbuild bundle
pnpm run build
```

## Packaging

```bash
# Build a .vsix for the extension
pnpm run package

# Build the VSIX and install it into local VS Code
pnpm run install-local
```

## Git

```bash
# Check status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "feat: description of change"

# Push to remote
git push origin main
```

## Debugging in VS Code

```
F5                      Launch Extension Development Host
Ctrl+Shift+P            Command Palette (in dev host)
Ctrl+R                  Reload Extension Development Host
Ctrl+Shift+U            Open Output panel
```

## Quick Verification

```bash
# Full verification before commit
pnpm run build && pnpm run lint && pnpm test
```

## Common Workflows

### Make a change and test

```bash
pnpm run watch         # Terminal 1 - keep running
# Open extensions/reset-sizes in VS Code, press F5  # "Run Extension" (preLaunchTask "build")
# Test in dev host
# Ctrl+R to reload after changes
```

### Run tests after changes

```bash
pnpm test              # pretest recompiles via tsc
```

### Prepare for PR

```bash
pnpm run build && pnpm run lint && pnpm test && git status
```

## VS Code Extension Commands

These are the commands the extension provides (not dev commands):

| Command ID | Title | Description |
|------------|-------|-------------|
| `resetSizes.resetAll` | Reset All Sizes | Reset zoom and size settings |

## Environment

| Requirement | Version |
|-------------|---------|
| Node.js | ^18.x |
| VS Code | ^1.74.0 |
| pnpm | activated via Corepack (`corepack enable pnpm`) |
