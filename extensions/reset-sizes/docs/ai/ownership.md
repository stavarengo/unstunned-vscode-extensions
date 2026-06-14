# Module Ownership Map

This document maps each module to its purpose and the files that need to change for common modifications.

## Source Code Modules

### Extension Entry Point

| File | Purpose |
|------|---------|
| `src/extension.ts` | Activation, command registration, output channel creation |

**When to modify**:
- Adding new commands to the extension
- Changing activation events
- Adding new output channels or resources

---

### Commands

| File | Purpose |
|------|---------|
| `src/commands/resetAllSizes.ts` | Main reset command implementation |

**When to modify**:
- Changing the reset workflow
- Adding new steps to the reset process
- Modifying user prompts or notifications

---

### Utilities

| File | Purpose |
|------|---------|
| `src/utils/index.ts` | Shared utility functions |

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
| `src/types/index.ts` | TypeScript interfaces and types |

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
| `src/test/unit/*.test.ts` | Pure-Node Mocha tests (e.g. `resetAllSizes.test.ts`, `utils.test.ts`, `types.test.ts`) |
| `src/test/shims/vscode-pkg/` | In-memory `vscode` shim used by the tests (wired as a `file:` devDependency) |

**When to modify**:
- Adding tests for new features
- Fixing failing tests
- Adding new test files

---

## Configuration Files

### Extension Manifest

| File | Purpose |
|------|---------|
| `package.json` | Extension metadata, commands, configuration schema, pnpm scripts |

Workspace-level files (root `package.json` recursive scripts, `pnpm-workspace.yaml`) live at the monorepo root — see the root `CLAUDE.md`.

**Key sections**:
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
| `tsconfig.json` | Extension TypeScript compiler settings; extends `../../tsconfig.base.json` |

Shared/solution compiler config (`tsconfig.base.json`, the root solution `tsconfig.json`) lives at the monorepo root — see the root `CLAUDE.md`.

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
| `README.md` | User-facing extension documentation (Marketplace) |
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

1. `package.json` - Add to `contributes.configuration.properties`
2. `src/types/index.ts` - Add to `ExtensionConfig` interface
3. `src/utils/index.ts` - Update `getExtensionConfig()` to read it
4. `src/commands/resetAllSizes.ts` - Use the new option
5. `src/test/unit/utils.test.ts` - Add tests
6. `README.md` - Document the option

### Adding a New Preset

1. `package.json` - Add to `resetSizes.preset` enum
2. `src/utils/index.ts` - Add to `PRESET_CONFIGS`
3. `README.md` - Document the preset
4. `TESTING.md` - Add test scenario

### Adding a New Command

1. `package.json` - Add to `contributes.commands`
2. `package.json` - Add to `activationEvents`
3. `src/extension.ts` - Register the command
4. `src/commands/` - Create new command file
5. Add tests
6. Update documentation

### Fixing a Bug

1. Identify the relevant module from this map
2. Write a failing test that reproduces the bug
3. Fix the bug
4. Verify all tests pass
5. Update documentation if behavior changed
