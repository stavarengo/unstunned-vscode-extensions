# Architecture Sketch — Reset Sizes (revamp)

Two diagrams: Context (the extension and what touches it) and Container (what's inside the extension at runtime, and what it reads/writes). Behaviour belongs in the Contract; this file shows only the shape.

## Context

```mermaid
flowchart LR
    user["VS Code user<br/>(invokes reset, opens preview)"]

    subgraph host["VS Code (extension host)"]
        ext["Reset Sizes Extension<br/>(this system)"]
    end

    settings[("VS Code settings store<br/>Global / Workspace / WorkspaceFolder<br/>(routed to remote when applicable)")]

    user -- "Command Palette invocations<br/>preview open / toggle Activity Bar icon" --> ext
    ext -- "reads current values<br/>writes via ConfigurationTarget<br/>(WorkspaceConfiguration.update)" --> settings
    ext -- "notifications, confirmation,<br/>reload prompt, preview UI" --> user
```

Notes:
- "VS Code settings store" is a single external store from the extension's point of view. Remote vs local routing is VS Code's concern, not the extension's (ADR 0002).
- Third-party extensions are not actors here; their settings keys may be cleared when they match the size-family contract (ADR 0003), but no extension-to-extension calls are made.

## Containers

```mermaid
flowchart TB
    user["VS Code user"]
    palette["Command Palette<br/>(VS Code entry point)"]
    activityBar["Activity Bar icon<br/>(package.json contribution,<br/>hidden by default)"]

    subgraph extension["Reset Sizes Extension (one extension-host process)"]
        orchestrator["Reset orchestrator<br/>(activated on command;<br/>runs mode + scope cascade,<br/>confirmation, reload flow)"]
        preview["Preview webview<br/>(read-only;<br/>delegates 'run reset' to orchestrator)"]
    end

    log[("Output Channel<br/>'Reset Sizes' activity log")]
    memento[("Extension Memento<br/>'reload silently' preference")]
    settings[("VS Code settings store<br/>Global / Workspace /<br/>WorkspaceFolder")]

    user --> palette
    user --> activityBar
    palette -- "reset command" --> orchestrator
    palette -- "open preview" --> preview
    activityBar -- "open preview" --> preview
    preview -- "run reset (button)" --> orchestrator

    orchestrator -- "read current keys<br/>+ write/clear per cascade" --> settings
    preview -- "read current state<br/>(no writes)" --> settings

    orchestrator -- "append run entries" --> log
    orchestrator -- "read/write 'don't ask again'" --> memento

    orchestrator -- "summary notification,<br/>confirmation dialog,<br/>reload prompt" --> user
    preview -- "renders<br/>(mode x scope) effects" --> user
```

Notes:
- The orchestrator is one container — its internal pieces (size-key discovery, cascade resolution, reload detection) are components and are out of scope for this Sketch.
- The Preview webview never writes state; its only path to an action is delegating to the orchestrator's reset command (ADR 0005). Confirmation and reload flows are owned by the orchestrator and are reached the same way regardless of entry point.
- The Output Channel is a write-only sink from the orchestrator's perspective; the user reads it via VS Code's Output panel.
- The Memento is the only piece of persisted extension-owned state; size-family settings live in VS Code's settings store, not here.
