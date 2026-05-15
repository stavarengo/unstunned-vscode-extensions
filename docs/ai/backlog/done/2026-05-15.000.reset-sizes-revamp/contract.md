# Behaviour Contract: reset-sizes-revamp

**Brief:** docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/brief.md
**ADRs in scope:**
- docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/adr.0002-three-rung-scope-cascade-deferring-to-vs-code.md
- docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/adr.0003-size-key-discovery-via-curated-list-plus-suffix-patterns.md
- docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/adr.0004-drop-custom-reset-preset.md
- docs/ai/backlog/todo/2026-05-15.000.reset-sizes-revamp/adr.0005-preview-view-is-read-only.md

This Contract reflects the decisions captured in ADRs 0002–0005 (ADR 0001 is superseded by 0002 and is not in scope). Vocabulary follows ADR 0002: scopes are described in **destructiveness** terms ("the broader the scope you pick, the more places get cleaned"); VS Code's configuration precedence is never used as a synonym.

## Scenarios

### S1. First-time user with default settings resets to baseline in one invocation
- **Given** a freshly installed VS Code with no size-family settings configured at any scope, and no in-memory zoom changes applied
- **When** the user opens the Command Palette, picks the reset command, and accepts default options
- **Then** the editor reaches a clean baseline without the user being asked to configure anything beforehand, and a summary notification reports what (if anything) was changed.

### S2. Zoom-only reset performs no settings changes and shows no prompts
- **Given** a user who has only zoomed (UI zoom, editor font zoom, or terminal font zoom) and has not written any size settings at any scope
- **When** the user invokes the reset with mode "Zoom only" at scope "Session"
- **Then** in-memory zoom state returns to the built-in default, no confirmation prompt is shown, no reload prompt is shown, no settings file is modified, and the summary notification reflects only the zoom changes that were applied.

### S3. Reset at any scope above session shows a confirmation that names what will be removed
- **Given** a user with at least one size-family setting set at workspace scope, and confirmation enabled (default)
- **When** the user invokes the reset at scope "Workspace" (or "Global")
- **Then** before any settings are removed, the user is shown a confirmation dialog that names the specific keys and scopes that will be cleared, and no change is made until the user accepts the dialog.

### S4. Cancelling the confirmation makes no changes
- **Given** the confirmation dialog from S3 is on screen
- **When** the user dismisses or rejects it
- **Then** no in-memory zoom is reset, no settings keys are removed at any scope, no reload is offered, and the summary notification is not shown (or, if shown, reports that nothing changed).

### S5. User opts out of confirmation and runs a destructive reset
- **Given** the user has turned the confirmation preference off in the extension's settings, and at least one size key is set at global scope
- **When** the user invokes the reset at scope "Global"
- **Then** the reset proceeds without a confirmation dialog, the targeted size keys are cleared at every rung at or below "Global" (per ADR 0002), and the summary notification reports the cleared keys.

### S6. Workspace-scope reset clears session and workspace but not global
- **Given** the same size-family key (e.g. `editor.fontSize`) is set at both global and workspace scopes, and in-memory zoom is non-default
- **When** the user invokes the reset at scope "Workspace" and confirms
- **Then** the in-memory zoom is reset, the key is removed at workspace scope (including any workspace-folder overrides; see S7), the global-scope value remains untouched, and the summary notification names the rungs cleared under a single "Workspace" heading.

### S7. Workspace-scope reset clears every workspace folder's overrides in addition to the workspace file
- **Given** a multi-root workspace whose workspace file sets `editor.fontSize` and whose folders each set `editor.fontSize` at folder scope (`ConfigurationTarget.WorkspaceFolder`)
- **When** the user invokes the reset at scope "Workspace" and confirms
- **Then** `editor.fontSize` is removed from the workspace file (`ConfigurationTarget.Workspace`) and from each folder's overrides (`ConfigurationTarget.WorkspaceFolder`), the global-scope value (if any) is untouched, and the summary notification lists both kinds of clears under the single "Workspace" heading.

### S8. Global-scope reset clears every rung
- **Given** the same size-family key is set at global and workspace scopes (including folder-level overrides), and in-memory zoom is non-default
- **When** the user invokes the reset at scope "Global" and confirms
- **Then** in-memory zoom is reset, and the key is removed at workspace scope (workspace file plus every folder override) and at global scope; the summary notification names every rung cleared.

### S9. Non-size settings are preserved at every rung
- **Given** a workspace whose settings include both `editor.fontSize` (size-family, per the curated list in ADR 0003) and `editor.fontFamily` (not size-family)
- **When** the user invokes the reset at scope "Workspace" and confirms
- **Then** `editor.fontSize` is removed at workspace scope and `editor.fontFamily` is preserved unchanged.

### S10. Pattern-matched third-party size key is reset
- **Given** an installed third-party extension contributes a setting named `myExt.editor.fontSize` (matching the recognised `fontSize` suffix per ADR 0003) and the user has set it at workspace scope
- **When** the user invokes the reset with a mode that includes font sizes at scope "Workspace" and confirms
- **Then** `myExt.editor.fontSize` is removed at workspace scope, no other keys belonging to that third-party extension are touched, and the summary notification names the cleared key.

### S11. Unrecognised setting that is not on the curated list and does not match any suffix is preserved
- **Given** a setting whose key does not appear on the curated list and does not match any recognised size suffix (e.g. `editor.tabSize`), set at any scope
- **When** the user invokes the reset at any scope and confirms (if prompted)
- **Then** the setting is not modified at any scope, even though "size" appears in its name; the summary notification does not list it among the changes.

### S12. Font-size–only mode does not touch zoom state
- **Given** in-memory zoom is non-default and `editor.fontSize` is set at workspace scope
- **When** the user invokes the reset with mode "Font size only" at scope "Workspace" and confirms
- **Then** `editor.fontSize` is removed at workspace scope, the in-memory zoom remains at its current non-default value, and the summary names only the font-size change.

### S13. Zoom-only mode does not touch persisted settings
- **Given** `editor.fontSize` is set at workspace scope and in-memory zoom is non-default
- **When** the user invokes the reset with mode "Zoom only" at any scope and confirms (if prompted)
- **Then** in-memory zoom returns to the built-in default, `editor.fontSize` at workspace scope is left untouched, and the summary names only the zoom change.

### S14. Combined mode applies both at the chosen scope
- **Given** in-memory zoom is non-default and several size-family keys are set at workspace and global scopes
- **When** the user invokes the reset with mode "Zoom and font size" at scope "Global" and confirms
- **Then** in-memory zoom is reset and every recognised size-family key is removed at workspace and global scopes (per the cascade in ADR 0002); the summary names every change made.

### S15. Global scope is labelled "User settings (remote)" when connected to a remote host
- **Given** the editor is connected to a remote host (e.g. Remote SSH, Containers, WSL), so `vscode.env.remoteName` is non-empty, and at least one size-family key is set at global scope
- **When** the user opens the scope picker for the reset command, the confirmation dialog, or the preview view
- **Then** the rung otherwise labelled "Global" is presented with a context-adaptive label (e.g. "User settings (remote)") so the user understands that the global write targets the remote's user settings, and the underlying call still writes `ConfigurationTarget.Global` (per ADR 0002 — there is one target, not two).

### S16. Reset that requires a reload prompts the user with three options
- **Given** a reset that includes at least one change which only takes effect after a window reload has been performed and persisted
- **When** the reset finishes applying its changes
- **Then** the user is shown a prompt that (a) lists the specific changes requiring reload, and (b) offers exactly three options: "Don't reload now", "Reload now", "Reload and don't ask again".

### S17. "Don't reload now" leaves the window unreloaded and remembers nothing
- **Given** the reload prompt from S16 is on screen
- **When** the user picks "Don't reload now"
- **Then** the window is not reloaded, no persistent preference is recorded, and the next time a reset requires a reload the same prompt is shown again.

### S18. "Reload now" reloads immediately and remembers nothing
- **Given** the reload prompt from S16 is on screen
- **When** the user picks "Reload now"
- **Then** the window is reloaded immediately, no persistent preference is recorded, and the next time a reset requires a reload the same prompt is shown again.

### S19. "Reload and don't ask again" reloads now and silences future reload prompts
- **Given** the reload prompt from S16 is on screen
- **When** the user picks "Reload and don't ask again"
- **Then** the window is reloaded immediately, an extension preference is recorded such that subsequent resets requiring a reload will reload silently without prompting, and that preference is reversible from the extension's settings.

### S20. With "reload silently" enabled, a reset that needs no reload does not reload
- **Given** the user has previously chosen "Reload and don't ask again"
- **When** the user invokes a reset whose changes do not require a reload
- **Then** the window is not reloaded and no reload prompt is shown.

### S21. With "reload silently" enabled, a reset that needs a reload reloads without prompting
- **Given** the user has previously chosen "Reload and don't ask again"
- **When** the user invokes a reset whose changes include at least one change requiring a reload
- **Then** the window is reloaded silently, no reload prompt is shown, and the summary notification (if not silenced) reports that a reload occurred.

### S22. Reset whose changes do not require a reload shows no reload prompt
- **Given** the user has the default reload-prompt preference (i.e. has not picked "Reload and don't ask again")
- **When** the user invokes a reset whose changes do not require a reload
- **Then** no reload prompt is shown.

### S23. A failing individual step does not abort the reset
- **Given** a reset whose steps include a terminal-font-zoom reset but there is no terminal open in the window
- **When** the user invokes the reset
- **Then** the failure of the terminal-font-zoom step does not interrupt the user with an error dialog, the remaining steps still run to completion, and the post-run summary and log record the failed step alongside the successful ones.

### S24. Summary notification names every change after a successful reset
- **Given** any reset has just completed with one or more changes applied
- **When** the summary notification is shown (default)
- **Then** the notification names what was changed (or, if nothing changed, says so), is dismissable, and links to the dedicated activity log.

### S25. Summary notification can be silenced via extension settings
- **Given** the user has silenced the summary notification in the extension's settings
- **When** any reset completes
- **Then** no summary notification is shown, and the dedicated activity log still records the reset.

### S26. Detailed activity log is reachable from three entry points
- **Given** at least one reset has been recorded in the activity log
- **When** the user opens the log
- **Then** it can be opened from (a) the extension's settings page, (b) the Command Palette, and (c) the summary notification (when shown); each entry point opens the same log content.

### S27. Preview view shows what each (mode, scope) combination would change
- **Given** a user opens the preview view from the Command Palette, the extension's settings, or the Activity Bar entry (if enabled)
- **When** the preview renders against the current editor state
- **Then** the preview displays, for each combination of mode (Zoom only, Font size only, Zoom and font size) and scope (Session, Workspace, Global), the specific changes that would occur if that combination were invoked.

### S28. Preview view performs no resets
- **Given** the preview view is open
- **When** the user interacts with the preview
- **Then** no in-memory state is changed, no settings keys at any scope are modified, no confirmation prompt is raised, and no reload occurs purely as a result of viewing the preview (per ADR 0005).

### S29. Preview view's "run reset" button delegates to the reset command
- **Given** the preview view exposes a button to invoke a reset for a given (mode, scope) combination
- **When** the user clicks that button
- **Then** the same reset command that the Command Palette would run is invoked, the same confirmation prompt (if enabled) appears, and the same reload flow follows — the preview does not bypass any of those steps and does not define a separate action path (per ADR 0005).

### S30. Activity Bar icon is hidden by default
- **Given** a fresh installation of the extension with no user configuration
- **When** the user looks at VS Code's Activity Bar
- **Then** the extension contributes no visible icon, the Preview view remains reachable via the Command Palette and the extension's settings, and a documented extension setting (e.g. `resetSizes.showInActivityBar`) lets the user enable the icon.

### S31. Activity Bar icon appears when the user enables it
- **Given** the user has enabled the Activity Bar icon via the extension's settings
- **When** VS Code applies the configuration
- **Then** the extension contributes an Activity Bar icon that opens the Preview view, and the icon remains visible until the user disables the setting.

### S32. Extension's own preferences are never cleared by a reset
- **Given** the user has configured the extension's own preferences (confirmation on/off, summary-notification on/off, reload-and-don't-ask-again, Activity Bar visibility)
- **When** the user invokes any reset at any scope (including "Global")
- **Then** none of the extension's own preference keys are removed at any scope, and the same preferences remain in effect after the reset completes.

### S33. Reset has no effect on non-size domains
- **Given** the user has configured colours, themes, panel positions, layout, keybindings, or other non-size settings at any scope
- **When** the user invokes any reset at any scope
- **Then** none of those non-size settings are modified, and the summary notification names only size-family changes.

### S34. User can bind their own keyboard shortcut to the reset command
- **Given** the extension is installed with default keybindings
- **When** the user opens VS Code's keyboard-shortcut UI
- **Then** the reset command is listed and bindable, but the extension itself ships no default keyboard shortcut for it.

### S35. Reset command exposes exactly three modes
- **Given** the extension is installed
- **When** the user opens the Command Palette, the scope/mode picker, or the preview view
- **Then** the only mode options offered are "Zoom only", "Font size only", and "Zoom and font size" — there is no "Custom" mode, no input for user-supplied command IDs, and no input for user-supplied setting keys (per ADR 0004).

## Invariants

- The extension must never alter any setting that is not in the size-family it owns. Size-family membership is determined by the discovery contract in ADR 0003 (curated list plus recognised suffix patterns); colours, themes, layouts, panel positions, keybindings, and unrelated settings must remain unchanged by every reset at every scope.
- The extension must never clear its own preference keys (confirmation enabled, summary-notification enabled, reload-and-don't-ask-again, Activity Bar visibility, and any other keys owned by the extension itself), regardless of mode or scope.
- The extension must never modify settings at a scope strictly above the scope the user picked for the invocation. "Above" is defined by ADR 0002's cascade: Session ⊂ Workspace ⊂ Global, where picking a broader rung clears the broader rung plus every narrower rung beneath it.
- The extension must never make any change without going through VS Code's documented public APIs: no out-of-band edits to `settings.json`, no writes to VS Code's internal storage, no reliance on undocumented or private command IDs. Writes to persisted settings always go through `WorkspaceConfiguration.update` with one of the three documented `ConfigurationTarget` values (`Global`, `Workspace`, `WorkspaceFolder`).
- The extension must never perform any work in the absence of an explicit user invocation: no startup activation cost, no background watchers, no schedulers, no telemetry, no behavioural learning, no idle-time activity.
- The extension must never reload the VS Code window unless a reset has been invoked and either (a) the user explicitly picked a reload option in the post-reset prompt, or (b) the user has previously enabled silent reloads and a reload is genuinely required by the changes that were just made.
- The extension must never restore a user's prior value for a size setting. "Reset" means "return to the built-in default" only; no snapshotting, no undo history, no per-user value memory.
- The extension must never call into another extension's internal APIs or mutate another extension's private storage. It may only clear settings keys it recognises as size-family via the documented discovery mechanism (ADR 0003).
- The extension must never destroy a persisted preference at a scope above "Session" without a confirmation prompt that names what will be removed, unless the user has explicitly opted out of confirmations via the extension's settings.
- The extension must never interrupt the user mid-reset with an error dialog for a single failed sub-step; partial failures must be tolerated and reported in the post-run summary and activity log instead.
- The extension must never accept user-supplied command IDs or arbitrary setting keys as inputs to the reset. The set of modes is closed under the three options enumerated in ADR 0004 (Zoom only, Font size only, Zoom and font size), and the set of keys touched is closed under the discovery contract (ADR 0003).
- The extension must never expose a fourth user-facing scope rung. The scope picker, confirmation dialog, and preview view present exactly three rungs (Session, Workspace, Global), per ADR 0002. Workspace-folder overrides are cleared as part of the Workspace rung; they are not a separate rung.
- The summary notification, the activity log, and the preview view must between them give the user a definite answer to "what did/would this do?" — the user must never have to diff `settings.json` to find out.
- Every reset invocation must record, in the activity log, both the set of keys *considered* (the union of the curated list and the suffix-matched keys present in the user's configuration at the targeted scopes, per ADR 0003) and the subset of those keys that were *changed*. This is what makes the "best-effort, not exhaustive" coverage contract verifiable by the user.
- The cascade's inclusion relationship must always be total and one-directional: a reset at a given rung clears that rung and every rung beneath it, and no other rungs.
- All user-facing copy describing the scope cascade must use destructiveness vocabulary ("the broader the scope you pick, the more places get cleaned"), never VS Code's precedence vocabulary, per ADR 0002.
