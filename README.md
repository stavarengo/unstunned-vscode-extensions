# Unstunned Extensions for VSCode - Monorepo Workspace

This is a monorepo project. Each folder inside `extensions/` is an isolated extension, totally independent from each other. They are not even packages of the same app, but instead totally different apps. The only thing they share in common is that they all belong to the same workspace.

## The extensions in this monorepo

### 1. [Reset Sizes](./extensions/reset-sizes/README.md)

A VS Code extension that provides a single command to reset all size-related changes (UI zoom, editor font zoom, terminal font zoom, and optionally size-related settings) back to defaults.

**Features:**
<!-- Keep this list in sync with the [Features section of the extension's README](./extensions/reset-sizes/README.md#features) -->
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
