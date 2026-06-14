# Architecture

## High-Level Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Extension Host                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              Reset Sizes Extension                  │  │   │
│  │  │                                                     │  │   │
│  │  │   extension.ts ──► commands/resetAllSizes.ts       │  │   │
│  │  │         │                    │                      │  │   │
│  │  │         │                    │                      │  │   │
│  │  │         ▼                    ▼                      │  │   │
│  │  │   types/index.ts      utils/index.ts               │  │   │
│  │  │                                                     │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    VS Code APIs                           │   │
│  │  • vscode.commands.executeCommand()                       │   │
│  │  • vscode.workspace.getConfiguration()                    │   │
│  │  • vscode.window.showInformationMessage()                │   │
│  │  • vscode.window.createOutputChannel()                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### `extensions/reset-sizes/src/extension.ts`

**Role**: Extension entry point

**Responsibilities**:
- Export `activate()` function called by VS Code
- Create output channel for logging
- Register `resetSizes.resetAll` command
- Export `deactivate()` for cleanup (empty)

**Key Code**:
```typescript
export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Reset Sizes');
  const disposable = vscode.commands.registerCommand(
    'resetSizes.resetAll',
    () => resetAllSizes(outputChannel)
  );
  context.subscriptions.push(disposable, outputChannel);
}
```

### `extensions/reset-sizes/src/commands/resetAllSizes.ts`

**Role**: Main command implementation

**Responsibilities**:
- Orchestrate the reset flow
- Execute configured VS Code commands
- Reset settings across scopes
- Handle user confirmation dialogs
- Show notifications and reload prompts

**Key Flow**:
1. Get configuration via `getExtensionConfig()`
2. Execute each command in `commands` array
3. If `settingsToReset` has items, prompt user
4. Reset settings via `updateSettingAcrossScopes()`
5. Show summary notification
6. Prompt for reload if needed

### `extensions/reset-sizes/src/utils/index.ts`

**Role**: Utility functions

**Key Exports**:

| Function | Purpose |
|----------|---------|
| `getExtensionConfig()` | Read configuration from workspace settings |
| `executeVSCodeCommand()` | Execute a VS Code command with error handling |
| `updateSettingAcrossScopes()` | Remove a setting from multiple scopes |
| `showConfirmationDialog()` | Modal dialog for user confirmation |
| `showReloadPrompt()` | Prompt user to reload window |
| `PRESET_CONFIGS` | Preset definitions (zoom, zoomAndSettings, custom) |

### `extensions/reset-sizes/src/types/index.ts`

**Role**: TypeScript type definitions

**Key Types**:

```typescript
interface ExtensionConfig {
  preset: 'zoom' | 'zoomAndSettings' | 'custom';
  commands: string[];
  settingsToReset: string[];
  scopes: ('user' | 'workspace' | 'workspaceFolder')[];
  promptBeforeReset: boolean;
  reloadAfter: 'never' | 'prompt' | 'always';
  showSummaryNotification: boolean;
}

interface ResetAllSizesResult {
  commandsExecuted: number;
  commandsFailed: number;
  settingsReset: number;
  settingsFailed: number;
}
```

## Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   package   │────►│ getExtension    │────►│  ExtensionConfig │
│    .json    │     │    Config()     │     │                  │
└─────────────┘     └─────────────────┘     └────────┬─────────┘
                                                      │
                                                      ▼
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  VS Code    │◄────│ executeVSCode   │◄────│  commands[]      │
│  Commands   │     │   Command()     │     │                  │
└─────────────┘     └─────────────────┘     └──────────────────┘
                                                      │
                                                      ▼
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ settings    │◄────│ updateSetting   │◄────│ settingsToReset[]│
│   .json     │     │ AcrossScopes()  │     │                  │
└─────────────┘     └─────────────────┘     └──────────────────┘
```

## Preset System

The preset system is defined in `PRESET_CONFIGS`:

```typescript
const PRESET_CONFIGS = {
  zoom: {
    commands: [
      'workbench.action.zoomReset',
      'editor.action.fontZoomReset',
      'workbench.action.terminal.fontZoomReset'
    ],
    settingsToReset: []
  },
  zoomAndSettings: {
    commands: [...zoom.commands],
    settingsToReset: [
      'window.zoomLevel',
      'editor.fontSize',
      'editor.lineHeight',
      'terminal.integrated.fontSize',
      'terminal.integrated.lineHeight'
    ]
  },
  custom: {
    // Uses user-defined values
  }
};
```

## Error Handling

Errors are handled gracefully:

1. **Command execution**: Wrapped in try/catch, returns boolean success
2. **Settings update**: Checks scope availability, handles write failures
3. **Terminal missing**: Expected failure, logged but not shown as error
4. **User cancels**: Tracked separately, commands still execute

## Extension Lifecycle

```
VS Code starts
       │
       ▼
Reads package.json
       │
       ▼
Sees activationEvents: ["onCommand:resetSizes.resetAll"]
       │
       ▼
(Extension NOT loaded yet - lazy activation)
       │
       ▼
User runs "Reset All Sizes" command
       │
       ▼
VS Code calls activate(context)
       │
       ▼
Extension registers command handler
       │
       ▼
Command handler runs resetAllSizes()
       │
       ▼
(Extension stays active until VS Code closes)
```

## Build Architecture

The extension is built two ways depending on the goal:

- **Bundle** (`pnpm run build`): `esbuild.mjs` bundles `src/extension.ts` into `dist/extension.js`, with `vscode` marked external. This is the artifact shipped in the `.vsix`.
- **Type-check + emit for tests**: `tsc` still type-checks the whole tree and emits the full compiled tree into `dist/` so the unit tests have plain `.js` to run. `pnpm run check` runs the solution type-check (`tsc -b`) with no bundle.

## Testing Architecture

```
extensions/reset-sizes/src/test/
├── unit/                # Pure-Node Mocha tests (e.g. resetAllSizes.test.ts, utils.test.ts, types.test.ts)
└── shims/
    └── vscode-pkg/      # In-memory `vscode` stand-in, wired as a file: devDependency
```

Tests run as plain Node + Mocha against `dist/test/unit/**/*.test.js` (compiled from `src/test/unit/*.test.ts` by the `pretest` tsc step). There is no `@vscode/test-electron` and no VS Code host — the `vscode` module resolves to the in-memory shim under `src/test/shims/vscode-pkg/`, which exposes test helpers (`_testResetConfigStore`, `_testSetRemoteName`, `_testSetExtensions`, `_testSetWorkspaceFolders`) to isolate functionality.
