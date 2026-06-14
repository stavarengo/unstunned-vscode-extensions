# 0005. Preview view is read-only

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The Brief introduces a preview surface that shows, for the current editor state, exactly what each combination of (mode, scope) would change. The question was whether the preview should be a passive visibility surface or an interactive one — for example, with per-key checkboxes that let the user opt out of individual changes before invoking the reset. Interactivity is tempting because it directly addresses the "honest" guiding principle ("ask before erasing anything they configured"), but it changes the shape of the reset contract: the action stops being "reset everything in this (mode, scope)" and becomes "reset whatever the user happened to leave checked," which is hard to summarise in a confirmation dialog, hard to log meaningfully, and creates an implicit dependency between the preview view's state and the command's behaviour.

## Decision

The preview view is **read-only**. It shows the current state of the editor and what each (mode, scope) combination *would* change, but it never performs a reset itself, never offers per-key opt-in or opt-out, and never modifies any state — in-memory, settings, or extension preferences — purely as a result of being viewed. Acting on what the preview shows is done by invoking a reset command (from the Command Palette or via a button in the view that delegates to that same command, with the same confirmation and reload flow as any other invocation). The preview is one of several visibility surfaces — alongside the post-run summary notification and the activity log — and is positioned strictly on the "tell the user what would/did happen" side of the product, never on the "do the thing" side.

## Alternatives

**Interactive preview with per-key checkboxes.** Let the user untick individual keys to exclude them from the reset, then trigger the reset from the view. Rejected because it splits the reset contract into "all of (mode, scope)" and "whatever's checked in the preview," which makes the confirmation dialog ambiguous ("clear these keys, except the ones you unchecked over there"), complicates the activity log, and turns the preview into a stateful surface whose lifetime and identity have to be reasoned about. It also encourages users to construct one-off subsets of keys rather than reaching for the right (mode, scope) combination — undermining the "one command, one outcome" promise.

**Preview with a single "apply" button (no per-key controls) that triggers the reset.** Rejected as a halfway position: it still couples a visibility surface to an action surface, requires the view to track its own freshness against editor state, and offers no capability the Command Palette button doesn't already give. A button in the view that *delegates* to the reset command (without bypassing confirmation) is fine; a button that performs its own variant of the reset is not.

**No preview view; rely solely on the post-run notification and log.** Rejected because the Brief's success criteria call for a user to be able to *anticipate* what a reset will do before invoking it, not only verify after the fact. Without a preview, users have to commit to running a reset to learn what it will touch — exactly the friction the product exists to eliminate.

## Consequences

- The preview's rendering logic must be pure with respect to the underlying state: opening, refreshing, or closing the view causes no writes. State changes happen only when a reset command runs, regardless of whether the trigger was the Command Palette, a keybind, or a button in the preview.
- A "run reset" button in the preview view is permissible only if it delegates to the same reset command the Command Palette invokes, going through the same confirmation and reload flow. The preview cannot define its own action path.
- The view must compute "what would change at each (mode, scope)" independently of "which value currently wins" in VS Code's precedence — the destructiveness cascade (ADR 0002) and the precedence model are different questions, and the preview answers the first.
- The product surface stays small: three modes, three scopes, one preview, one log, one notification. No surface gains an additional behavioural mode by being a preview.
- If interactive previewing is requested in the future, it would require its own ADR and a clear answer to the open questions raised under the rejected alternatives.
