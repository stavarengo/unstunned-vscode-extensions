# Manual Testing Guide

This guide provides step-by-step instructions for manually testing the Reset Sizes extension.

## Prerequisites

1. Extension is compiled: `pnpm run build`
2. VS Code is open with this project

## Test Scenarios

### Test 1: "zoom" Preset (Default)

**Objective**: Verify that zoom resets work without affecting settings.

**Steps**:
1. Open VS Code and press F5 to launch Extension Development Host
2. In the new window, perform these zoom changes:
   - Press `Ctrl/Cmd + =` a few times to zoom in the UI
   - Open an editor file, hold `Ctrl/Cmd` and scroll mouse wheel to zoom editor font
   - Open a terminal (`Ctrl/Cmd + ~`), hold `Ctrl/Cmd` and scroll to zoom terminal font
3. Open Command Palette (`Ctrl/Cmd + Shift + P`)
4. Type "Reset All Sizes" and press Enter
5. Check the "Reset Sizes" output channel (View > Output, select "Reset Sizes")

**Expected Results**:
- ✓ Notification appears: "Executed 3 commands."
- ✓ UI zoom returns to 0 (default)
- ✓ Editor font zoom returns to default
- ✓ Terminal font zoom returns to default
- ✓ Output channel shows successful execution of 3 commands
- ✓ No settings were modified (check output)
- ✓ No reload prompt appears

---

### Test 2: "zoomAndSettings" Preset with Workspace Settings

**Objective**: Verify that zoomAndSettings preset removes size-related settings.

**Steps**:
1. Launch Extension Development Host (F5)
2. In the new window, manually set these workspace settings:
   - Open Settings (`Ctrl/Cmd + ,`)
   - Switch to Workspace tab
   - Set `editor.fontSize` to 20
   - Set `terminal.integrated.fontSize` to 16
   - Set `window.zoomLevel` to 1
3. Change extension configuration:
   - Open Settings > Extensions > Reset Sizes
   - Change `resetSizes.preset` to `zoomAndSettings`
   - Verify `resetSizes.promptBeforeReset` is true
   - Verify `resetSizes.scopes` includes `workspace`
4. Perform zoom changes (like Test 1)
5. Run "Reset All Sizes" command
6. You should see a confirmation dialog

**Expected Results**:
- ✓ Confirmation dialog appears with "Reset Settings: Remove custom overrides?"
- After clicking "Proceed":
  - ✓ UI/editor/terminal zooms are reset
  - ✓ Output channel shows settings being reset
  - ✓ Reload prompt appears
  - ✓ After reload, check workspace settings - size settings should be removed
  - ✓ Notification shows "Executed 3 commands, reset N settings."

---

### Test 3: Settings Reset Canceled

**Objective**: Verify that canceling settings reset still executes commands.

**Steps**:
1. Launch Extension Development Host (F5)
2. Set some workspace size settings (editor.fontSize, etc.)
3. Ensure `resetSizes.preset` is `zoomAndSettings`
4. Ensure `resetSizes.promptBeforeReset` is `true`
5. Perform zoom changes
6. Run "Reset All Sizes" command
7. In the confirmation dialog, click "Cancel"

**Expected Results**:
- ✓ Dialog is dismissed
- ✓ Zooms are still reset (commands are executed before the prompt)
- ✓ Settings are NOT modified
- ✓ Output channel shows "Settings reset canceled by user"
- ✓ Notification shows command execution message
- ✓ No reload prompt

---

### Test 4: No Workspace Open

**Objective**: Verify extension works without a workspace.

**Steps**:
1. Launch Extension Development Host (F5)
2. Close any open folders/workspaces (File > Close Folder)
3. Ensure preset is `zoom` (default)
4. Perform UI zoom changes (`Ctrl/Cmd + =`)
5. Run "Reset All Sizes" command

**Expected Results**:
- ✓ Command executes without errors
- ✓ UI zoom is reset
- ✓ No errors about missing workspace
- ✓ Output channel shows successful execution

---

### Test 5: Configuration Settings

**Objective**: Verify all configuration settings work correctly.

**Test 5a: showSummaryNotification = false**
1. Set `resetSizes.showSummaryNotification` to `false`
2. Run "Reset All Sizes"
3. Expected: No notification shown, but output channel still logs

**Test 5b: reloadAfter = never**
1. Set `resetSizes.preset` to `zoomAndSettings`
2. Set `resetSizes.promptBeforeReset` to `false`
3. Set `resetSizes.reloadAfter` to `never`
4. Run "Reset All Sizes"
5. Expected: Settings are reset, but no reload prompt

**Test 5c: reloadAfter = always**
1. Set `resetSizes.preset` to `zoomAndSettings`
2. Set `resetSizes.promptBeforeReset` to `false`
3. Set `resetSizes.reloadAfter` to `always`
4. Run "Reset All Sizes"
5. Expected: Window reloads immediately after reset

**Test 5d: Custom preset with specific commands**
1. Set `resetSizes.preset` to `custom`
2. Set `resetSizes.commands` to `["workbench.action.zoomReset"]` (only one command)
3. Set `resetSizes.settingsToReset` to `["editor.fontSize"]`
4. Run "Reset All Sizes"
5. Expected: Only UI zoom reset executed, only editor.fontSize setting removed

**Test 5e: Multiple scopes**
1. Set `resetSizes.preset` to `zoomAndSettings`
2. Set `resetSizes.scopes` to `["user", "workspace"]`
3. Set size settings in both user and workspace
4. Run "Reset All Sizes"
5. Expected: Settings are reset in both scopes

---

### Test 6: Multi-Root Workspace

**Objective**: Verify extension works with multi-root workspaces.

**Steps**:
1. Create a multi-root workspace (File > Add Folder to Workspace, add 2+ folders)
2. Save the workspace
3. Set `resetSizes.scopes` to include `workspaceFolder`
4. Set size settings in one or more workspace folders
5. Run "Reset All Sizes"

**Expected Results**:
- ✓ Settings are reset in all workspace folders
- ✓ Output channel shows updates for each folder
- ✓ No errors

---

### Test 7: Error Handling

**Objective**: Verify extension handles errors gracefully.

**Test 7a: No terminal open**
1. Launch Extension Development Host
2. DO NOT open a terminal
3. Run "Reset All Sizes"
4. Expected: Command succeeds, terminal zoom reset fails gracefully with appropriate message

**Test 7b: Read-only settings** (difficult to test)
1. In a restricted environment where settings cannot be written
2. Run "Reset All Sizes" with zoomAndSettings preset
3. Expected: Errors are logged, user is notified, extension doesn't crash

---

### Test 8: Output Channel

**Objective**: Verify output channel provides useful information.

**Steps**:
1. Run "Reset All Sizes" in any mode
2. Open Output panel (View > Output)
3. Select "Reset Sizes" from dropdown

**Expected Results**:
- ✓ Output channel shows:
  - "Starting Reset All Sizes..."
  - Preset being used
  - Number of commands and settings configured
  - Each command execution result
  - (If settings configured) Each setting being reset with success/fail count
  - Summary with counts
  - "Reset All Sizes completed"
- ✓ Clear formatting
- ✓ Useful for debugging

---

## Success Criteria

The extension passes all tests when:

- ✅ Running "Reset All Sizes" executes the configured commands (default: 3 zoom resets)
- ✅ "zoom" preset does NOT alter fontSize settings
- ✅ "zoomAndSettings" preset removes overrides for the specified settings
- ✅ "custom" preset allows users to define their own command and settings lists
- ✅ User receives confirmation before settings reset (unless disabled)
- ✅ Reload prompt appears when settings change (unless disabled)
- ✅ Works with and without workspace open
- ✅ Handles errors gracefully without crashing
- ✅ Shows summary notification of actions taken
- ✅ All configuration options work as documented
- ✅ Multi-root workspace support works correctly
- ✅ Output channel provides clear, useful logging

## Known Issues to Verify

If you encounter these issues, they may be expected:

1. Terminal font zoom reset may show as "failed" if no terminal is open - this is OK
2. Some zoom resets may require reload to fully take effect
3. In remote environments, some settings may not be writable

## Reporting Issues

If you find any issues during testing:

1. Check the Output channel for error details
2. Note the exact steps to reproduce
3. Include your configuration settings
4. Include VS Code version and platform
5. Report on GitHub issues
