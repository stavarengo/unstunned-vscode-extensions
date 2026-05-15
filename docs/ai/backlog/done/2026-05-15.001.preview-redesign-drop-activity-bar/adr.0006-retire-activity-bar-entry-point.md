# 0006. Retire the Activity Bar entry point to the Preview

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The previous build shipped two ways to reach the Preview surface: the Command Palette command `resetSizes.openPreview`, which opens the Preview panel directly, and an Activity Bar icon — gated behind a `resetSizes.showInActivityBar` setting the user had to discover and enable — that opens a sidebar placeholder webview whose only behaviour is to invoke the same Command Palette command. The user opened the new build, assumed the two entry points were the same surface, and on being told they aren't, asked for the sidebar one to be dropped. The Activity Bar entry costs a view container, a placeholder webview, a gating setting, a manifest icon file, an activation event, and a dedicated test suite, and gives the user nothing the Command Palette does not already give. ADR 0005 has already committed the Preview to read-only status and to delegating every action to the same reset path; the Activity Bar surface is therefore a redundant trigger for an already-canonical command, not an independent capability. The cost is visible in the manifest and the test suite; the benefit is not visible at all.

## Decision

The Activity Bar entry point is **retired**. The manifest no longer contributes a `resetSizesActivityBar` view container, a `resetSizesActivityBarView` webview view, an `onView:resetSizesActivityBarView` activation event, an Activity Bar icon, or a `resetSizes.showInActivityBar` setting. The supporting source file (`src/preview/activityBarView.ts`), its test suite, the Activity Bar assertions in the extension manifest tests, and the `registerActivityBarView` call in `src/extension.ts` are all removed. The Preview remains reachable from exactly two entry points: the Command Palette (`resetSizes.openPreview`) and the markdown link embedded in `resetSizes.showSummaryNotification.markdownDescription` on the settings page. No migration is shipped for users who previously enabled `resetSizes.showInActivityBar`; VS Code leaves the unrecognised key in their `settings.json` and ignores it on read, consistent with the product's "we own no migration state" stance.

## Alternatives

**Keep the Activity Bar surface as a gated, off-by-default icon (status quo).** Rejected because the user reported it as a source of confusion — they expected the sidebar and the Preview panel to be the same surface — and because the gating setting is itself a discovery burden: a user who would benefit from the icon must first find a setting whose name describes the icon. The surface adds manifest contributions, source, and tests, and offers no behaviour the Command Palette does not already offer.

**Promote the Activity Bar entry to a real sidebar Preview (rendering the matrix in the sidebar).** Rejected because the Preview is a 3×3 matrix designed for the editor-area width, not for a narrow sidebar; the redesign explicitly assumes editor-area dimensions. A sidebar variant would either duplicate the renderer at a different scale or compromise the matrix legibility the redesign is trying to restore. It would also re-open the per-key opt-in question ADR 0005 closed.

**Replace the Activity Bar entry with a status bar item or an editor title-bar action.** Rejected as scope creep. The user asked for one fewer entry point, not a different one. Adding a new surface would re-introduce the same "does this entry behave like the Command Palette?" confusion under a different icon, and would not address the underlying redundancy.

**Hide the Activity Bar surface behind a `deprecated: true` manifest flag and a deprecation notice.** Rejected because VS Code does not support a `deprecated` flag on view containers, and a runtime notice would require the surface to stay registered. Retiring the contribution outright is simpler than maintaining a sunset path, and the product's "we own no migration state" stance means there is nothing user-owned to migrate.

## Consequences

- The Preview's entry-point inventory shrinks to two: the Command Palette and the settings-page markdown link. Any documentation, screenshots, or release notes that named the Activity Bar icon must be revised.
- The behaviour contract amends in three places: S27's "Activity Bar entry (if enabled)" phrasing is dropped; S30 ("Activity Bar icon is hidden by default") and S31 ("Activity Bar icon appears when the user enables it") are retired. The contract-writer downstream is responsible for revising these — this ADR does not amend the contract document itself.
- A user who had previously enabled `resetSizes.showInActivityBar` will see the icon disappear after upgrading because the manifest no longer contributes it. Their `settings.json` may continue to carry the key; VS Code will surface it as an unknown setting and otherwise ignore it. The extension performs no cleanup.
- Future code reviewers should not reintroduce an Activity Bar contribution without a new ADR that names what the sidebar adds beyond the Command Palette and the settings link. The current evidence is that it adds confusion at the cost of manifest surface area; reversing that requires fresh evidence, not a silent restoration.
- The test suite shrinks: the manifest-assertion block in `src/test/suite/extension.test.ts` that exercised the view container, the `when` clause, the setting declaration, and the icon file existence is removed alongside the file under test. No replacement assertions are needed — the absence of the contribution is the assertion.
- This ADR is additive; it does not supersede any existing ADR. ADR 0005's read-only Preview commitment is unchanged and is the durable architectural decision about the Preview surface. The Activity Bar was an entry point to that surface, not a property of it.
