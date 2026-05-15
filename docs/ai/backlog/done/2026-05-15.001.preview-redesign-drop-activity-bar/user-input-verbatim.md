# User input — verbatim

> Context: The user just installed the freshly-built `reset-sizes-revamp` build (shipped in the previous feature folder `2026-05-15.000.reset-sizes-revamp`). After verifying the manifest fix, they reported these observations and asked for a redesign of the Preview view.

## What the user said

> "The activity log does not open. I got this messages on the 'Extension page':
>
> ```
> Activation
> Activated by onCommand:resetSizes.openActivityLog event: 0ms
>
> Messages (2)
>  property id is mandatory and must be of type string with non-empty value. Only alphanumeric characters, '_', and '-' are allowed.
>
>  View container 'resetSizes.activityBarContainer' does not exist and all views registered to it will be added to 'Explorer'.
> ```
>
> The reset view preview opens fine :) but it needs a better design. The current view is confuse and almost impossible to understand.
> I need you to perform a research on UI/UX for this view and them make the implementation."

## Clarifying answers from the user

1. **Activity-log bug**: fixed in a separate commit before this feature folder was created (see `fix(activity-bar): rename view container/view IDs to satisfy manifest constraint`). The dot-in-id was rejected by VS Code's manifest validator. **No longer in scope for this feature.**

2. **Redesign scope**: "Yes — preview visuals only" — the read-only Preview panel (the 3×3 mode×scope matrix). No new commands, no behavior changes, no new settings. Same data, better presentation.

3. **Activity Bar sidebar view**: "We don't need that Activity Bar sidebar view. I actually thought it was the same thing, so if they can't be the same thing, I'm fine dropping the sidebar view."
   - **Drop** the Activity Bar entry container, the `resetSizesActivityBar` view container, the `resetSizesActivityBarView` webview, the placeholder webview view provider, the `resetSizes.showInActivityBar` setting, and the supporting tests.
   - The Preview remains reachable from the Command Palette (`resetSizes.openPreview`) and from the markdown link in `resetSizes.showSummaryNotification.markdownDescription`.

4. **Screenshot of the current Preview**: saved alongside this file as `current-preview-screenshot.png`. This is the visual evidence behind "confusing and almost impossible to understand."

## Observable problems in the current Preview (from the screenshot)

These are orchestrator-recorded observations, not user words — provided to seed the brief agent. The brief agent should validate them against the rendered HTML and form its own assessment.

- **Wall of text in every cell.** Each of the nine cells repeats a similar paragraph structure (intro line + multi-line code block listing keys + button). Hard to scan. No way to tell at a glance which cells matter.
- **Weak hierarchy.** Row labels ("Zoom only", "Font size only", "Zoom and font size") and column headers ("Session", "Workspace", "User settings (remote)") are not visually distinguished from body copy. The matrix structure is not legible.
- **Buttons recede into chrome.** "Run reset (… at …)" buttons look like the same color as panel surfaces.
- **No empty-state differentiation.** A cell where nothing would change looks visually identical to a cell that would clear many keys.
- **Dense action labels.** Each button verbosely repeats the mode and scope, making the buttons themselves hard to scan.
- **Tiny intro text** that the user probably skips.
- **No grouping signals.** Mode rows and scope columns aren't framed as a matrix — could feel like a list of nine unrelated panels.

## What the redesign must preserve

Behaviour contract (`docs/ai/backlog/done/2026-05-15.000.reset-sizes-revamp/contract.md`) still applies. Specifically:

- **Read-only** (ADR 0005). Buttons in the panel still delegate to the same `runReset` orchestrator path — they don't introduce new behaviour or bypass the confirmation gate.
- **No writes on open/close** (S28). Byte-equal snapshot test must still pass.
- **Closed set of three modes × three scopes** (S35, S6, S7).
- **Remote-adaptive label** on the Global scope when `vscode.env.remoteName` is set (S15).
- **CSP-nonced inline script** for `postMessage` wiring (S29). No external JS or CSS hosts.
