# Reset Sizes for VS Code

A VS Code extension that provides a single command to reset all size-related changes (UI zoom, editor font zoom, terminal font zoom, and optionally size-related settings) back to defaults.

## Features

- **Single Command**: Reset all zooms and size settings with one command
- **Flexible Configuration**: Choose exactly which VS Code commands to execute and which settings to reset
- **Three Presets**:
  - **zoom** (default): Resets zoom behaviors only (UI zoom, editor font zoom, terminal font zoom)
  - **zoomAndSettings**: Resets zooms AND removes size-related settings to restore VS Code defaults
  - **custom**: Define your own command list and settings to reset - fully customizable
- **Safe & Reversible**: Only removes custom setting values - you can always set them again
- **Powerful Customization**: Add any valid VS Code command to your reset workflow
- **Scope Control**: Choose which configuration scopes to reset (user, workspace, workspace folder)
- **User-Friendly**: Confirmations before changing settings, reload prompts when needed

## What Gets Reset

The extension uses a **preset system** to control what gets reset. You can choose a preset or create your own custom configuration.

### "zoom" Preset (Default)

Executes these VS Code commands:
- `workbench.action.zoomReset` - Reset UI zoom (overall window zoom level)
- `editor.action.fontZoomReset` - Reset editor font zoom (different from font size setting)
- `workbench.action.terminal.fontZoomReset` - Reset terminal font zoom

**Settings modified**: None

### "zoomAndSettings" Preset

Executes the same zoom commands as above, PLUS removes your custom values for these settings:
- `window.zoomLevel`
- `editor.fontSize`
- `editor.lineHeight`
- `terminal.integrated.fontSize`
- `terminal.integrated.lineHeight`

**What happens**: VS Code will use its built-in default values for these settings. For example, if you had `"editor.fontSize": 20` in workspace settings, it will be removed and the default (typically 12-14 depending on your OS) will be used.

**Is it safe?**: Yes! This only removes the custom values you've set. It doesn't delete any code, files, or extensions. You can always set these values again manually afterward.

### "custom" Preset

With the custom preset, you define exactly which commands to execute and which settings to reset by configuring the `resetSizes.commands` and `resetSizes.settingsToReset` arrays in your settings.

**Example**: You could create a custom profile that only resets editor font size and executes a specific command you need.

## Key Concepts

### Zoom vs Font Size

VS Code has two different concepts for text size:

1. **Font Zoom**: Dynamic zoom controlled by Ctrl/Cmd + Mouse Wheel in editor/terminal
   - Temporary, per-session behavior
   - Not persisted in settings files
   - Reset by zoom commands

2. **Font Size**: The `fontSize` setting in settings.json
   - Permanent configuration
   - Persisted in settings files
   - Only reset in zoomAndSettings mode

### UI Zoom

The `window.zoomLevel` setting controls the zoom of the entire VS Code window (all UI, not just text). This is different from editor/terminal font zoom.

## Usage

### Command Palette

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
2. Type "Reset All Sizes"
3. Press Enter

The extension will:
- Execute the configured VS Code commands (default: 3 zoom reset commands)
- (If settings are configured) Prompt for confirmation, then remove setting overrides
- Show a summary notification
- (Optional) Prompt to reload the window

### Keyboard Shortcut

You can bind a keyboard shortcut to the command:

1. Open Keyboard Shortcuts (`Ctrl+K Ctrl+S` or `Cmd+K Cmd+S` on macOS)
2. Search for "Reset All Sizes"
3. Click the + icon and assign your preferred shortcut

Example keybinding in `keybindings.json`:
```json
{
  "key": "ctrl+alt+0",
  "command": "resetSizes.resetAll"
}
```

## Configuration

All settings are under the `resetSizes` namespace in VS Code settings.

### `resetSizes.preset`

**Type**: `string` (enum: `"zoom"`, `"zoomAndSettings"`, `"custom"`)
**Default**: `"zoom"`

Choose a preset configuration:
- **`zoom`**: Resets zoom behaviors only (UI zoom, editor font zoom, terminal font zoom). No settings are modified.
- **`zoomAndSettings`**: Resets zoom behaviors AND removes custom size settings like `editor.fontSize`, `terminal.integrated.fontSize`, etc., restoring them to VS Code defaults.
- **`custom`**: Define your own command list and settings to reset using the `commands` and `settingsToReset` arrays.

```json
{
  "resetSizes.preset": "zoom"
}
```

> **Tip**: Use `zoom` for quick zoom fixes. Use `zoomAndSettings` when you want to clean up all size customizations. Use `custom` for full control.

### `resetSizes.commands`

**Type**: `array` of `string`
**Default**: `["workbench.action.zoomReset", "editor.action.fontZoomReset", "workbench.action.terminal.fontZoomReset"]`

VS Code command IDs to execute when Reset All Sizes is run. You can add any valid VS Code command.

```json
{
  "resetSizes.commands": [
    "workbench.action.zoomReset",
    "editor.action.fontZoomReset",
    "workbench.action.terminal.fontZoomReset"
  ]
}
```

**Available size-related commands**:
- `workbench.action.zoomReset` - Reset UI zoom
- `workbench.action.zoomIn` - Zoom in UI
- `workbench.action.zoomOut` - Zoom out UI
- `editor.action.fontZoomReset` - Reset editor font zoom
- `editor.action.fontZoomIn` - Increase editor font zoom
- `editor.action.fontZoomOut` - Decrease editor font zoom
- `workbench.action.terminal.fontZoomReset` - Reset terminal font zoom
- `workbench.action.terminal.fontZoomIn` - Increase terminal font zoom
- `workbench.action.terminal.fontZoomOut` - Decrease terminal font zoom

> **Note**: When you change the preset, this array is automatically populated with the preset's default commands. Set preset to `custom` to manually customize this list.

### `resetSizes.settingsToReset`

**Type**: `array` of `string`
**Default**: `[]`

Setting keys to reset (remove custom values) when Reset All Sizes is run. This removes your custom overrides from the configured scopes, restoring VS Code defaults.

```json
{
  "resetSizes.settingsToReset": [
    "editor.fontSize",
    "editor.lineHeight",
    "terminal.integrated.fontSize",
    "window.zoomLevel"
  ]
}
```

**Common size-related settings**:
- `window.zoomLevel` - UI zoom level
- `editor.fontSize` - Editor font size
- `editor.lineHeight` - Editor line height
- `terminal.integrated.fontSize` - Terminal font size
- `terminal.integrated.lineHeight` - Terminal line height

> **Note**: When you change the preset, this array is automatically populated. The `zoom` preset sets this to an empty array. The `zoomAndSettings` preset includes 5 size-related settings.

### `resetSizes.scopes`

**Type**: `array` of `string` (enum: `"user"`, `"workspace"`, `"workspaceFolder"`)
**Default**: `["workspace"]`

Configuration scopes to apply settings reset. Only used when `settingsToReset` is not empty.

```json
{
  "resetSizes.scopes": ["workspace"]
}
```

- `user`: Reset user-level settings (Global settings)
- `workspace`: Reset workspace-level settings (.vscode/settings.json)
- `workspaceFolder`: Reset workspace folder settings (in multi-root workspaces)

### `resetSizes.promptBeforeReset`

**Type**: `boolean`
**Default**: `true`

Show confirmation dialog before removing settings. Only applies when `settingsToReset` is not empty.

```json
{
  "resetSizes.promptBeforeReset": true
}
```

> **Recommended**: Keep this enabled to avoid accidentally removing settings.

### `resetSizes.reloadAfter`

**Type**: `string` (enum: `"never"`, `"prompt"`, `"always"`)
**Default**: `"prompt"`

When to reload window after reset:
- `never`: Never reload automatically
- `prompt`: Prompt user to reload if settings were changed
- `always`: Always reload immediately

```json
{
  "resetSizes.reloadAfter": "prompt"
}
```

### `resetSizes.showSummaryNotification`

**Type**: `boolean`
**Default**: `true`

Show notification with summary of reset actions (number of commands executed and settings reset).

```json
{
  "resetSizes.showSummaryNotification": true
}
```

## Configuration Examples

### Example 1: Quick zoom reset (default - "zoom" preset)

```json
{
  "resetSizes.preset": "zoom"
}
```

Executes 3 zoom reset commands. No settings are modified.

### Example 2: Zoom and settings reset ("zoomAndSettings" preset)

```json
{
  "resetSizes.preset": "zoomAndSettings",
  "resetSizes.scopes": ["workspace"],
  "resetSizes.promptBeforeReset": true
}
```

Resets zoom commands AND removes 5 size-related settings from workspace configuration.

### Example 3: Reset everything across all scopes

```json
{
  "resetSizes.preset": "zoomAndSettings",
  "resetSizes.scopes": ["user", "workspace", "workspaceFolder"],
  "resetSizes.promptBeforeReset": true,
  "resetSizes.reloadAfter": "always"
}
```

Comprehensive reset: resets zooms and removes settings from all scopes, then reloads immediately.

### Example 4: Custom command list

```json
{
  "resetSizes.preset": "custom",
  "resetSizes.commands": [
    "workbench.action.zoomReset",
    "editor.action.fontZoomIn"
  ],
  "resetSizes.settingsToReset": [
    "editor.fontSize",
    "workbench.colorTheme"
  ]
}
```

Fully customized: reset UI zoom, increase editor font, and reset fontSize + theme settings.

### Example 5: Only reset specific settings, no commands

```json
{
  "resetSizes.preset": "custom",
  "resetSizes.commands": [],
  "resetSizes.settingsToReset": [
    "terminal.integrated.fontSize"
  ]
}
```

No commands executed, only removes terminal fontSize override.

## Multi-Root Workspaces

In multi-root workspaces, when `workspaceFolder` scope is selected, the extension will apply setting resets to **all workspace folders** by default.

## Known Limitations

1. **Other Open Windows**: Cannot force-reset zoom in other open VS Code windows unless `window.zoomPerWindow` is disabled (zoom is global).

2. **Settings Require Reload**: Some setting changes require a window reload to take full effect. The extension prompts for reload when appropriate.

3. **Remote Environments**: In remote development scenarios (Remote SSH, WSL, Dev Containers), some settings may have restrictions on writability.

4. **Terminal May Not Exist**: The terminal font zoom reset may fail gracefully if no terminal is currently open. This is expected behavior and not an error.

5. **Confirmation Dialog**: The settings reset confirmation (when enabled) is a modal dialog that will block the UI until user responds.

## Output Channel

The extension logs detailed information to the "Reset Sizes" output channel. To view:

1. Open Output panel (`View > Output` or `Ctrl+Shift+U`)
2. Select "Reset Sizes" from the dropdown

This is useful for debugging or understanding what the extension did.

## Development

This extension lives in a [pnpm](https://pnpm.io) workspace monorepo at `extensions/reset-sizes/`. The package manager is pinned via Corepack, so a one-time `corepack enable pnpm` activates the right version.

The build uses esbuild to bundle `src/extension.ts` into `dist/extension.js` (with `vscode` marked external), while `tsc` type-checks and emits the full source tree for the unit tests.

### Building from Source

The root-level scripts run recursively across the whole workspace. Run these from the repo root:

```bash
# One-time: activate the pinned pnpm via Corepack
corepack enable pnpm

# Install all workspace dependencies
pnpm install

# Type-check + esbuild bundle every package
pnpm run build

# Watch for changes
pnpm run watch

# Run all tests (pretest type-checks/emits via tsc)
pnpm test

# Lint
pnpm run lint
```

To work on just this extension, scope the command from the repo root with `--dir`:

```bash
pnpm --dir extensions/reset-sizes run build
pnpm --dir extensions/reset-sizes test
pnpm --dir extensions/reset-sizes run package        # build a .vsix
pnpm --dir extensions/reset-sizes run install-local   # build VSIX + install into local VS Code
```

Or `cd extensions/reset-sizes` first and run the plain scripts (`pnpm run build`, `pnpm test`, etc.).

> **Tests** run as pure Node + Mocha against `dist/test/unit/**/*.test.js`, using an in-memory `vscode` shim (`src/test/shims/vscode-pkg/`). There is no `@vscode/test-electron` and no VS Code test host.

### Running the Extension

1. Open the repo root in VS Code
2. Press F5 to launch the Extension Development Host (the launch config builds the extension first)
3. In the new window, test the "Reset All Sizes" command

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

## Credits

Created as a utility to quickly reset all zoom and size-related customizations in VS Code, useful when:
- Sharing screenshots or screen recordings
- Troubleshooting display issues
- Resetting after accidental zoom changes
- Preparing workspaces for fresh starts
