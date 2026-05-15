# Behaviour Contract: preview-redesign-drop-activity-bar

**Brief:** docs/ai/backlog/todo/2026-05-15.001.preview-redesign-drop-activity-bar/brief.md
**ADRs in scope:**
- docs/ai/backlog/todo/2026-05-15.001.preview-redesign-drop-activity-bar/adr.0006-retire-activity-bar-entry-point.md

This Contract is an addendum to `docs/ai/backlog/done/2026-05-15.000.reset-sizes-revamp/contract.md`. Every scenario and invariant in the previous contract continues to hold except where this document explicitly amends, retires, or supersedes it. ADRs 0002–0005 (from the previous feature) remain binding; ADR 0006 (this feature) is additive and does not supersede any prior ADR. Vocabulary follows the previous contract's destructiveness convention.

Scenario numbering continues from the previous contract (which ends at S35) so that future amendments can cite a globally-unique ID.

## Scenarios

### Amendments to the previous contract

#### S27 (amended). Preview view shows what each (mode, scope) combination would change
- **Given** a user opens the Preview view from the Command Palette (`resetSizes.openPreview`) or from the markdown link in `resetSizes.showSummaryNotification.markdownDescription` on the settings page
- **When** the Preview renders against the current editor state
- **Then** the Preview displays, for each combination of mode (Zoom only, Font size only, Zoom and font size) and scope (Session, Workspace, Global — with Global presented per S15), the specific changes that would occur if that combination were invoked.

The phrase "the Activity Bar entry (if enabled)" from the previous S27 is removed. The Preview is reachable from exactly the two entry points named above.

#### S30 (retired). Activity Bar icon is hidden by default
Retired. The Activity Bar surface no longer exists. See S36 and S37 below for the deletion behaviour.

#### S31 (retired). Activity Bar icon appears when the user enables it
Retired. The Activity Bar surface no longer exists. The `resetSizes.showInActivityBar` setting is removed from the manifest; see S37.

### Visual hierarchy and legibility

#### S36. Row labels and column headers are visually distinct from cell body content
- **Given** the Preview is open against any editor state
- **When** a first-time reader scans the page
- **Then** the three mode labels ("Zoom only", "Font size only", "Zoom and font size") and the three scope labels (per S15) are rendered with a visual treatment (weight, size, surface, alignment, or a combination of these — drawn only from VS Code theme variables) that distinguishes them from the body content of any cell, such that the reader can identify which text is a label and which text is cell content without instruction.

#### S37. Each active cell summarises its outcome before detail
- **Given** a cell whose (mode, scope) combination would change at least one thing against the current editor state
- **When** the cell renders
- **Then** the cell shows a glance-level summary of its outcome (e.g. a count of keys to be cleared, a count of zoom commands to be run, a reload-required indicator, or an equivalent badge or short summary line) positioned above the detail listing of which specific keys would be cleared or which specific zoom commands would run. The detail listing remains present and discoverable on the same surface — the summary does not replace it.

#### S38. The "Run reset" primary action is visually distinct from panel chrome
- **Given** any cell whose (mode, scope) combination would change at least one thing
- **When** the cell renders
- **Then** the cell carries exactly one "Run reset" action affordance whose visual treatment (background, foreground, border, or a combination — drawn only from VS Code's button-related theme variables such as `--vscode-button-background` and `--vscode-button-foreground`) reads as a button rather than as caption text or panel surface; and the action label does not repeat the cell's own mode or scope coordinates verbosely (the row and column already name them).

#### S39. Reload-required cells are flagged unambiguously before action
- **Given** a cell whose (mode, scope) combination would apply at least one change that only takes effect after a window reload
- **When** the cell renders
- **Then** the cell carries a clearly visible reload indicator (e.g. an icon, badge, or labelled flag) that is part of the cell's summary line or otherwise positioned where the reader sees it before locating the "Run reset" button — not buried after a paragraph of body copy. The indicator's visual treatment is drawn from VS Code theme variables (e.g. `--vscode-editorWarning-foreground` or equivalent).

#### S40. Intro copy is a single short sentence
- **Given** the Preview is open
- **When** the page renders
- **Then** the introductory copy above the matrix consists of at most one short sentence that sets the read-only expectation and points at the "Run reset" affordance; multi-sentence paragraphs of intro copy are not present.

### Empty-state differentiation

#### S41. Structurally-quiet cell (Font size only at Session) shows a contextual caption and omits the button
- **Given** the Preview is open and the cell at (Font size only, Session) is rendered
- **When** the cell renders
- **Then** the cell shows a short demoted caption explaining why it is quiet — that Session resets in-memory zoom only and Font size only has no zoom work to perform — using `--vscode-descriptionForeground` (or an equivalent demoted theme token), and the cell does **not** render a "Run reset" button (active or disabled).

#### S42. Discovery-empty Font size cell shows a contextual caption and omits the button
- **Given** the Preview is open and either the (Font size only, Workspace) cell or the (Font size only, Global) cell would change nothing because the discovery pass (per ADR 0003) found no size-family keys set at that scope
- **When** the cell renders
- **Then** the cell shows a short demoted caption explaining that no size-family keys are set at that scope, using `--vscode-descriptionForeground` (or an equivalent demoted theme token), and the cell does **not** render a "Run reset" button (active or disabled).

#### S43. Any other cell that would change nothing shows a contextual caption and omits the button
- **Given** any (mode, scope) cell other than the two structurally-quiet patterns above where the matrix data reports no changes would be applied
- **When** the cell renders
- **Then** the cell shows a short demoted caption derived from the matrix data describing why nothing would change, using the same demoted theme token as S41 and S42, and the cell does **not** render a "Run reset" button (active or disabled).

#### S44. An empty cell is visibly distinct from an active cell at a glance
- **Given** a Preview rendering with at least one empty cell and at least one active cell
- **When** the reader scans the page
- **Then** the empty cell reads as visibly demoted relative to the active cell (lower contrast text, no button affordance) such that a reader can tell which cells would do something and which would not without reading the cell's body text in full.

### Accessibility and theme adaptation

#### S45. The Preview renders correctly under light, dark, and high-contrast themes
- **Given** the user has activated any of VS Code's built-in light, dark, or high-contrast themes (with the corresponding `vscode-light`, `vscode-dark`, or `vscode-high-contrast` body class applied to the webview)
- **When** the Preview is opened
- **Then** every text element is legible against its surface, the matrix's row labels, column headers, cell bodies, primary buttons, demoted captions, and reload indicators are all readable at the active theme's contrast level, and no literal colour values are used — every colour is sourced from a VS Code theme variable.

#### S46. Every "Run reset" button is reachable by keyboard with a visible focus indicator
- **Given** the Preview is open and at least one cell renders a "Run reset" button
- **When** the user navigates the Preview using only the keyboard (Tab / Shift+Tab)
- **Then** every "Run reset" button is reachable in a predictable order, the currently-focused button shows a visible focus indicator drawn from VS Code's focus-related theme variables, and pressing Enter or Space on a focused button invokes the same `runReset(mode, scope, channel)` path as a mouse click (per S29).

#### S47. The matrix's row/column structure is conveyed to assistive technology
- **Given** the Preview is open and the body has the `vscode-using-screen-reader` class (or the user is otherwise using a screen reader)
- **When** the user navigates the matrix
- **Then** each cell's mode and scope are announced to the assistive technology (either via the matrix's semantic structure or via accessible names/labels attached to the cell content), the summary line for each cell is announced before its detail listing, empty-cell captions are announced as part of the cell's content, and reload-required indicators are conveyed by an accessible name or label (not by colour alone).

#### S48. The Preview introduces no motion that disregards `vscode-reduce-motion`
- **Given** the Preview is open and the body has the `vscode-reduce-motion` class
- **When** the page renders and the user interacts with it
- **Then** no transitions, animations, or motion-bearing decorations play that would not also play in the absence of `vscode-reduce-motion`. (The Preview is permitted to introduce no motion at all; if any motion is introduced, it must be gated by the absence of this class.)

### Deletions performed by this feature

#### S49. A fresh install contributes no Activity Bar surface
- **Given** a freshly installed extension with no prior user configuration
- **When** the user opens VS Code's Activity Bar and inspects the extension's contributions
- **Then** the extension contributes no Activity Bar icon, no view container (specifically, no `resetSizesActivityBar` container), no view (specifically, no `resetSizesActivityBarView` view), no `onView:resetSizesActivityBarView` activation event, and the manifest declares no `resetSizes.showInActivityBar` setting under `contributes.configuration.properties`.

#### S50. A user who previously enabled `resetSizes.showInActivityBar` sees no icon after upgrade
- **Given** a user who installed the previous build, enabled `resetSizes.showInActivityBar` in their `settings.json`, and then upgrades to a build that includes this feature
- **When** VS Code applies the configuration after the upgrade
- **Then** the Activity Bar icon does not appear (the manifest no longer contributes it), the leftover `resetSizes.showInActivityBar` key in the user's `settings.json` is not modified, removed, or migrated by the extension, and the leftover key has no observable effect on the extension's behaviour. (VS Code itself may surface the key as an unknown setting; that is outside the extension's responsibility.)

#### S51. The Preview is reachable from exactly two entry points
- **Given** the extension is installed (fresh install or post-upgrade)
- **When** the user looks for ways to open the Preview
- **Then** the Preview is reachable from exactly two entry points: (a) the Command Palette command `resetSizes.openPreview`, and (b) the markdown link embedded in the description of the `resetSizes.showSummaryNotification` setting on the extension's settings page. No third entry point (Activity Bar, status bar, editor title-bar action, or other) is contributed.

### Preserved scenarios (referenced, not restated)

The following scenarios from the previous contract continue to hold without amendment and govern the Preview's behaviour after this redesign:

- **S15** — Global scope is labelled "User settings (remote)" when `vscode.env.remoteName` is non-empty. The Preview's column header for the Global scope adapts accordingly.
- **S28** — Opening, refreshing, or closing the Preview produces zero writes (the byte-equal snapshot test continues to pass).
- **S29** — Clicking a "Run reset" button invokes the same `runReset(mode, scope, channel)` path the Command Palette uses, with the same confirmation prompt (if enabled) and the same reload flow (S16–S22).
- **S35** — The Preview presents exactly three modes (Zoom only, Font size only, Zoom and font size). No "Custom" mode, no user-supplied command IDs, no user-supplied setting keys.

## Invariants

The previous contract's invariants block continues to hold in full. The following invariants are added by this feature:

- **No new user-facing behaviour.** This feature introduces no new commands, settings, presets, modes, scopes, allowlists, or preferences. The only manifest changes are the deletions enumerated in S49 (and the corresponding source/test deletions). Any change to the manifest's `contributes.commands`, `contributes.configuration`, or any other user-facing surface beyond the four explicit deletions is out of scope.
- **No writes from opening, refreshing, re-rendering, or closing the Preview.** The redesign is a visual rebuild of the same read-only surface (per ADR 0005). The Preview must produce zero writes to any setting at any scope and zero changes to any in-memory state purely as a result of the user opening the view, the view refreshing on a configuration change, the view being re-rendered for any reason, or the user closing the view. The byte-equal snapshot test that guards S28 in the previous contract must continue to pass against this redesign with no relaxation.
- **No literal colours, weights, or surfaces in the Preview.** Every colour, every text weight associated with theme tokens, every border, every surface fill, every focus ring, and every demoted-text treatment in the Preview's rendered HTML must be sourced from a VS Code theme variable (e.g. `--vscode-foreground`, `--vscode-button-background`, `--vscode-button-foreground`, `--vscode-descriptionForeground`, `--vscode-panel-border`, `--vscode-editorWidget-background`, `--vscode-editorWarning-foreground`, focus-related variables, and equivalents). Literal hex codes, named colours, or RGB/HSL values are not present in the inline style block.
- **No active "Run reset" button on a no-op cell.** A cell whose (mode, scope) combination would change nothing against the current editor state must never render an active "Run reset" button. It must also not render a disabled "Run reset" button — the button is omitted entirely (per the brief's default for open question 2, ratified here).
- **Empty-state captions derive from existing matrix data.** The text shown for a no-op cell must be derivable from the matrix data already produced by `computePreviewMatrix` (the existing data path documented in the brief). The Preview must not introduce a new state-detection pass, a new IPC call, a new discovery scan, or any side-effecting computation purely to phrase its empty-cell captions.
- **CSP is unchanged.** The Preview's Content Security Policy remains `default-src 'none'`, with a nonce-gated inline `<script>` and `style-src ${cspSource} 'unsafe-inline'`. The webview loads no external fonts, icons, stylesheets, or scripts. The inline `<script>` remains a thin click dispatcher: it wires click (and keyboard-activation, per S46) events on "Run reset" affordances to `postMessage({ kind: 'run-reset', mode, scope })` and does nothing else — it stores no state of its own, does not observe the DOM beyond the events it handles, and does not define its own action path.
- **No client-side selection or filter state in the webview.** The webview does not maintain selection state, filter state, expand/collapse state, or any other client-side state across renders. There is no "show only cells that would do something" toggle, no per-cell expand/collapse persistence, no client-side sort or hide. (A future feature may add such state; this feature does not.)
- **No new entry points to the Preview.** The Preview must be reachable from exactly the two entry points named in S51. The extension must not contribute a status-bar item, an editor title-bar action, a Welcome page entry, a tree-view entry, or any other entry point to the Preview as part of this feature.
- **The Activity Bar contributions must remain absent.** The manifest must not contribute a view container under `contributes.viewsContainers.activitybar` that is owned by this extension, must not contribute a view under `contributes.views` that is owned by this extension and targets such a container, must not declare an `onView:resetSizesActivityBarView` (or equivalent) activation event, and must not declare a `resetSizes.showInActivityBar` (or equivalent gating) setting. Reintroducing any of these requires a new ADR superseding ADR 0006.
