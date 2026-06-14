# Changelog

All notable changes to the "Reset Sizes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-01-18

### Added

- **Single command** to reset all size-related changes in VS Code
- **Preset system** with three built-in configurations:
  - `zoom` (default): Resets UI zoom, editor font zoom, and terminal font zoom
  - `zoomAndSettings`: Resets zooms and removes size-related settings (fontSize, lineHeight, etc.)
  - `custom`: Full control over which commands and settings to reset
- **Configurable VS Code commands** to execute during reset:
  - `workbench.action.zoomReset` - Reset UI zoom
  - `editor.action.fontZoomReset` - Reset editor font zoom
  - `workbench.action.terminal.fontZoomReset` - Reset terminal font zoom
- **Settings reset** capability for size-related configuration keys:
  - `window.zoomLevel`
  - `editor.fontSize`
  - `editor.lineHeight`
  - `terminal.integrated.fontSize`
  - `terminal.integrated.lineHeight`
- **Scope control** for settings reset (user, workspace, workspaceFolder)
- **Multi-root workspace support** for workspace folder-scoped settings
- **User confirmation** before modifying settings (configurable)
- **Window reload options** after reset (never, prompt, always)
- **Summary notification** showing reset results
- **Output channel** for detailed logging ("Reset Sizes")
