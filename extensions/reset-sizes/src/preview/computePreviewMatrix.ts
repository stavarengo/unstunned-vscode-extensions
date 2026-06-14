/**
 * Preview matrix computation (Slice 4, S27).
 *
 * Computes — for each (mode, scope) combination — exactly what would change
 * if the user invoked the reset right now against the current editor state.
 *
 * The computation is **pure**: it never writes anything. It reuses the same
 * building blocks the orchestrator uses (`discoverCandidateKeys`,
 * `planCascade`, `requiresReload`) so the preview's answer to
 * "what would happen?" is identical to what `runReset` would actually do
 * (ADR 0005 — the preview cannot drift from the action path).
 *
 * The webview module renders this matrix; the action button delegates back
 * to `runReset(mode, scope, channel)` so confirmation, reload flow, log,
 * and summary all go through the single shared code path (S29).
 */
import {
	discoverCandidateKeys,
	InspectFn,
	labelForScope,
	planCascade,
	requiresReload,
	SettingClearStep,
	ZOOM_RESET_COMMANDS
} from '../utils';
import { ResetMode, ResetScope } from '../types';

/**
 * Result for a single (mode, scope) cell of the 3×3 matrix.
 */
export interface PreviewCell {
	mode: ResetMode;
	scope: ResetScope;
	/**
	 * The setting clear steps that would be planned for this combination, in
	 * the same shape that `runReset` would compute. Empty for Zoom-only,
	 * empty at Session for Font-size-only, etc.
	 */
	plan: SettingClearStep[];
	/**
	 * The zoom reset command IDs that would be executed for this combination.
	 * Empty for Font-size-only.
	 */
	zoomCommands: readonly string[];
	/**
	 * True if at least one key in `plan` would require a window reload
	 * (per `requiresReload`). Used so the preview can warn the user *before*
	 * they invoke the reset.
	 */
	requiresReload: boolean;
	/**
	 * Stable user-facing label for this scope — adapts to remote hosts (S15).
	 * Pre-computed so the webview never needs to know about `remoteName`.
	 */
	scopeLabel: string;
}

/**
 * Full 3×3 matrix the preview view renders.
 *
 * `cells` is indexed `cells[mode][scope]` for direct lookup by the renderer.
 * `modes` and `scopes` are the canonical iteration orders (matching the
 * `MODE_OPTIONS` / `SCOPE_OPTIONS` order in `utils/index.ts`).
 */
export interface PreviewMatrix {
	modes: readonly ResetMode[];
	scopes: readonly ResetScope[];
	cells: { [M in ResetMode]: { [S in ResetScope]: PreviewCell } };
}

/**
 * Mode iteration order — mirrors `MODE_OPTIONS` in `utils/index.ts`.
 * Exported so the webview renderer and tests share a single ordering.
 */
export const PREVIEW_MODES: readonly ResetMode[] = Object.freeze([
	'zoom',
	'fontSize',
	'zoomAndFontSize'
]);

/**
 * Scope iteration order — mirrors `SCOPE_OPTIONS` in `utils/index.ts`.
 */
export const PREVIEW_SCOPES: readonly ResetScope[] = Object.freeze([
	'session',
	'workspace',
	'global'
]);

/**
 * Compute the full 3×3 matrix from the current editor state. Pure — no writes,
 * no VS Code API calls beyond the injected `inspect`. The webview re-invokes
 * this on every refresh (cheap; bounded by curated list size + folder count).
 *
 * @param rootConfig    the resolved configuration tree (what
 *                      `vscode.workspace.getConfiguration()` returns). Used by
 *                      `discoverCandidateKeys` for suffix matching.
 * @param inspect       the injected reader; production is `inspectViaConfig`
 *                      from `resetAllSizes.ts`.
 * @param folders       the workspace folder list, for `WorkspaceFolder` clears.
 * @param remoteName    `vscode.env.remoteName`; controls the scope label for
 *                      Global (S15).
 */
export function computePreviewMatrix(
	rootConfig: unknown,
	inspect: InspectFn,
	folders: ReadonlyArray<{ uri: import('vscode').Uri }>,
	remoteName: string | undefined
): PreviewMatrix {
	const candidates = discoverCandidateKeys(rootConfig);

	const buildCell = (mode: ResetMode, scope: ResetScope): PreviewCell => {
		const wantsZoom = mode === 'zoom' || mode === 'zoomAndFontSize';
		const wantsSettings = mode === 'fontSize' || mode === 'zoomAndFontSize';

		// Plan only when settings would be touched. Session always yields [].
		const plan = wantsSettings ? planCascade(scope, candidates, inspect, folders) : [];
		const zoomCommands = wantsZoom ? ZOOM_RESET_COMMANDS : [];
		const cellRequiresReload = plan.some(step => requiresReload(step.key));

		return {
			mode,
			scope,
			plan,
			zoomCommands,
			requiresReload: cellRequiresReload,
			scopeLabel: labelForScope(scope, remoteName)
		};
	};

	const cells = {
		zoom: {
			session: buildCell('zoom', 'session'),
			workspace: buildCell('zoom', 'workspace'),
			global: buildCell('zoom', 'global')
		},
		fontSize: {
			session: buildCell('fontSize', 'session'),
			workspace: buildCell('fontSize', 'workspace'),
			global: buildCell('fontSize', 'global')
		},
		zoomAndFontSize: {
			session: buildCell('zoomAndFontSize', 'session'),
			workspace: buildCell('zoomAndFontSize', 'workspace'),
			global: buildCell('zoomAndFontSize', 'global')
		}
	};

	return {
		modes: PREVIEW_MODES,
		scopes: PREVIEW_SCOPES,
		cells
	};
}
