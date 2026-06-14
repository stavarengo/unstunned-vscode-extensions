# System Overview

**Reset Sizes for VS Code** is a lightweight VS Code extension that provides a single command to reset all size-related UI changes back to defaults.

## Problem Solved

VS Code has multiple ways to adjust sizes:
- UI zoom (Ctrl/Cmd + +/-)
- Editor font zoom (Ctrl + mouse wheel in editor)
- Terminal font zoom (Ctrl + mouse wheel in terminal)
- Settings: `editor.fontSize`, `terminal.integrated.fontSize`, `window.zoomLevel`, etc.

Users often accidentally change these or want to quickly reset everything for screenshots, screen sharing, or troubleshooting. This extension provides a single command to reset all of them.

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    User triggers command                      │
│                   "Reset All Sizes" (Ctrl+Shift+P)           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Load Configuration                         │
│  - Read preset (zoom, zoomAndSettings, custom)               │
│  - Get commands list and settings list                        │
│  - Get scopes (user, workspace, workspaceFolder)             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  Execute VS Code Commands                     │
│  - workbench.action.zoomReset                                │
│  - editor.action.fontZoomReset                               │
│  - workbench.action.terminal.fontZoomReset                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              Reset Settings (if configured)                   │
│  - Show confirmation dialog (optional)                        │
│  - Remove custom values from specified scopes                 │
│  - VS Code reverts to built-in defaults                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    User Feedback                              │
│  - Show summary notification                                  │
│  - Log to output channel                                      │
│  - Prompt for reload (if settings changed)                   │
└──────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Presets

Three preset modes control behavior:

| Preset | Commands | Settings | Use Case |
|--------|----------|----------|----------|
| `zoom` | 3 zoom resets | None | Quick zoom fix |
| `zoomAndSettings` | 3 zoom resets | 5 size settings | Full reset |
| `custom` | User-defined | User-defined | Full control |

### Scopes

Settings can exist at multiple levels in VS Code:
- **User** (`~/.config/Code/User/settings.json`) - Global
- **Workspace** (`.vscode/settings.json`) - Project-specific
- **WorkspaceFolder** - Per-folder in multi-root workspaces

The extension can reset settings at any combination of these scopes.

### Commands vs Settings

- **Commands**: Immediate actions (like pressing a keyboard shortcut)
- **Settings**: Persistent configuration in settings.json

The extension uses both: commands for zoom behaviors, settings removal for font sizes.

## Extension Points

The extension contributes:
- **1 Command**: `resetSizes.resetAll` - "Reset All Sizes"
- **7 Configuration Settings**: Under `resetSizes.*` namespace

## Technology

- **Language**: TypeScript (strict mode)
- **Target**: VS Code ^1.74.0
- **Dependencies**: None (only VS Code API)
- **Build**: esbuild bundle (tsc still type-checks and emits the tree for tests)
- **Tests**: pure-Node Mocha against an in-memory `vscode` shim (no `@vscode/test-electron`)
