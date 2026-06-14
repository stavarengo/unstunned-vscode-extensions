# Module Ownership Map

This document maps each module to its purpose and the files that need to change for common modifications.

## Source Code Modules

### Extension Entry Point

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/src/extension.ts` | Activation, command registration, output channel creation |

**When to modify**:
- Adding new commands to the extension
- Changing activation events
- Adding new output channels or resources

---

### Commands

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/src/commands/resetAllSizes.ts` | Main reset command implementation |

**When to modify**:
- Changing the reset workflow
- Adding new steps to the reset process
- Modifying user prompts or notifications

---

### Utilities

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/src/utils/index.ts` | Shared utility functions |

**Contents**:
- `getExtensionConfig()` - Configuration loading
- `executeVSCodeCommand()` - Command execution wrapper
- `updateSettingAcrossScopes()` - Settings management
- `showConfirmationDialog()` - User confirmation
- `showReloadPrompt()` - Reload prompt
- `PRESET_CONFIGS` - Preset definitions

**When to modify**:
- Adding new configuration options
- Adding new presets
- Changing how settings are updated
- Adding new utility functions

---

### Types

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/src/types/index.ts` | TypeScript interfaces and types |

**Contents**:
- `ExtensionConfig` - Configuration shape
- `ResetAllSizesResult` - Command result shape
- `ConfigScope` - Scope type union

**When to modify**:
- Adding new configuration options
- Changing the result structure
- Adding new type definitions

---

### Tests

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/src/test/unit/*.test.ts` | Pure-Node Mocha tests (e.g. `resetAllSizes.test.ts`, `utils.test.ts`, `types.test.ts`) |
| `extensions/reset-sizes/src/test/shims/vscode-pkg/` | In-memory `vscode` shim used by the tests (wired as a `file:` devDependency) |

**When to modify**:
- Adding tests for new features
- Fixing failing tests
- Adding new test files

---

## Configuration Files

### Extension Manifest

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/package.json` | Extension metadata, commands, configuration schema |
| `package.json` (root) | pnpm workspace root; recursive scripts (`build`, `test`, `lint`, `check`, `package`), `packageManager` pin |
| `pnpm-workspace.yaml` (root) | Declares workspace package membership |

**Key sections** (extension `package.json`):
- `contributes.commands` - Registered commands
- `contributes.configuration` - Settings schema
- `activationEvents` - When extension loads
- `scripts` - pnpm scripts

**When to modify**:
- Adding new commands
- Adding new configuration options
- Changing extension metadata
- Adding dependencies

---

### TypeScript Config

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/tsconfig.json` | Extension TypeScript compiler settings |
| `tsconfig.base.json` (root) | Shared compiler options extended by each package |
| `tsconfig.json` (root) | Solution config referencing the workspace packages (`tsc -b`) |

**When to modify**:
- Changing target ES version
- Adding compiler options
- Modifying path mappings

---

### VS Code Integration

| File | Purpose |
|------|---------|
| `.vscode/launch.json` | Debug configurations |
| `.vscode/tasks.json` | Build tasks |
| `.vscode/settings.json` | Editor settings |

**When to modify**:
- Adding new debug configurations
- Adding new build tasks

---

## Documentation

| File | Purpose |
|------|---------|
| `extensions/reset-sizes/README.md` | User-facing extension documentation (Marketplace) |
| `README.md` (root) | Workspace/monorepo overview |
| `TESTING.md` | Manual test scenarios |
| `CLAUDE.md` | AI agent context |
| `AGENTS.md` | Sub-agent definitions |
| `docs/ai/*.md` | Detailed AI documentation |

**When to modify**:
- After adding/changing features
- When configuration options change
- When behavior changes

---

## Common Change Patterns

### Adding a New Configuration Option

1. `extensions/reset-sizes/package.json` - Add to `contributes.configuration.properties`
2. `extensions/reset-sizes/src/types/index.ts` - Add to `ExtensionConfig` interface
3. `extensions/reset-sizes/src/utils/index.ts` - Update `getExtensionConfig()` to read it
4. `extensions/reset-sizes/src/commands/resetAllSizes.ts` - Use the new option
5. `extensions/reset-sizes/src/test/unit/utils.test.ts` - Add tests
6. `extensions/reset-sizes/README.md` - Document the option

### Adding a New Preset

1. `extensions/reset-sizes/package.json` - Add to `resetSizes.preset` enum
2. `extensions/reset-sizes/src/utils/index.ts` - Add to `PRESET_CONFIGS`
3. `extensions/reset-sizes/README.md` - Document the preset
4. `TESTING.md` - Add test scenario

### Adding a New Command

1. `extensions/reset-sizes/package.json` - Add to `contributes.commands`
2. `extensions/reset-sizes/package.json` - Add to `activationEvents`
3. `extensions/reset-sizes/src/extension.ts` - Register the command
4. `extensions/reset-sizes/src/commands/` - Create new command file
5. Add tests
6. Update documentation

### Fixing a Bug

1. Identify the relevant module from this map
2. Write a failing test that reproduces the bug
3. Fix the bug
4. Verify all tests pass
5. Update documentation if behavior changed
