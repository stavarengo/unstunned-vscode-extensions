# Slices: reset-sizes-revamp

**Contract:** docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/contract.md

Each slice ships a working subset end-to-end: a user (or downstream system) can observe the behaviour change after the slice merges. Slices are ordered so each one is independently mergeable in sequence; later slices build on earlier behaviour, never the reverse.

## Slice 1: Mode/scope picker + Zoom-only reset path + activity log surfaces
- **Status:** done
- **Satisfies:** S1, S2, S13, S22, S24, S25, S26, S34, S35
- **Scope:**
  - Revamp `package.json`: drop the `custom` preset enum value, drop `resetSizes.commands`, `resetSizes.settingsToReset`, `resetSizes.scopes`, and `resetSizes.reloadAfter` (the legacy three-mode prompt is replaced by S16's three-option flow in Slice 3). Introduce `resetSizes.confirmBeforeDestructiveReset` (default `true`) and `resetSizes.showSummaryNotification` (kept).
  - Reset command UX: invoking `resetSizes.resetAll` from the Command Palette presents a mode picker (exactly three options: "Zoom only", "Font size only", "Zoom and font size") followed by a scope picker (exactly three rungs: "Session", "Workspace", "Global"). Copy uses destructiveness vocabulary ("the broader the scope you pick, the more places get cleaned"); never precedence vocabulary.
  - Implement only the Zoom-only end-to-end path in this slice: at any scope, Zoom-only invokes VS Code's documented zoom-reset commands (UI zoom, editor font zoom, terminal font zoom), touches no persisted settings, shows no confirmation prompt, shows no reload prompt, and never modifies the user's `settings.json`. Selecting Font size only or Zoom and font size in this slice shows a "not yet implemented" message and aborts cleanly (these modes are wired in Slice 2).
  - Activity log: the existing `Reset Sizes` Output Channel is the activity log. Every invocation records: the chosen mode, the chosen scope, the keys *considered* (empty for Zoom only), the keys *changed* (empty for Zoom only), the commands executed, and any failures. Log entries survive across invocations.
  - Three log entry points all open the same Output Channel content:
    1. Command Palette command `resetSizes.openActivityLog`.
    2. An action button on the summary notification ("View log").
    3. A markdown link in `package.json`'s configuration description for `resetSizes.showSummaryNotification` (the extension's settings page surface).
  - Summary notification: shown by default after every reset; names what was changed (or "Nothing changed."); is dismissable; includes the "View log" action. Suppressed when `resetSizes.showSummaryNotification` is `false`; the log entry is still written.
  - No default keybinding shipped (S34): the manifest does not contribute `keybindings`.
- **Done when:**
  - S1, S2 pass: a freshly installed VS Code with no size-family settings reaches a clean baseline via one Command Palette invocation accepting defaults; Zoom-only at Session shows no confirmation, no reload prompt, and no settings file modification.
  - S13 passes: Zoom-only at any scope leaves persisted settings untouched (the slice can defer "and leaves `editor.fontSize` at workspace scope alone" by virtue of not implementing settings reset at all yet).
  - S22 passes: Zoom-only reset shows no reload prompt.
  - S24, S25 pass: summary notification names changes (or none), is dismissable, links to the log, and is silenced by the setting; the log is still written when silenced.
  - S26 passes: the Output Channel opens from all three entry points listed above.
  - S34 passes: no default keybinding is bound; the command is bindable via VS Code's keyboard-shortcuts UI.
  - S35 passes: the mode picker offers exactly three options; no "Custom" option, no input field for command IDs, no input field for setting keys.
  - Manual smoke: run the Extension Development Host (F5), invoke the command, select Zoom only at Session, verify the log shows the run and the notification appears with a working "View log" action.

## Slice 2: Settings reset — size-key discovery, scope cascade, confirmation, remote label, partial-failure tolerance
- **Status:** done
- **Satisfies:** S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S14, S15, S23, S32, S33
- **Scope:**
  - ADR 0003 discovery (folded in here because it has no standalone observable behaviour): a curated in-source list of well-known size keys (`editor.fontSize`, `editor.lineHeight`, `terminal.integrated.fontSize`, `terminal.integrated.lineHeight`, `window.zoomLevel`, plus equivalents across notebook, debug console, output, scm, chat, markdown preview, comments — whatever VS Code's built-in size-family contains at time of implementation), plus suffix patterns (`fontSize`, `lineHeight`, `zoomLevel`, and other size-family suffixes settled during implementation). The set of recognised suffixes is treated as part of the public contract — adding/removing a suffix is a behavioural change.
  - Discovery never matches the extension's own preference keys (S32): keys under the `resetSizes.` namespace are excluded from both the curated list and suffix matching.
  - ADR 0002 cascade for the Workspace and Global rungs:
    - **Workspace:** for each size-family key present in the workspace, write `undefined` via `WorkspaceConfiguration.update(key, undefined, ConfigurationTarget.Workspace)`; then iterate `vscode.workspace.workspaceFolders` and write `undefined` to `ConfigurationTarget.WorkspaceFolder` per folder for any folder-level override of the same key. Also reset in-memory zoom (Session is included in Workspace per the cascade).
    - **Global:** write `undefined` via `WorkspaceConfiguration.update(key, undefined, ConfigurationTarget.Global)`. Also clear Workspace (file + folder overrides) and reset in-memory zoom (Workspace + Session included in Global per the cascade).
  - Mode wiring: Font size only operates on the discovered size-family keys but does NOT touch zoom state; Zoom and font size combines Zoom only + Font size only; Zoom only's existing behaviour from Slice 1 is unchanged.
  - Confirmation dialog: when the chosen scope is Workspace or Global AND `resetSizes.confirmBeforeDestructiveReset` is `true` AND the discovery step found at least one key to clear, show a modal dialog that names the specific keys and rungs that will be cleared. No change is made until the user accepts. Workspace-folder clears are listed under a single "Workspace" heading (S6, S7). Cancelling makes no in-memory zoom change, no settings change, and shows no reload prompt; the summary notification either is not shown or reports nothing changed (S4).
  - Pure Session resets (Zoom only or Font size only at scope Session — though Font size only at Session is a no-op because Session touches no settings) never prompt for confirmation regardless of the preference (per Brief invariant).
  - Remote label (S15): a single `labelForScope(scope)` helper returns "Session", "Workspace", and either "Global" or "User settings (remote)" depending on `vscode.env.remoteName`. This helper is used by the scope picker, the confirmation dialog, and the summary notification. The underlying write always targets `ConfigurationTarget.Global` — there is one target, not two.
  - Partial-failure tolerance (S23): a single failed sub-step (e.g. `workbench.action.terminal.fontZoomReset` failing because no terminal is open, or a single `update()` rejecting) does not interrupt the reset with an error dialog. The failure is captured in the result, recorded in the activity log, and named in the summary notification ("Failed: 1 step") alongside the successful steps.
  - Activity log records, for every invocation, the set of keys *considered* (curated ∪ suffix-matched at the targeted scopes) and the subset *changed* (per ADR 0003's verifiability requirement and the contract invariant).
- **Done when:**
  - S3 passes: Workspace/Global reset with confirmation enabled shows a dialog naming keys and scopes; no change occurs before acceptance.
  - S4 passes: cancelling the dialog leaves all state untouched.
  - S5 passes: with `resetSizes.confirmBeforeDestructiveReset` set to `false`, Global reset proceeds without a dialog and clears every rung.
  - S6, S7 pass: Workspace reset clears Workspace + Session, including every workspace-folder override, while leaving Global untouched; the summary names both kinds of clears under one "Workspace" heading.
  - S8 passes: Global reset clears Global + Workspace (file + folder overrides) + Session.
  - S9 passes: non-size keys (e.g. `editor.fontFamily`) are preserved at every rung after any reset.
  - S10 passes: a third-party `myExt.editor.fontSize` matching the `fontSize` suffix is cleared at the targeted scope; no other keys belonging to that extension are touched.
  - S11 passes: an unrecognised setting like `editor.tabSize` is preserved at every scope.
  - S12 passes: Font size only at Workspace clears `editor.fontSize` at Workspace but leaves in-memory zoom non-default.
  - S14 passes: Zoom and font size at Global resets in-memory zoom AND clears every recognised size-family key at Workspace + Global.
  - S15 passes: with `vscode.env.remoteName` non-empty, the scope picker, confirmation dialog, and summary notification show the "User settings (remote)" label; the write still targets `ConfigurationTarget.Global`.
  - S23 passes: a reset that includes a no-op terminal-font-zoom step still completes; the summary names both the successful and failed steps; no mid-run error dialog appears.
  - S32 passes: invoking any reset at Global with extension preference keys set leaves those keys intact.
  - S33 passes: a workspace with non-size settings (colours, themes, layout, keybindings, etc.) is unchanged by any reset.
  - Manual smoke: in the Extension Development Host, set `editor.fontSize` at Workspace + a folder override + Global; run Zoom and font size at Workspace and confirm only Workspace + folder + Session are cleared; repeat at Global and confirm Global is also cleared. Open a Remote SSH/WSL window and verify the label adapts. Close all terminals and run Zoom only to verify partial-failure tolerance.

## Slice 3: Reload prompt with three options + silent-reload preference
- **Status:** done
- **Satisfies:** S16, S17, S18, S19, S20, S21
- **Scope:**
  - Per-key "reload required" classification: an in-source map identifies which size-family keys require a window reload to take effect (e.g. `window.zoomLevel` does, `editor.fontSize` does not). The classification is part of the discovery contract's metadata, used only for the reload decision.
  - After a reset finishes applying changes, the orchestrator computes the subset of changes that require reload. If non-empty AND the user has not previously enabled "reload silently", show the post-reset prompt with EXACTLY three options: "Don't reload now", "Reload now", "Reload and don't ask again". The prompt lists the specific changes that triggered the reload requirement.
  - Silent-reload memento: choosing "Reload and don't ask again" persists a flag in the extension's `Memento` (per the Sketch: only piece of extension-owned persisted state apart from VS Code's settings store). The flag's key (e.g. `resetSizes.reloadSilently`) is reversible via a documented extension setting toggle — implemented as a settings-toggle that reads from and writes to the same memento OR via the existing `WorkspaceConfiguration` (decision left to implementer; either is consistent with the contract). The toggle must be discoverable from the extension's settings page.
  - When the silent-reload flag is set:
    - A reset with no reload-requiring changes never prompts and never reloads (S20).
    - A reset with at least one reload-requiring change reloads immediately and silently (S21); the summary notification (when shown) reports that a reload occurred.
  - "Don't reload now" leaves the window unreloaded, records no persistent preference, and lets the same prompt re-appear on the next reload-requiring reset (S17).
  - "Reload now" reloads immediately via `workbench.action.reloadWindow`, records no persistent preference, lets the prompt re-appear next time (S18).
  - Reload is invoked via `workbench.action.reloadWindow` only when an invoked reset has produced reload-requiring changes AND the user explicitly picked a reload option (or silent-reload is enabled). Never reload otherwise (per invariant).
  - The reload prompt is only ever shown when the reset's actual changes require a reload — never just because settings were touched (S22 reaffirmed).
- **Done when:**
  - S16 passes: a reset whose changes include at least one reload-required key shows a prompt listing those specific changes and offering the three named options.
  - S17 passes: "Don't reload now" leaves the window unreloaded, persists nothing, and the same prompt appears on the next qualifying reset.
  - S18 passes: "Reload now" reloads immediately and persists nothing.
  - S19 passes: "Reload and don't ask again" reloads immediately, persists the preference, and the preference is reversible from the extension's settings.
  - S20 passes: with silent-reload enabled, a reset whose changes do not require a reload performs no reload and shows no prompt.
  - S21 passes: with silent-reload enabled, a reset whose changes do require a reload reloads silently; the summary reports that a reload occurred.
  - Manual smoke: enable silent-reload, run a reset that changes only `editor.fontSize` (no reload needed) — no reload; run a reset that clears `window.zoomLevel` — silent reload. Disable silent-reload via the settings toggle, repeat — prompt returns.

## Slice 4: Preview view (read-only webview)
- **Status:** done
- **Satisfies:** S27, S28, S29
- **Scope:**
  - A read-only webview titled "Reset Sizes — Preview". For the current editor state, it renders a 3 (modes) × 3 (scopes) matrix showing, for each combination, the exact keys that *would* be cleared and the exact in-memory zoom state that *would* be reset. The "would-change" computation runs the same discovery logic from Slice 2 against the same scope cascade, in a pure pass that performs no writes.
  - Entry points:
    1. Command Palette command `resetSizes.openPreview`.
    2. A markdown link in `package.json`'s configuration description (extension settings page surface).
  - "Run reset" buttons in each matrix cell: clicking a cell's button invokes the same `resetSizes.resetAll` command path used by the Command Palette, pre-selecting that cell's (mode, scope). The button does NOT bypass the mode/scope picker's downstream flow — it goes through the same confirmation dialog (if enabled) and the same reload flow (Slices 2 and 3). The preview does not define its own action path.
  - Rendering is pure with respect to underlying state: opening, refreshing, or closing the view performs no writes — not to settings, not to the memento, not to in-memory zoom. Refresh re-reads the current state.
  - Remote label (S15) inherited via the same `labelForScope` helper from Slice 2.
- **Done when:**
  - S27 passes: opening the preview from each entry point renders the (mode, scope) matrix with the keys/state that would be changed.
  - S28 passes: opening, interacting with, refreshing, and closing the preview produces zero writes — verified by setting up a workspace with discovered keys, opening the preview, closing it, and confirming `settings.json`, the memento, and zoom state are byte-identical to before.
  - S29 passes: clicking a "run reset" button in the preview produces the same outcome as choosing the same (mode, scope) from the Command Palette — same confirmation prompt (if enabled), same reload flow.
  - Manual smoke: open the preview from the Command Palette, verify the matrix; click a "Workspace × Zoom and font size" button and confirm the standard confirmation dialog appears with the same keys named.

## Slice 5: Activity Bar icon (off by default, gated by setting)
- **Status:** done
- **Satisfies:** S30, S31
- **Scope:**
  - `resetSizes.showInActivityBar` boolean setting, default `false`.
  - Activity Bar contribution: a view container with an icon that, when active, hosts (or opens) the Preview view from Slice 4. The container is contributed in the manifest but its visibility is gated by a `when` clause bound to the `resetSizes.showInActivityBar` setting via a context key (e.g. set in `activate()` and updated when the setting changes).
  - When the setting flips on, the icon appears; when it flips off, the icon disappears. The Preview view remains reachable from the Command Palette and the extension's settings regardless of icon state.
- **Done when:**
  - S30 passes: a fresh install with no user configuration shows no extension icon in the Activity Bar; the Preview is still reachable from the Command Palette and the extension's settings.
  - S31 passes: enabling `resetSizes.showInActivityBar` makes the icon appear; clicking it opens the Preview; disabling the setting hides the icon again.
  - Manual smoke: install fresh in the Extension Development Host, confirm no icon; toggle the setting, confirm icon appears and opens the Preview; toggle off, confirm icon disappears.
