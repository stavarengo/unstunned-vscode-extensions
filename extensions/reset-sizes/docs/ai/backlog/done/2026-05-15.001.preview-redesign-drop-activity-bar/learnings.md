# Learnings

## Codebase Patterns

- The integration test runner (`@vscode/test-electron`) downloads VS Code and launches an Electron-based extension host; running it in a headless environment requires an X server. `xvfb-run` is not usable because `xauth` is not installed — launch `Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &` manually and export `DISPLAY=:99` before `npm test`. Remember to kill the Xvfb PID after the run.
- Mocha discovers test files via `glob('**/**.test.js', { cwd: testsRoot })` against the compiled `dist/test/` tree (`src/test/suite/index.ts`). When deleting a `*.test.ts` source file, the stale compiled `*.test.js` in `dist/test/suite/` is **not** removed by `tsc`. Either delete the stale `dist/**.test.js` by hand or run a clean build, otherwise the deleted test still runs against your changes.
- The project has no automated VRT pipeline. For UI-touching slices, render `previewHtml.ts` output with Playwright + headless Chromium (install with `npm install playwright --no-save` in a scratch dir, then `npx playwright install chromium`; binary lands at `/opt/playwright-browsers/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell`). Stub the `vscode` module via `Module._resolveFilename` before requiring `computePreviewMatrix.js` (it transitively imports `vscode`). Inject `--vscode-*` CSS variables on `:root` via a second injected `<style>` block so the rendered HTML picks up dark/light/high-contrast palettes. Save PNGs to `vrt-before/` (capture before any code change, after `git stash`) and `vrt-after/` (after the change). Commit both folders with the slice.

## Slice 1: Retire the Activity Bar entry point

### Files changed

- `package.json` — removed `onView:resetSizesActivityBarView` from `activationEvents`; removed `resetSizes.showInActivityBar` from `contributes.configuration.properties`; removed the `resetSizesActivityBar` entry from `contributes.viewsContainers.activitybar`; removed the entire `contributes.views` block (only the Activity Bar view lived there).
- `src/extension.ts` — removed the `registerActivityBarView` import and the registration call (with its multi-line rationale comment).
- `src/preview/activityBarView.ts` — deleted.
- `src/test/suite/activityBarView.test.ts` — deleted.
- `src/test/suite/extension.test.ts` — removed the four Activity Bar manifest-assertion tests (S30 setting, S30/S31 container, S30/S31 icon file, S30/S31 view with `when` clause, S31 activation event); removed now-unused `fs` and `path` imports.
- `images/activity-bar-icon.svg` — deleted.
- `dist/preview/activityBarView.js` and `dist/test/suite/activityBarView.test.js` — deleted (stale compiled artifacts).

### Learnings for future iterations

- When `contributes.views` only contained the now-deleted `resetSizesActivityBar` array, the entire `views` block was removed (rather than leaving an empty `views: {}`). Slice 2 introduces no new view, so this stays gone.
- The slice scope item about updating the markdown in `resetSizes.showSummaryNotification.markdownDescription` was conditional on the description mentioning Activity Bar. It does not — it links only to the activity log and the preview — so it was left untouched.
- The slice was a pure deletion: no replacement assertions were added in `extension.test.ts`. Absence is the assertion. Adding "the setting does NOT exist" tests would be redundant against the deleted-by-design surface.
- TDD does not apply to pure-deletion slices. The flow is: delete production code and presence-assertions together, then verify the suite stays green.
- The disposable-leak warnings ("Trying to add a disposable to a DisposableStore that has already been disposed of") in the test output predate this slice and are unrelated — they originate from how `vscode.window.createOutputChannel` is called inside tests after the extension host's main subscriptions store has been disposed. Don't chase them as a regression caused by this slice.

## Slice 2: Preview redesign for legibility, empty-state differentiation, and accessibility

### Files changed

- `src/preview/previewHtml.ts` — rebuilt the inline style block and per-cell rendering. Removed every literal-colour fallback inside `var()` calls; every colour now reads from a `--vscode-*` variable. Cells now split into two shapes: an *active* cell renders a summary line (counts of keys / zoom commands, optional reload badge), the detail listings, and a plain "Run reset" button (with `aria-label` naming the mode+scope for assistive tech); a *no-op* cell renders one demoted caption and no `<button>` at all. The intro paragraph is one short sentence. Added a button `:focus` rule using `--vscode-focusBorder`. No CSS transitions or animations.
- `src/test/suite/previewHtml.test.ts` — replaced the old "exactly 9 buttons" / "Cells with no work say none" assertions with the new contract: no-literal-colours sweep, demoted-caption assertion for each no-op cell, summary-before-detail DOM ordering, reload indicator before button, `aria-label` carries mode/scope, focus rule references `--vscode-focusBorder`, no transitions/animations.
- `docs/ai/backlog/todo/2026-05-15.001.preview-redesign-drop-activity-bar/vrt-before/` — six PNG snapshots (default + mixed scenarios × dark/light/high-contrast themes) of the old design, captured by stashing in-progress changes, recompiling, and running the Playwright render script.
- `docs/ai/backlog/todo/2026-05-15.001.preview-redesign-drop-activity-bar/vrt-after/` — same six scenario/theme combinations rendered against the new design.

### Learnings for future iterations

- `previewHtml.ts` writes `data-cell-mode` / `data-cell-scope` attributes onto each `<td>`. These are a deliberate test seam — tests use them to address a specific cell deterministically (`extractCellHtml(html, mode, scope)`), independent of column ordering. Keep them stable; any future renderer change must preserve them or update the test seam in lockstep.
- The "no literal colours" test scans the inline `<style>` block (not the whole HTML) — body text like `editor.fontSize` would otherwise false-positive. The test also excludes `transparent` / `currentColor` / `inherit` per the slice's allowlist; the only literal still acceptable inside `var(--vscode-button-border, …)` is `transparent`.
- VS Code dispatches `click` events on a native `<button>` for Enter/Space activation; no separate keydown handler is needed for S46 keyboard reachability. The existing click-only dispatcher remains correct.
- The S43 fallback caption ("Nothing would change for this combination…") is unreachable in the current closed three-mode set — Zoom-only and Zoom-and-font-size always run zoom commands at every scope, so they never reach S43. It exists as a defensive branch in `emptyCellCaption` for completeness; future mode changes that introduce a new no-zoom mode should review it.
- The message protocol carried by the inline script must match `previewMessage.ts` exactly: `{ type: 'run-reset', mode, scope }` — the slice description occasionally drifts to `{ kind: 'run-reset', … }`, but the existing `isRunResetMessage` type guard checks `type === 'run-reset'`. Changing only the inline script would silently break routing without an obvious test failure, since `handlePreviewMessage` tests build messages directly rather than through the script.
- VRT screenshots are a proxy for the manual smoke that the Done-When section calls out ("install the built extension into an Extension Development Host"). The headless Chromium renders only the `previewHtml.ts` output — it doesn't run inside a VS Code webview, doesn't exercise the postMessage round-trip, and doesn't verify the actual confirmation/reload modals. The behavioural assertions in `previewHtml.test.ts` plus the preserved S28/S29 tests cover behaviour; the screenshots cover visual legibility under each theme. An interactive EDH smoke remains the highest-fidelity check and may need to be driven separately by the orchestrator.
