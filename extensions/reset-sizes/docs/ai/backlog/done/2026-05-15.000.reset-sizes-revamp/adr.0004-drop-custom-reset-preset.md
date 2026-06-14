# 0004. Drop the `custom` reset preset

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The existing extension exposes a `custom` preset alongside `zoom` and `zoomAndSettings`, letting users supply an arbitrary list of VS Code command IDs and setting keys for the reset to invoke and clear. The revamp re-examined whether that mode belongs in a "one job, done well" utility whose stated audience is power-adjacent users who prefer a dependable tool over a feature-rich app. Carrying the `custom` mode forward would require the new design to specify validation rules for arbitrary command IDs, define behaviour for keys that fall outside the size family, document interactions with the discovery contract (ADR 0003) and the cascade (ADR 0002), and reason about what "preview" and "summary" mean when users can name anything.

## Decision

The `custom` preset is **removed**. The revamp ships exactly three modes — *Zoom only*, *Font size only*, *Zoom and font size* — and offers no mechanism for users to supply their own command IDs or arbitrary setting keys. Users who need fine-grained control over arbitrary keys use VS Code's `settings.json` directly, which is a documented public surface VS Code already provides for exactly that purpose.

## Alternatives

**Keep `custom` as it exists in the current extension.** Rejected because it conflicts with the discovery contract (ADR 0003), which defines "size-family" as the only family of keys the product owns. A custom mode that lets users clear arbitrary keys turns the product into a general "reset settings" tool — explicitly out of scope in the Brief.

**Replace `custom` with a user-extendable allowlist of size keys.** Rejected for the same reasons captured in ADR 0003: it expands the configuration surface of a quiet utility and shifts maintenance burden onto users. Suffix patterns already cover the long tail of size keys without requiring per-user curation.

**Keep `custom` but constrain its inputs to size-family keys only.** Rejected because the curated list plus suffix patterns from ADR 0003 already determine which keys the product will touch; layering a user-controlled filter on top of that — that can only restrict, not extend — adds complexity without giving the user a capability they could not achieve by editing `settings.json` themselves.

## Consequences

- The migration path for existing users of `custom` is to use VS Code's `settings.json` for any reset that falls outside the three named modes. The product's release notes and documentation must call this out.
- Any configuration key in the current extension's manifest related to `custom` (preset enum value, list-of-commands, list-of-settings, etc.) is removed in the revamp. The new manifest exposes only the three named modes.
- Scenarios, the preview view, and the confirmation dialog can enumerate a finite set of modes; the contract is closed under three cases. This simplifies copy, testing, and user mental model.
- If demand for a custom mode re-emerges later, it would require its own ADR. This ADR is the record of why "one job, done well" took precedence over flexibility in the revamp.
