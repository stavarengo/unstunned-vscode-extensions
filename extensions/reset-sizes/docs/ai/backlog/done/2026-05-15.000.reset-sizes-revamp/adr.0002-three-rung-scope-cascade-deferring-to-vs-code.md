# 0002. Three-rung scope cascade deferring to VS Code's `ConfigurationTarget`

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

ADR 0001 committed to the *shape* of the scope model — an ordered, inclusive, destructiveness-based ladder that is a UX construct distinct from VS Code's configuration precedence — but left the specific rungs partially open. It enumerated four rungs (`session`, `workspace`, `remote`, `user`) and noted that remote's position was unresolved. User clarification has since settled three related questions: scopes should defer to VS Code's `ConfigurationTarget` rather than inventing new semantics; "remote" is not an independent persistence layer in VS Code's API but a contextual flavour of the `Global` target; and workspace-folder settings should be folded into the workspace rung rather than exposed as their own. A successor ADR is needed because the rung list and cascade wording in ADR 0001 are stale.

## Decision

The scope picker exposes exactly three rungs — **Session**, **Workspace**, **Global** — and the cascade is framed as "the broader the scope you pick, the more places get cleaned": picking Global clears Global + Workspace + Session; picking Workspace clears Workspace + Session; picking Session clears only Session. Each rung maps to VS Code's persistence model without remodelling it. **Session** is the in-memory rung that no `ConfigurationTarget` represents; it undoes zoom and other transient state. **Workspace** writes `ConfigurationTarget.Workspace` for the workspace file and iterates each workspace folder writing `ConfigurationTarget.WorkspaceFolder` to clear folder-level overrides — folders are part of Workspace, not a separate rung. **Global** writes `ConfigurationTarget.Global`; when `vscode.env.remoteName` is non-empty, VS Code routes that write to the remote's user settings, and the UI may surface this with a context-adaptive label (e.g. "User settings (remote)"), but there is one underlying target, not two. The product owns the cascade as a UX construct; it does not own the persistence model, the list of valid targets, or the rules for where each target is stored.

## Alternatives

**Keep ADR 0001's four-rung list (session / workspace / remote / user) with remote as its own rung.** Rejected because VS Code does not expose a separate `Remote` target. Modelling remote as a peer of workspace and user would force the extension to invent persistence semantics on top of VS Code's API and create a rung whose behaviour was indistinguishable from `Global` whenever a remote host was attached, and impossible to populate whenever one wasn't.

**Expose `WorkspaceFolder` as a fourth rung between Session and Workspace.** Rejected because the product is a "quiet utility" and adding a fourth rung doubles the decision surface for a case most users do not consciously distinguish from "workspace." Clearing folder overrides as part of the Workspace rung gives the predictable "broader scope cleans more" guarantee without asking users to learn VS Code's folder-vs-workspace distinction.

**Drop the cascade and treat each rung as independent.** Rejected for the same reason ADR 0001 rejected independent per-scope toggles: it expands the decision space combinatorially, complicates the confirmation summary, and invites footgun combinations (e.g. clearing Global while leaving Workspace, leaving the offending value still in effect).

## Consequences

- All user-facing copy, confirmation dialogs, and the preview view must enumerate exactly three rungs and describe the cascade in destructiveness terms ("broader scope clears narrower scope"), never in precedence terms. The four-rung phrasing from ADR 0001 and references to "remote" as a peer rung are retired.
- The Workspace rung's implementation must do two writes for size keys present in the workspace: `ConfigurationTarget.Workspace`, and one `ConfigurationTarget.WorkspaceFolder` write per folder in the current workspace. The summary notification names both kinds of clears under a single "Workspace" heading.
- The Global rung's UI label may vary by context (showing a "remote" qualifier when `vscode.env.remoteName` is non-empty), but the underlying call always targets `ConfigurationTarget.Global`. The product does not branch on remote-vs-local for the write path.
- The contract scenarios in `contract.md` that still reference four rungs (Session/Workspace/Remote/User) need to be revised to the three-rung model. That is a contract-writer task and out of scope for this ADR.
- This ADR supersedes ADR 0001's specific rung list and "remote position unresolved" caveat. The *direction* established in ADR 0001 (the ladder is a UX construct, not VS Code's precedence) is unchanged and inherited.
