# User clarifications

The user reviewed the brief's open questions and the contract-writer's blockers and provided these answers. Treat them as authoritative; revise the brief, ADR(s), and contract accordingly.

## Q1 — Discovery of "size settings"

**Answer:** Curated list + pattern match.

- Hand-curated list of well-known size keys (e.g. `editor.fontSize`, `terminal.integrated.fontSize`, `window.zoomLevel`, `editor.lineHeight`, etc.).
- PLUS pattern match on suffixes like `*fontSize`, `*lineHeight`, `*zoomLevel`.
- **No user-extendable allowlist** at this stage. (Can be revisited later if demand emerges.)
- Coverage is best-effort, not exhaustive — that's acceptable. Documenting which keys are covered is part of the visibility surface (notification summary + log).

## Q2 — Where does "remote" sit on the ladder?

**Answer:** Defer to VS Code. The extension does not invent its own scope semantics or precedence model.

The user's direction (verbatim): *"Match whatever is the normal behaviour for vscode. Ideally the extension doesn't have to decide any of that. Focus on changing the settings on the scope the user asked. The list of scopes and where they are persisted (if at all), is something that is provided and handled by VS Code."*

Implications:
- We use VS Code's `ConfigurationTarget` enum (`Global`, `Workspace`, `WorkspaceFolder`) directly when writing settings.
- "Remote" is **not** a separate API target — VS Code's `Global` target writes to the remote's user settings when connected to a remote host (Remote SSH/Containers/WSL).
- The user-facing scope picker may still show "Remote" as a label when `vscode.env.remoteName` is non-empty, but it maps to `Global` under the hood.
- The cascade from the original vision (workspace reset also clears session+remote) is preserved as a **UX construct** — the contract decides which targets to write/unset for each user choice — but we don't fight or duplicate VS Code's persistence layer.
- The brief's "destructiveness ladder" framing should be rewritten so it doesn't imply we own scope semantics. ADR 0001 should be re-examined: its direction (UX ladder vs API precedence) is *reinforced*, but its specific ordering and inclusion rules may need adjustment.

## Q3 — Workspace-folder rung

**Answer:** Let VS Code handle it.

- We don't model folder-level settings as a distinct rung in our UX.
- When the user picks "workspace reset," we write to `ConfigurationTarget.Workspace` AND iterate over each folder writing `ConfigurationTarget.WorkspaceFolder` to clear folder-level overrides.
- No new "folder" rung in the UI.

## Q4 — Preview view interactivity

**Answer:** Read-only.

- The view shows current state and what each reset would do at each scope.
- It does NOT trigger resets directly; users still invoke "Reset All Sizes" (or the mode-specific commands) from the Command Palette or a button in the view that delegates to the same commands.
- Pure visibility surface — no per-key opt-in/opt-out.

## Q5 — Activity Bar (sidebar) icon default visibility

**Answer:** Hidden by default.

- Honours the "quiet utility" principle.
- A setting (e.g. `resetSizes.showInActivityBar`) lets users enable it.
- The Preview view remains accessible via the Command Palette regardless of the icon state.

## Q6 — `custom` mode

**Answer:** Dropped.

- Only three modes: "Just zoom", "Just font size", "Zoom and font size."
- The existing `custom` preset from the current extension is removed in this re-vamp.
- Power users who want fine-grained control use VS Code's settings.json directly.

---

## What this means for downstream agents

- **brief.md** should be revised so its open questions are resolved (or removed), the discovery strategy is named, the "ladder" section is rewritten to defer to VS Code's `ConfigurationTarget`, and `custom` is no longer mentioned as in/out — it's explicitly out.
- **ADR 0001** should be reviewed: its core direction (the ladder is a UX construct, not VS Code's precedence) is *reinforced* by Q2; but if the ADR named a specific ordering or inclusion rule, that may need updating or a successor ADR.
- **contract.md** should be revised so the blockers list is empty: Q1's discovery strategy is locked, Q2/Q3 are folded into the new scope model, Q4/Q5 are pinned with default-visibility scenarios, Q5's custom mode is explicitly out of scope.
