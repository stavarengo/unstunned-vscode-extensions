# 0001. Reset scope ladder as a UX construct, not VS Code's precedence

- **Status:** Superseded by 0002
- **Date:** 2026-05-15

## Context

The reset command operates across multiple settings layers: in-memory session state, workspace settings, remote-environment settings, and user (global) settings. VS Code's own configuration system has a well-defined precedence order in which these layers override one another (`default < user < remote < workspace < workspaceFolder`). We had to pick an ordering that the user navigates when choosing "how far" a reset reaches, and decide whether that ordering mirrors VS Code's precedence or is its own thing.

## Decision

The reset command exposes a **destructiveness ladder** — an ordered list of scopes where picking a rung also resets every rung below it. The ladder is a UX construct, ordered by how much persisted state a reset destroys, and is **intentionally distinct from VS Code's configuration precedence**. Rungs are presented to the user from least to most destructive (session at the bottom, user/global at the top), and the contract is uniform: "the higher the rung you choose, the more places get cleaned." A reset at rung N touches rung N and every rung beneath it.

## Alternatives

**Mirror VS Code's configuration precedence directly.** Use the same ordering VS Code uses internally so that "scope" means the same thing in both places. Rejected because precedence answers "which value wins when layers conflict?" while the user's question here is "how much of my saved configuration am I willing to erase?" Those are different questions, and conflating them would force users to reason about override semantics to predict what a reset will delete — exactly the scavenger hunt the product exists to eliminate.

**Offer independent per-scope toggles instead of a ladder.** Let the user tick any subset of (session, workspace, remote, user) per invocation. Rejected as too much surface for a one-purpose utility: it expands the decision space combinatorially, makes the confirmation dialog harder to summarise, and invites footgun combinations (e.g. clear user but leave workspace, which keeps the offending value in effect).

**Single all-or-nothing reset.** No scope choice — always reset everything, or always reset only session. Rejected because the Brief's success criteria explicitly require both a non-destructive session-only path (no confirmation, no reload) and a deep-clean path that reaches global settings, and the destructiveness gradient between them carries real user-visible consequences (confirmation prompts, reload prompts, what's recoverable).

## Consequences

- Documentation and UI copy must consistently describe the ladder in destructiveness terms ("the bigger the rung, the more places get cleaned"), never in precedence terms. Mixing vocabularies will confuse users who know VS Code's settings model.
- The confirmation dialog can present a single, ordered summary of what each higher rung adds, because the inclusion relationship is total — there is always a strict "everything below" set to name.
- Future code that resolves settings values for the preview view must not assume the ladder order matches the order VS Code uses to compute effective values; the preview must compute "what would change at each rung" independently of "which value currently wins."
- The specific rungs and their relative order remain partially open (the Brief flags remote's position as unresolved); this ADR commits only to the *shape* of the model — an ordered, inclusive, destructiveness-based ladder — not to the final rung list. A later ADR will fix the rungs once that open question is resolved.
- If a future maintainer is tempted to "fix" the ladder to match VS Code precedence on the grounds of consistency, this ADR is the record of why that consistency was rejected.
