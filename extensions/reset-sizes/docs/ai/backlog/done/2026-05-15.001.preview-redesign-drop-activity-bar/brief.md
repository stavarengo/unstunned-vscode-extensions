# Brief — Preview redesign and Activity Bar retirement

## Why

After shipping the `reset-sizes-revamp` build, the user opened the new Preview view and reported it as "confusing and almost impossible to understand." A look at the rendered page (`current-preview-screenshot.png`) confirms the diagnosis: nine cells of nearly-identical body copy, no visual hierarchy between row labels, column labels, and cell content, primary buttons that recede into the panel chrome, and verbose action labels that repeat the cell's own coordinates. The Preview is the surface the product points users to with the promise "see what a reset would do before running it" — if a user cannot read it at a glance, that promise is broken.

The same Preview is reachable from two entry points that, in practice, do the same thing. The Command Palette opens the Preview panel directly. The Activity Bar icon — gated behind a setting the user must discover and enable — opens a sidebar placeholder webview whose only purpose is to open the same Preview panel. The user assumed the two entry points were the same surface, and when told they aren't, asked for the sidebar one to be dropped. The Activity Bar entry exists, requires its own manifest contributions, view container, placeholder webview, gating setting, and test suite, and gives the user nothing the Command Palette doesn't already give.

This feature is one redesign and one retirement, packaged together because the user reported both observations in the same session. The redesign affects only the Preview's visual presentation; the retirement affects only the Activity Bar entry point. Neither touches the reset behaviour, the data model, the discovery contract, the cascade, the confirmation flow, the reload flow, the activity log, or the summary notification.

## Who it's for

The same audience as the original product — VS Code users who occasionally leave the editor in a size state they didn't choose and want a one-purpose utility to put it back. This feature changes nothing about who the product is for; it changes how readable one of the existing surfaces is and removes a vestigial entry point.

## What success looks like

A user opens the Preview and, within a few seconds of scanning, can answer three questions without reading every cell in full:

- Which cells would actually do something if I ran them?
- Among the active cells, where is the primary action I would click?
- Which cells are "no-op" right now, and why?

They never have to puzzle out which row is a label, which column is a header, or which paragraph is body copy. The matrix structure (mode × scope) is legible at a glance. Empty cells are visibly demoted but still informative — they say *why* nothing would change, they do not present an active button that runs a no-op. Primary action buttons stand out from the panel chrome and read as buttons, not as captions.

For the Activity Bar retirement: a fresh install contributes no Activity Bar icon, no view container, no sidebar slot, and no `resetSizes.showInActivityBar` setting. The Preview remains reachable from the Command Palette (`resetSizes.openPreview`) and from the markdown link in the extension's settings page (`resetSizes.showSummaryNotification.markdownDescription`). A user who previously enabled `resetSizes.showInActivityBar` sees the icon disappear because the manifest no longer contributes it. The key itself may remain in their `settings.json` as an unknown setting (VS Code does not delete user-owned keys) and is simply ignored on read; the extension makes no effort to remove or migrate it.

Concretely, the feature is succeeding when:

- A first-time reader of the Preview can identify the row labels, column labels, and per-cell primary action without instruction.
- A cell with nothing to do is visibly distinct from a cell that would clear many keys, and does not invite the user to click a button that does nothing.
- A cell that would require a window reload is flagged unambiguously before the user clicks "Run reset".
- The Activity Bar surface no longer exists in the manifest, the source, or the test suite.
- The Preview's behaviour contract (read-only, no writes on open/close/refresh, postMessage-only action path, same `runReset` confirmation/reload flow, remote-adaptive Global label, CSP-nonced inline script, exactly nine cells) is byte-for-byte preserved.

## What the user can do

### See the Preview, clearly

The Preview keeps its identity as a read-only 3×3 view of "what each (mode, scope) combination would change against the current editor state." The redesign is a visual rebuild of that same matrix, not a restructuring of it. The matrix is the right shape — the data is intrinsically two-dimensional (mode is one axis, scope is the other), and the destructiveness cascade runs along the scope axis. Users compare cells across scopes within a mode ("if I want to reset font sizes, how far does each rung reach?") and across modes within a scope ("at Workspace scope, what's the difference between Zoom only and Zoom and font size?"). Flattening the matrix into a one-dimensional list would break the comparison that makes the surface useful.

What changes is the **legibility** of the matrix:

- **Row labels** (the three modes: "Zoom only", "Font size only", "Zoom and font size") and **column headers** (the three scope labels, with Global adapting to "User settings (remote)" when `vscode.env.remoteName` is set) are visually distinct from cell body content. A reader looking at the page never has to guess "is this a label or part of a cell?"
- **One true primary action per cell.** Each cell carries one button — "Run reset" — whose role is to delegate to the same `resetSizes.resetAll` command path with that cell's (mode, scope) pre-selected. The button stands out from the panel surface (real button affordance, not a chrome-coloured text link). Verbose self-referential labels like "Run reset (Zoom only at Session)" are not the cell's job to carry — the cell's row and column already name its coordinates. A cell that would change nothing demotes or omits its action button rather than presenting an active button for a no-op.
- **Cell content is scannable, not a wall of text.** Each cell summarises its outcome at a glance (counts, status badges, or single-line summaries) before going into the detail of *which* keys would be cleared or *which* zoom commands would run. The detail is still present and still discoverable — the user must always be able to see, on the surface, the same data the activity log and confirmation dialog would name — but it does not dominate the first read.
- **Empty cells inform.** A cell where the reset would change nothing reads as a one-line caption that tells the user *why* the cell is quiet, in the same demoted style the existing renderer already uses for the "none" placeholder. The reasons are structural and known to the existing matrix data (`computePreviewMatrix`): Font size only at Session is always quiet by design (Session is in-memory only, Font size only touches no zoom); Font size only at Workspace or Global is quiet when discovery found no size-family keys at that scope. Silence is more confusing than a short caption, and the captions are derivable from the data already on the matrix — the redesign does not need new state detection.
- **Reload-required cells are flagged before action.** The existing per-cell reload hint is preserved and made visually unambiguous (it is no longer an afterthought after a paragraph of body copy).
- **Visual language stays native to VS Code.** All colours, weights, and surfaces come from VS Code's theme variables — `--vscode-foreground`, `--vscode-button-background`, `--vscode-button-foreground`, `--vscode-descriptionForeground`, `--vscode-panel-border`, `--vscode-editorWidget-background`, `--vscode-editorWarning-foreground`, and equivalents. No literal colours. The webview must render correctly in light, dark, and high-contrast themes, and must honour `vscode-reduce-motion` if any motion is introduced (the redesign should not introduce motion gratuitously).
- **No external assets.** The webview continues to load no external fonts, icons, stylesheets, or scripts — the existing CSP (`default-src 'none'`, nonce-gated inline script, `style-src ${cspSource} 'unsafe-inline'`) remains the upper bound on what the page may fetch.
- **The intro copy** (the small paragraph above the matrix) is shorter and meaningful — it sets the read-only, "click Run reset to go through the same confirmation/reload flow as the Command Palette" expectation in one sentence at most, rather than the current two-sentence paragraph the user skips.

The Preview opens in the main editor area (`ViewColumn.Active`), as it does today. It is not designed for a narrow sidebar; the redesign assumes the editor-area width that has been the panel's home since Slice 4.

### Stop seeing an Activity Bar icon

The Activity Bar entry point is **retired**. Specifically:

- The `resetSizes.showInActivityBar` setting is removed from the manifest. Users who previously enabled it see no migration prompt; the key simply stops being a recognised contribution. Any value remaining in their `settings.json` is left there (VS Code may flag it as an unknown setting, but does not delete user-owned keys) and has no effect. This is consistent with the product's "we own no migration state" stance.
- The `resetSizesActivityBar` view container (under `contributes.viewsContainers.activitybar`) is removed from the manifest, along with its icon file.
- The `resetSizesActivityBarView` webview view (under `contributes.views`) is removed from the manifest.
- The `onView:resetSizesActivityBarView` activation event is removed from `activationEvents`.
- The supporting source (`src/preview/activityBarView.ts`) and its test suite (`src/test/suite/activityBarView.test.ts`) are removed.
- The Activity Bar block in `src/test/suite/extension.test.ts` (currently asserting the manifest's view container, the gating `when` clause, the setting declaration, and the icon file existence) is removed.
- The `registerActivityBarView` call in `src/extension.ts` is removed.

The Preview remains reachable from exactly two entry points after the retirement:

1. **Command Palette** — `resetSizes.openPreview` is unchanged.
2. **Settings page** — the existing markdown link in `resetSizes.showSummaryNotification.markdownDescription` is unchanged.

### Trigger a reset from the Preview, unchanged

Each cell still carries one "Run reset" button that delegates to `runReset(mode, scope, channel)` via the existing `run-reset` postMessage protocol. Clicking a cell's button is byte-for-byte identical, behaviourally, to choosing the same (mode, scope) from the Command Palette — same confirmation dialog (if enabled), same reload flow, same activity log entry, same summary notification. ADR 0005 binds: the Preview never defines its own action path, never adds per-key opt-out, never modifies state purely by being viewed.

## Safety and behavioural constraints

Everything in the previous feature's contract (`docs/ai/backlog/done/2026-05-15.000.reset-sizes-revamp/contract.md`) that is not explicitly amended by this feature continues to hold. The redesign is a visual rebuild of one surface; the retirement is a removal of a second entry point. The reset behaviour, the discovery contract (ADR 0003), the cascade (ADR 0002), the read-only Preview principle (ADR 0005), the closed three-mode contract (ADR 0004), the partial-failure tolerance, the reload flow, the activity log, the summary notification, the confirmation dialog, and every invariant under "Invariants" in the contract are unchanged.

Specifically, the redesign **must preserve**:

- **S15** — Global scope is labelled "User settings (remote)" when `vscode.env.remoteName` is non-empty.
- **S27** — the Preview displays, for each of the three modes × three scopes, the specific changes that would occur if that combination were invoked against current state.
- **S28** — opening, refreshing, or closing the Preview produces zero writes (the byte-equal snapshot test must still pass).
- **S29** — clicking a "Run reset" button invokes the same `runReset(mode, scope, channel)` path the Command Palette uses, with the same confirmation and reload flow.
- **S35** — exactly three modes; no "Custom" option, no user-supplied command IDs, no user-supplied setting keys.
- **CSP** — `default-src 'none'`, nonce-gated inline `<script>`, no external assets. The inline script remains a thin click dispatcher that does not store state, observe the DOM beyond click events, or define its own action path.

The retirement **amends** the contract in three places (the contract-writer downstream is responsible for revising these — the redesign and retirement do not happen in a vacuum):

- **S27** currently lists "the Activity Bar entry (if enabled)" as one of the Preview's entry points. That phrase is dropped; the Preview is now reachable from the Command Palette and the settings-page markdown link.
- **S30** ("Activity Bar icon is hidden by default") is **retired**. The Activity Bar surface no longer exists.
- **S31** ("Activity Bar icon appears when the user enables it") is **retired**. The Activity Bar surface no longer exists.

The "Invariants" block in the contract is unchanged by either half of this feature.

## What's out of scope

- **New commands, new settings, new behaviours.** This feature changes how one surface looks and removes a second entry point. It does not add new modes, scopes, presets, allowlists, or preferences.
- **Per-key opt-out or interactive preview.** ADR 0005 still binds. The Preview is read-only — no per-key checkboxes, no "apply only some" path, no separate action surface from the cell's "Run reset" button.
- **"Show only cells that would do something" filter toggle.** The research file raises this as a possible feature (echoing the Settings editor's `@modified` operator). It is **out of scope** for this feature. The redesign's job is to make a no-op cell visibly distinct from a busy cell, not to hide cells from the user. A filter toggle would introduce client-side selection state into a webview whose script is a thin click dispatcher, and would risk hiding the matrix structure the redesign is trying to make legible. If demand emerges, it is a separate feature.
- **Global reload-required banner.** The research file raises this as a possible feature (a single banner at the top when any cell requires reload). It is **out of scope** for this feature. Per-cell reload flagging stays, and is made visually unambiguous; a global banner would duplicate that flagging and is unnecessary for nine cells viewed together.
- **Restoring an Activity Bar surface later.** A future user may ask for a sidebar entry to the Preview again. That would require a new ADR explaining what the sidebar surface adds over the Command Palette and the settings link — the current evidence is that it adds nothing.
- **Migration tooling for `resetSizes.showInActivityBar`.** Users who previously enabled the setting see it stop being recognised on next read. This is consistent with the product's "we own no migration state" stance and with VS Code's standard behaviour for retired manifest contributions.
- **Keybinding shipped by default.** Unchanged from the original Brief — no default keybinding ships; users bind their own via VS Code's keyboard-shortcut UI.
- **Layout, theme, colour, sync, backup, scheduler, or telemetry features.** All explicitly out of scope from the original Brief; the redesign and retirement do not relax any of those exclusions.

## Open questions

The questions below would refine the brief if answered, but none of them block the feature. The redesign and retirement can proceed with the answers the brief takes by default.

1. **Empty-cell caption wording.** A no-op cell should explain *why* it is empty (per the research file's empty-state guidance). The brief takes the default that the cell shows a short, context-aware caption tied to the reason — e.g. "Session resets in-memory zoom only; Font size only has no zoom work to do." for the structurally-quiet `(fontSize, session)` cell, or "No size-family keys set at this scope." for a Font size cell where discovery found nothing. The question is whether a single generic copy line ("Nothing to clear here.") would read better and be easier to maintain than a context-aware one. Default: short context-aware captions, derived from the same matrix data the renderer already has.

2. **Should the empty cell omit the "Run reset" button entirely, or render it disabled?** Both convey "nothing to do." The brief takes the default that an empty cell **omits** the button — a disabled button still draws the eye and invites a click. Rendering it disabled would, however, keep the cell grid more uniform. Default: omit.

3. **Is the markdown link in `resetSizes.showSummaryNotification.markdownDescription` enough of a settings-page entry point, or should the brief also surface a dedicated `resetSizes.openPreview` link the user can scan for without reading the surrounding paragraph?** The existing link is embedded in a description aimed at the summary-notification setting, which means a user looking specifically for the Preview has to read past unrelated copy. Default: the existing link is enough; settings-page copy is a separate redesign question and would expand this feature's scope.
