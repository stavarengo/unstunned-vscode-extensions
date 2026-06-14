# User input — verbatim

> Context from the user: "The current state of the extension is frustrating. We are re-vamping the implementation. Here is my vision for what we want to have. Don't let the current code bias you."

---

# Reset Sizes — Product Description

## What we're building

We want a small, focused VS Code extension that gives users a single, reliable way to **put their VSCode sizes back to factory settings**.

Over time, people zoom in, zoom out, bump font sizes, and tweak layout values — sometimes on purpose, often just temporary (a stray keyboard shortcut, a shared screen demo, a quick "let me make this readable for a meeting"). Today, undoing all of that means hunting through menus and settings files. We want to replace that scavenger hunt with **one command**.

## The promise to the user

> "I'll fix whatever I changed about the size of things, and you don't have to remember what you did."

## What the user can do

- **Run one command** — "Reset All Sizes" — from the Command Palette.
- That command brings the editor back to a sensible default state in terms of size and zoom.
- They shouldn't need to think about *which* things changed — the extension should know what counts as a "size" and handle them all together.

## What "sizes" means here

The extension should treat all of these as one family of things that get reset together:

- Any **UI zoom** of anything inside the VS Code.
- Any **font size, line heights and whatnot** 

The above list applies not just the editor, but any sidebar, panel, or other UI element, including possible custom extensions that the user might have installed.

## Scope of "reset" changes

Not everyone wants the same thing when they say "reset." The extension should offer a small number of clear modes:

- **Just the zoom** — Undoes temporary zoom changes only.
- **Just font size** — Undo font size changes only.
- **Zoom and font size**.

## Levels of "reset": Where to apply the reset?

Some users only want to reset things in their current project. Others want to wipe their personal defaults too. The extension should let the user choose which layers of their configuration get cleaned up:

1. Reset just the current session: Reset the settings changed in memory, not persisted in any settings file.
2. Reset workspace settings: Reset the settings in the current workspace's settings file.
3. Reset remote settings: Reset settings only for the current remote environment (e.g. devcontainer)
4. Reset user settings: Reset the user's global settings file.

The 4 levels above follow the natural hierarchy of VS Code's settings system (session < workspace < remote < user), so when the user resets at a certain level, it should also reset all the levels below it. For example: Resetting at the workspace level should reset the workspace settings, the session settings, and the remote settings — but not the user settings. Resetting at the user level should reset everything.


## Safety and trust

This command can erase preferences the user spent time setting up, so it must feel **trustworthy**:

- Before removing any saved preferences, the extension should **ask for confirmation** and clearly say what it's about to remove.
- The confirmation step should be optional but **on by default**.
- If something fails — for example, a zoom command can't run — the extension should fail quietly and keep going, not interrupt the user with errors.
- After running, the user should see a short summary of what was actually changed, so there are no surprises.

## After the reset

Some size changes take effect immediately; others only fully apply after the editor reloads. The extension should handle that gracefully:

1. It should detect when a reload is needed and offer the user a clear choice about how to proceed (yes, reload now; or no, I'll reload later).
2. The prompt should list the changes that will take effect only if the user reloads, so they understand the consequences of their choice.
3. The prompt offers the following options:
  3.1. **Don't reload now**: The editor does not reload, and the user will see this prompt again in the future when a reload is needed.
  3.2. **Reload now**: The editor reloads immediately, but the user will see this prompt again in the future when a reload is needed.
  3.3. **Reload and don't ask again**: The editor reloads immediately, and the user won't see this prompt again in the future (will reload silently when needed - only when necessary as described on item 1).

The extension should remember the user choice for future resets (extension settings).

## Visibility

- A small notification after each run, summarizing what happened — easy to dismiss, easy to ignore (the notification can be silenced via extension settings).
- A dedicated place to see a more detailed log of what was reset, for users who want to verify the action or troubleshoot. This dedicated place can be accessed from the extension's settings, via Command Palette, or via the notification itself (when it appears).
- A dededicate view that analyzes the current state of the editor's and shows what would be reset/changed on each of the scopes (session, workspace, remote, user). This view can be accessed from the extension's settings, via Command Palette, via icon in the left sidebar (the icon visibility can be configured in the extension settings).

## What success looks like

- A user who has zoomed, scaled, and tweaked VS Code in any way, can return to a clean baseline with just one command.
- A user never loses a preference they actually wanted to keep — because anything destructive is confirmed first.
- A user opens the extension's settings and immediately understands the three modes without reading a manual.
- The user opens the views that show what would be reset and immediately understands what each of the "reset commands" would do, before they run them.
- The extension feels like a **utility, not an app**: invisible until needed, dependable when called.
- The extension relies on VS Code's API to do its job and doesn't try to do anything in a hacky way.

## What it is *not*

- It is not a theme or appearance manager.
- It does not change colors, layouts, or panel positions.
- It does not back up or restore arbitrary settings.
- It does not run automatically or watch the user's behavior — it only does something when explicitly invoked.
- It does not try to apply changes directly bypassing VS Code's exposed official ways.

## Guiding principles

- **One job, done well.** Resetting sizes. Nothing else.
- **Safe by default, flexible by choice.** New users get sensible behavior with zero configuration. Power users can tailor everything.
- **Quiet.** No noise, no nags, no startup cost — the extension stays out of the way until called.
- **Honest.** Always tell the user what was changed and ask before erasing anything they configured.
