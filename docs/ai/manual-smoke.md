# Manual smoke checklist

Scenarios that cannot be covered by pure-Node unit tests because they need a
real VS Code runtime (the extension host's command registry, real
`WorkspaceConfiguration` writes against `settings.json`, real `WebviewPanel`
lifecycle, real notification + reload prompts). These are the user-facing
contracts that the automated test suite cannot verify.

## How to run

1. From the repo root: `npm run install-local`. This compiles, packages, and
   installs the latest build into your VS Code (uses `code --install-extension
   extension.vsix --force`).
2. **Developer: Reload Window** (Command Palette).
3. Walk through the relevant scenarios below. Each is a single Done-When line —
   if it doesn't hold, file an issue.

## Activation and command palette

- [ ] `Reset Sizes: Reset` appears in the Command Palette and runs through the
  mode picker → scope picker without throwing.
- [ ] `Reset Sizes: Open Activity Log` reveals the **Reset Sizes** Output channel.
- [ ] `Reset Sizes: Open Preview` opens the read-only preview matrix.
- [ ] Extension page (Extensions view → Reset Sizes → "Extension Page") shows
  no `Messages` warnings. This is what would have caught the dot-in-id bug.

## Preview (WebviewPanel lifecycle)

- [ ] Open `Reset Sizes: Open Preview` twice in a row — the second invocation
  reveals the existing panel; it does NOT spawn a duplicate.
- [ ] Open the preview, switch to a different editor tab, switch back — the
  matrix renders fresh against the current state (no stale cells from earlier).
- [ ] With the preview open, edit a tracked setting in another tab
  (e.g. `editor.fontSize`), then bring the preview forward — the row reflects
  the new value.
- [ ] Close the preview tab; reopen it — no orphan listeners (you can check
  `Developer: Toggle Developer Tools` → Console for "Trying to add a
  disposable to a DisposableStore that has already been disposed of" warnings;
  none should appear).

## Real settings cascade (S6, S7, S8, S11)

- [ ] In a multi-root workspace: set `editor.fontSize` at User + Workspace + a
  WorkspaceFolder override. Run `Reset Sizes: Reset` → "Font size only" →
  "Workspace". Verify:
  - User value is **untouched**.
  - Workspace and WorkspaceFolder values are **cleared**.
- [ ] Repeat with "Global": all three rungs cleared, including the User value.
- [ ] Reset with a key that doesn't exist anywhere → "No changes" path runs
  without an error toast.

## Reload prompt (Slice 3)

- [ ] Clear `window.zoomLevel` at Global → the reload-required prompt appears
  with three buttons in this order: "Don't reload now" / "Reload" / "Reload
  and don't ask again".
- [ ] "Reload and don't ask again" sets `resetSizes.reloadSilently: true`;
  subsequent reload-required resets reload silently (no prompt).
- [ ] Toggle `resetSizes.reloadSilently: false` in settings → the prompt
  returns on the next reload-required reset (S19 reversibility).

## Notification + activity log

- [ ] After a reset, the summary notification names the actual keys that
  changed (truncated to "3 + N more" when many).
- [ ] The notification's **View log** button reveals the **Reset Sizes** Output
  channel; the log entry for that run is the most recent block.

## Remote-adaptive scope label (S15)

- [ ] Connect to a Remote SSH / Dev Container / WSL window. Run
  `Reset Sizes: Reset` → the scope picker shows **User settings (remote)** for
  the Global rung. The confirmation dialog uses the same label. The summary
  notification's "what was changed" lists the same.

## Partial-failure tolerance (S23)

- [ ] Close all integrated terminals. Run `Reset Sizes: Reset` → "Zoom only" →
  "Session". The terminal-zoom step fails internally (no terminal to reset),
  but the reset completes; the other zoom commands succeed; the activity log
  records the terminal step as a failure with an error message.
