# 0003. Size-key discovery via curated list plus suffix patterns, no user allowlist

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The reset command operates on a family of settings called "sizes" — font sizes, line heights, zoom levels, and related keys that appear across the editor, terminal, notebooks, third-party panels, and extensions the user has installed. VS Code does not classify settings as "size-related" anywhere in its API, and the set of keys is open-ended: any extension can contribute new settings, and many use predictable suffixes (`fontSize`, `lineHeight`, `zoomLevel`) without belonging to a fixed namespace. The product needed a discovery strategy that is predictable enough for users to trust ("nothing I cared about is destroyed without consent"), inclusive enough to cover third-party keys most users would expect to be reset, and lightweight enough to maintain.

## Decision

Discovery combines two strategies and nothing else. **A curated, in-source list of well-known size keys** (e.g. `editor.fontSize`, `terminal.integrated.fontSize`, `window.zoomLevel`, `editor.lineHeight`, and equivalents across editor surfaces, terminal, notebooks, and standard panels) ensures the keys users most expect to reset are always caught. **Suffix pattern matching** (any setting key ending in a recognised size-related suffix — `fontSize`, `lineHeight`, `zoomLevel`, and similar) extends coverage to third-party extensions and future keys without requiring the curated list to be exhaustive. Coverage is **best-effort, not exhaustive**: a setting that doesn't appear on the curated list and doesn't match a recognised suffix will not be reset, and the product documents this contract via the post-run notification and the activity log, which name every key considered and every key changed. The product does **not** support a user-extendable allowlist or blocklist in this revamp.

## Alternatives

**Curated list only.** Rejected because the curated list cannot keep pace with the long tail of size-related keys contributed by third-party extensions and future VS Code releases. Users with extensions that follow the standard naming conventions would be surprised when their `*.fontSize` keys were ignored.

**Curated list plus user-extendable allowlist.** Rejected at this stage. It expands the configuration surface of a "one job, done well" utility and shifts maintenance burden onto users who would have to discover, name, and curate their own keys before the reset would touch them. The mechanism may be revisited later if real demand emerges; until then, suffix patterns capture the same coverage with zero user configuration.

**Pattern matching only, no curated list.** Rejected because well-known keys may not always follow the suffix conventions, and a few high-value keys (e.g. anything ending in `zoomLevel` or with an exact name the user expects) deserve a guaranteed-coverage path that does not depend on the regularity of naming. A small curated list also lets the documentation say definitively "these are always covered" without users having to reason about suffix matching.

**Heuristic schema scraping.** Inspect contributed configuration schemas (via the extensions API or `package.json` parsing) to find numeric settings labelled "size" or "zoom" in their descriptions. Rejected as too fragile: descriptions are free text, are not localisable in a useful way, and would force the product to reason about VS Code's internal schema model — exactly the kind of bypass the Brief forbids.

## Consequences

- Maintaining the curated list is an ongoing, small obligation. When VS Code or a major extension introduces a new size key that does not match a recognised suffix, it should be added explicitly.
- The set of recognised suffixes is part of the product's public contract. Adding or removing a suffix changes what the reset does to every user's settings and must be treated as a behavioural change.
- The notification summary and activity log are the primary surface for users to verify coverage. The log must list both the curated keys and the pattern-matched keys it considered for the invocation, not just the keys it changed.
- The product **never** mutates a key it has not classified as size-family. Non-size keys at every scope are untouched.
- A user who needs to reset a key the product doesn't recognise must use VS Code's `settings.json` directly. The product does not provide a fallback "force-clear this key" mechanism, and this is the trade-off accepted in exchange for the predictability of a fixed contract.
