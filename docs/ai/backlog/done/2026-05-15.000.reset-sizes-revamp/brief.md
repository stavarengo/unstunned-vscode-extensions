# Brief — Reset Sizes (revamp)

## Why

Over time, VS Code users accumulate size changes they didn't intend to keep: zoom presses during a screen share, stray font-size bumps in `settings.json`, scaled-up panels left over from a meeting. Undoing all of it today means hunting through menus, keybindings, and settings files at three or four different scopes. The product exists to replace that scavenger hunt with **one command that puts the editor's sizes back to a clean baseline**, with enough control that users can choose how far the reset reaches and enough transparency that nothing destructive happens silently.

This is a revamp of an existing extension. The current implementation already does a narrow version of this (a single command, a small preset list, settings removal at user/workspace/folder scopes), but it is missing the multi-mode reset, the cascade across scopes, the preview surface, the reload-preference memory, and the broader notion of "sizes" beyond a hard-coded handful of keys. The vision below supersedes the current code; existing behaviour is not a constraint on the new design.

## Who it's for

VS Code users who:

- Use zoom and font shortcuts often enough to occasionally leave the editor in a state they didn't choose.
- Share their screen, pair, or demo, and want a fast way back to a presentable baseline.
- Are willing to install a one-purpose utility — the audience is power-adjacent users who prefer a dependable tool over a feature-rich app.

The product is **not** for users who want a theme/layout manager, a settings backup/restore tool, or an automatic "watch and revert" agent.

## What success looks like

A user has been zooming and tweaking sizes for an afternoon. They invoke a single command, confirm a clear summary of what will change, and the editor returns to a clean baseline. Nothing they cared about is destroyed without consent. They can verify exactly what happened, both before (preview) and after (notification + log). They never have to think about *which* setting controls *which* size.

Concretely, the product is succeeding when:

- A first-time user, with default settings, can return the editor to a clean baseline in one Command Palette invocation, without configuring anything.
- A user who has only zoomed (no settings written) sees the reset complete with no confirmation prompt and no reload prompt.
- A user resetting at any scope above "session" sees a confirmation that names what will be removed before anything is removed.
- A user who runs the reset and then asks "what did this just do?" gets a definite answer from the notification, the log, or the preview view — they never have to diff `settings.json` to find out.
- A user can preview the effect of each reset mode at each scope *before* invoking it.
- A user who is fine with reloads can opt in to silent reloads forever; a user who is not, never gets a forced reload.
- The extension introduces no startup cost when the command is not invoked.

## What the user can do

### Reset modes — *what* gets reset

The user can choose, per invocation, one of three modes:

- **Zoom only** — undo temporary zoom state (UI zoom, editor font zoom, terminal font zoom, and equivalents) without altering any persisted settings.
- **Font size only** — restore font-size–family settings (font sizes, line heights, and equivalents across editor surfaces, terminal, and other panels) to their built-in defaults.
- **Zoom and font size** — both of the above in a single invocation.

There is no fourth "custom" mode; the existing extension's `custom` preset is dropped in this revamp.

#### How the product identifies "size settings"

"Sizes" is the family of UI-size concerns the product owns. It explicitly excludes colours, themes, layouts, panel positions, and anything else not about how big things are. To decide which configuration keys belong to that family, the product combines two strategies:

1. **A curated list of well-known size keys** — e.g. `editor.fontSize`, `terminal.integrated.fontSize`, `window.zoomLevel`, `editor.lineHeight`, and equivalents across editor surfaces, terminal, notebooks, and standard panels.
2. **Pattern matching on key suffixes** — any setting whose key ends in a recognised size-related suffix (`fontSize`, `lineHeight`, `zoomLevel`, and similar) is treated as in-family, including keys contributed by third-party extensions the user has installed.

Coverage is **best-effort, not exhaustive**. A setting that doesn't appear on the curated list and doesn't match a recognised suffix will not be reset. The user can always see exactly which keys were considered and which were changed via the post-run notification and the detailed log.

There is no user-extendable allowlist in this revamp; if demand emerges later, it can be revisited.

### Reset scopes — *how far* the reset reaches

The user can choose, per invocation, how far a reset should reach. **The product defers to VS Code's own settings model rather than inventing its own scope semantics.** Concretely, scopes map to VS Code's `ConfigurationTarget` values, with one extra rung for in-memory state that no VS Code target represents:

- **Session** — undoes in-memory size state only (e.g. zoom level changes that haven't been persisted). No settings files are touched. This rung does not correspond to a `ConfigurationTarget`; it is the "nothing persisted" baseline.
- **Workspace** — clears size entries from the current workspace's settings (`ConfigurationTarget.Workspace`). When the workspace has folder-level overrides, each folder's settings (`ConfigurationTarget.WorkspaceFolder`) is also cleared of size entries. Folder-level overrides are not exposed as a separate rung in the UI — they are part of "workspace."
- **Global** — clears size entries from the user's global settings (`ConfigurationTarget.Global`). When the editor is connected to a remote host (Remote SSH, Containers, WSL, etc.) — i.e. `vscode.env.remoteName` is non-empty — `Global` writes to the *remote's* user settings; this is VS Code's behaviour, not the product's invention. The UI may surface this distinction with a context-adaptive label (e.g. "User settings (remote)") so the user understands what they're about to clear, but there is only one underlying target.

The scopes form a **cascade**: picking a broader scope also clears the narrower scopes below it. Picking *Global* clears Global + Workspace (including any folder-level overrides) + Session. Picking *Workspace* clears Workspace + Session. Picking *Session* clears only Session.

The cascade is a UX construct chosen for predictability — "the broader the scope you pick, the more places get cleaned" — and is deliberately distinct from VS Code's configuration *precedence* (which answers "which value wins when scopes conflict?"). The product owns the cascade behaviour; it does **not** own the persistence model, the list of valid targets, or the rules for where each target is stored. Those are VS Code's.

### Preview before acting

From the Command Palette, the extension's settings page, and an optional Activity Bar entry, the user can open a **preview view** that shows, for the current editor state, exactly what each combination of (mode, scope) would change. The preview is read-only — it does not perform the reset and does not offer per-key opt-in/opt-out. To act on what the preview shows, the user invokes a reset command (from the Command Palette or via a button in the view that delegates to that same command).

### Confirmation, on by default

When a reset would touch persisted settings (i.e. any scope above session), the user sees a confirmation dialog that names what is about to be removed. Confirmation is on by default and can be turned off per user preference. A pure session reset (mode applied, no settings touched) does **not** prompt.

### After the reset

Some size changes apply immediately; others require a window reload. The product handles this gracefully:

- If a reload is required, the user is prompted with three options:
  1. **Don't reload now** — no reload; the prompt will reappear next time a reset requires one.
  2. **Reload now** — reloads immediately; the prompt will still reappear on future resets.
  3. **Reload and don't ask again** — reloads immediately; future required reloads happen silently, only when actually required. The user can reverse this from the extension's settings.
- The prompt lists the specific changes that require reload, so the choice is informed.
- If no reload is required, no prompt is shown.

### Visibility of outcomes

- A **summary notification** appears after each invocation, naming what was changed (or that nothing was changed). It is dismissable and can be silenced via the extension's settings.
- A **dedicated log** of detailed reset activity is accessible from the extension's settings, from the Command Palette, and from the summary notification.
- The preview view (above) is reachable from the same places plus an optional Activity Bar icon. **The icon is hidden by default** to honour the "quiet utility" principle; the user enables it via a setting. The preview is always reachable via the Command Palette regardless of icon state.

## Safety and behavioural constraints

- **Confirmation default-on for destructive operations.** Any scope above session must be confirmed unless the user has explicitly opted out.
- **No bypassing VS Code.** Every change is made through documented VS Code APIs (`ConfigurationTarget`, `WorkspaceConfiguration.update`, public commands). The product does not edit settings files out-of-band, does not patch internal storage, and does not depend on internal command IDs that aren't part of the public surface.
- **Quiet failure of partial steps.** If an individual step in a reset can't complete (e.g. no terminal is open, so the terminal font-zoom command no-ops), the overall reset continues. The user is not interrupted with an error dialog mid-flow. The failure is reflected in the post-run summary and log.
- **No automatic activity.** The extension does nothing unless explicitly invoked. No background watchers, no startup activation, no opinions about how the user uses their editor between invocations.
- **Reset means "back to built-in default."** It does not mean "back to a value the user previously had." There is no undo/redo of past values, no snapshotting, no history.

## What's out of scope

The following are explicitly **not** the product:

- Theme, colour, icon, or appearance management of any kind.
- Layout changes — panel positions, sidebar location, view arrangements.
- Backup, restore, sync, or migration of arbitrary settings (size-related or otherwise).
- A general "reset settings" tool. Sizes only.
- A "custom" reset mode where the user supplies an arbitrary list of commands or setting keys. The existing extension's `custom` preset is removed in this revamp; users who want fine-grained control over arbitrary keys use VS Code's `settings.json` directly.
- A user-extendable allowlist or blocklist of size keys. Discovery is curated-list + pattern-match, and that's the contract.
- Automatic behaviour — schedulers, watchers, "auto-reset on idle," telemetry, behavioural learning.
- Workarounds that bypass VS Code's API — direct edits to internal databases, file watchers, monkey-patching, or any approach that isn't a first-class extension capability.
- Restoring a user's *previous* size values. The product knows the built-in defaults; it does not remember what the user had before.
- Reaching into third-party extensions' private state. The product can clear settings keys it recognises as size-related (including ones owned by other extensions, when the key names follow well-known patterns), but it does not call into other extensions, mutate their data stores, or guarantee their UIs will look the way they did pre-install.
- Inventing scope semantics on top of VS Code. The product uses `ConfigurationTarget` values as-is; it does not model "remote" as a distinct API target, does not model "workspace folder" as a distinct user-facing rung, and does not duplicate or override VS Code's persistence rules.
- A keyboard shortcut shipped by default. The Command Palette is the contract; users can bind their own shortcut.

## Guiding principles (carried forward verbatim from the vision)

- **One job, done well.** Resetting sizes. Nothing else.
- **Safe by default, flexible by choice.** New users get sensible behaviour with zero configuration. Power users can tailor everything.
- **Quiet.** No noise, no nags, no startup cost — the extension stays out of the way until called.
- **Honest.** Always tell the user what was changed and ask before erasing anything they configured.

## Open questions

The original open questions raised in this Brief have been resolved by user clarification (recorded in `clarifications.md`):

- Discovery strategy → curated list + pattern match, no allowlist.
- Scope model → defer to VS Code's `ConfigurationTarget`; three rungs (Session, Workspace, Global) with cascade preserved as UX.
- Workspace folders → folded into the Workspace rung; not a separate UX rung.
- Preview → read-only.
- Activity Bar icon → hidden by default.
- `custom` mode → dropped.

No new open questions block the Brief. One downstream note for the orchestrator:

- **ADR 0001 needs a successor.** The ADR's *direction* — that the scope-selection model is a UX cascade, not a mirror of VS Code's precedence — is reinforced by the Q2 clarification. But the ADR's specific four-rung list (`session, workspace, remote, user`) and its closing note that "the rungs remain partially open" are now stale: the rungs are settled (three: Session, Workspace, Global), "Remote" is a contextual label on Global rather than its own rung, and the cascade is now framed as "broader scope clears narrower scope," not "higher rung clears everything below." A successor ADR should re-state the cascade decision against the final three-rung model and retire the four-rung phrasing.
