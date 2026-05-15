/**
 * Preview HTML renderer.
 *
 * Builds the HTML body for the read-only webview from a fully computed
 * `PreviewMatrix`. Pure: no DOM, no VS Code APIs, no I/O. Each cell either
 *
 *  - renders a glance-level summary line (count of keys, count of zoom
 *    commands, reload indicator when applicable), the detail listing the
 *    summary points at, and a "Run reset" button that posts a `run-reset`
 *    message back to the host; or
 *
 *  - renders a demoted caption explaining why the cell is quiet and omits
 *    the button entirely (S41 / S42 / S43 — no-op cells never invite a click).
 *
 * Every visual treatment reads from a VS Code theme variable. Literal hex
 * codes, named CSS colours (other than `transparent` / `currentColor` /
 * `inherit`), and `rgb()/hsl()` are not present in the inline style block
 * (S45 + contract invariant). No transitions or animations are introduced
 * (S48).
 *
 * The HTML is rendered with a CSP nonce because `enableScripts: true` plus
 * an inline `<script>` is the simplest way to wire the button → message
 * channel without bundling. The inline script is a thin click dispatcher —
 * it does not store state, observe the DOM beyond `click` events, or define
 * its own action path. VS Code dispatches `click` events on a `<button>` for
 * Enter/Space activation by default, so no separate keydown handler is
 * needed for S46.
 */
import { ResetMode, ResetScope } from '../types';
import { PreviewMatrix } from './computePreviewMatrix';
import { MODE_OPTIONS, SCOPE_OPTIONS } from '../utils';

/**
 * Pure function — given a webview's CSP source and a fresh nonce, return the
 * full `<html>` document the webview should display.
 */
export function renderPreviewHtml(
	matrix: PreviewMatrix,
	cspSource: string,
	nonce: string
): string {
	const modeLabel = (mode: ResetMode): string =>
		MODE_OPTIONS.find(o => o.value === mode)?.label ?? mode;
	const scopeStaticLabel = (scope: ResetScope): string =>
		SCOPE_OPTIONS.find(o => o.value === scope)?.label ?? scope;

	const headerCells = matrix.scopes.map(scope => {
		// Use the *dynamic* label from a sample cell (which respects remoteName
		// via labelForScope, S15).
		const sampleCell = matrix.cells[matrix.modes[0]][scope];
		return `<th scope="col">${escapeHtml(sampleCell.scopeLabel)}</th>`;
	}).join('');

	const rows = matrix.modes.map(mode => {
		const rowHeader = `<th scope="row">${escapeHtml(modeLabel(mode))}</th>`;
		const cells = matrix.scopes.map(scope => {
			const cell = matrix.cells[mode][scope];
			return renderCellHtml(cell, modeLabel, scopeStaticLabel);
		}).join('');
		return `<tr>${rowHeader}${cells}</tr>`;
	}).join('');

	// Inline script: post the cell's (mode, scope) when its button is clicked.
	// The protocol matches `previewMessage.ts` (`type: 'run-reset'`). The
	// dispatcher does not store state and does not observe the DOM beyond
	// click events. A native <button> fires a click event for Enter / Space,
	// so keyboard activation (S46) reuses this same path.
	const inlineScript = `
		const vscode = acquireVsCodeApi();
		document.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}
			if (target.dataset.command !== 'run-reset') {
				return;
			}
			const mode = target.dataset.mode;
			const scope = target.dataset.scope;
			if (!mode || !scope) {
				return;
			}
			vscode.postMessage({ type: 'run-reset', mode, scope });
		});
	`.trim();

	const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>Reset Sizes — Preview</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 16px;
			margin: 0;
		}
		h1 {
			font-size: 1.4em;
			font-weight: 600;
			margin: 0 0 6px 0;
			color: var(--vscode-foreground);
		}
		p.intro {
			margin: 0 0 16px 0;
			color: var(--vscode-descriptionForeground);
			max-width: 640px;
		}
		table {
			border-collapse: collapse;
			width: 100%;
			margin-top: 8px;
		}
		th, td {
			border: 1px solid var(--vscode-panel-border);
			padding: 12px;
			vertical-align: top;
			text-align: left;
		}
		thead th {
			background: var(--vscode-editorWidget-background);
			color: var(--vscode-foreground);
			font-weight: 600;
			font-size: 0.95em;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}
		tbody th[scope="row"] {
			background: var(--vscode-editorWidget-background);
			color: var(--vscode-foreground);
			min-width: 160px;
			font-weight: 600;
		}
		.cell-summary {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin: 0 0 8px 0;
		}
		.cell-summary .count {
			color: var(--vscode-foreground);
		}
		.cell-summary .reload-flag {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			border: 1px solid var(--vscode-editorWarning-foreground);
			color: var(--vscode-editorWarning-foreground);
			border-radius: 3px;
			font-size: 0.8em;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}
		.section-label {
			font-weight: 600;
			font-size: 0.8em;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.04em;
			margin: 10px 0 4px 0;
		}
		ul {
			list-style: none;
			padding: 0;
			margin: 4px 0 0 0;
		}
		li {
			padding: 2px 0;
			font-family: var(--vscode-editor-font-family);
			font-size: 0.9em;
			color: var(--vscode-foreground);
		}
		li em {
			color: var(--vscode-descriptionForeground);
			font-style: normal;
		}
		.empty-caption {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
			margin: 0;
		}
		button.run-reset {
			margin-top: 12px;
			padding: 6px 14px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: 1px solid var(--vscode-button-border, transparent);
			border-radius: 2px;
			cursor: pointer;
			font-family: inherit;
			font-size: 0.95em;
			font-weight: 600;
		}
		button.run-reset:hover {
			background: var(--vscode-button-hoverBackground);
		}
		button.run-reset:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
		button.run-reset:focus-visible {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}
	</style>
</head>
<body>
	<h1>Reset Sizes — Preview</h1>
	<p class="intro">Read-only preview — click "Run reset" on a cell to apply that combination through the same confirmation and reload flow as the Command Palette.</p>
	<table aria-label="Reset Sizes preview matrix">
		<thead>
			<tr>
				<th scope="col"></th>
				${headerCells}
			</tr>
		</thead>
		<tbody>
			${rows}
		</tbody>
	</table>
	<script nonce="${nonce}">${inlineScript}</script>
</body>
</html>`;
}

/**
 * Render a single cell's `<td>`. The cell decides between two shapes:
 *
 *  - **No-op cell** (S41 / S42 / S43): one demoted caption, no button.
 *  - **Active cell** (anything else): summary line (counts + optional reload
 *    indicator), detail listings, then the "Run reset" button.
 *
 * The order matters — S37 + S47 require the summary in DOM order before the
 * detail listing, and the reload indicator must appear in DOM order before
 * the button.
 */
function renderCellHtml(
	cell: PreviewMatrix['cells'][ResetMode][ResetScope],
	modeLabel: (m: ResetMode) => string,
	scopeStaticLabel: (s: ResetScope) => string
): string {
	const cellAttrs = `data-cell-mode="${escapeHtml(cell.mode)}" data-cell-scope="${escapeHtml(cell.scope)}"`;

	const caption = emptyCellCaption(cell);
	if (caption !== undefined) {
		// No-op cell: caption only, no button.
		return `<td ${cellAttrs}><p class="empty-caption">${escapeHtml(caption)}</p></td>`;
	}

	// Active cell.
	const wantsZoom = cell.zoomCommands.length > 0;
	const wantsSettings = cell.plan.length > 0;

	// Summary line. Reload indicator first (left of the counts) so it's the
	// most prominent thing in the cell when it applies. DOM order has the
	// reload indicator before the button (S39 / S47).
	const reloadFlag = cell.requiresReload
		? `<span class="reload-flag" aria-label="Window reload required after running this reset">Reload required</span>`
		: '';

	const summaryParts: string[] = [];
	if (wantsSettings) {
		summaryParts.push(`<span class="count">${cell.plan.length} key${cell.plan.length === 1 ? '' : 's'}</span>`);
	}
	if (wantsZoom) {
		summaryParts.push(`<span class="count">${cell.zoomCommands.length} zoom command${cell.zoomCommands.length === 1 ? '' : 's'}</span>`);
	}

	const summary = `<div class="cell-summary">${reloadFlag}${summaryParts.join('')}</div>`;

	const settingsBlock = wantsSettings
		? `
			<div class="section-label">Keys that would be cleared</div>
			<ul>${cell.plan
				.map(s => `<li>${escapeHtml(s.key)} <em>(${describeTarget(s.target)})</em></li>`)
				.join('')}</ul>
		`
		: '';

	const zoomBlock = wantsZoom
		? `
			<div class="section-label">Zoom commands that would run</div>
			<ul>${cell.zoomCommands.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
		`
		: '';

	// Button visible label is short ("Run reset") — the cell's row and column
	// already name its (mode, scope) coordinates (S38). The accessible name
	// (aria-label) restores the (mode, scope) for assistive technology (S47).
	const ariaLabel = `Run reset (${modeLabel(cell.mode)} at ${scopeStaticLabel(cell.scope)})`;
	const button = `<button class="run-reset" type="button" aria-label="${escapeHtml(ariaLabel)}" data-command="run-reset" data-mode="${escapeHtml(cell.mode)}" data-scope="${escapeHtml(cell.scope)}">Run reset</button>`;

	return `<td ${cellAttrs}>${summary}${zoomBlock}${settingsBlock}${button}</td>`;
}

/**
 * If `cell` is a no-op (nothing would change), return the demoted caption
 * text to show. Otherwise return `undefined` and the caller renders the
 * active-cell shape.
 *
 * Detection order (mirrors the slice description):
 *  1. S41 — structurally quiet `(fontSize, session)`: Session is in-memory
 *     only and Font size only has no zoom work.
 *  2. S42 — discovery-empty Font size at Workspace / Global: no size-family
 *     keys set at that scope.
 *  3. S43 — any other cell where both plan and zoom commands are empty:
 *     generic fallback. In the current closed mode set this branch is rare
 *     (Zoom-only and Zoom-and-font-size always run zoom commands at any
 *     scope), but it exists for completeness.
 */
function emptyCellCaption(
	cell: PreviewMatrix['cells'][ResetMode][ResetScope]
): string | undefined {
	const noPlan = cell.plan.length === 0;
	const noZoom = cell.zoomCommands.length === 0;

	if (cell.mode === 'fontSize' && cell.scope === 'session') {
		// S41.
		return 'Session only resets in-memory zoom, and Font size only has no zoom work to do — nothing to clear at this scope.';
	}

	if (cell.mode === 'fontSize' && noPlan) {
		// S42 — discovery found no size-family keys set at Workspace or Global.
		return cell.scope === 'workspace'
			? 'No size-family keys are set at this workspace — nothing would change.'
			: 'No size-family keys are set at this scope — nothing would change.';
	}

	if (noPlan && noZoom) {
		// S43 fallback.
		return 'Nothing would change for this combination against your current editor state.';
	}

	return undefined;
}

function describeTarget(target: import('vscode').ConfigurationTarget): string {
	// 1 = Global, 2 = Workspace, 3 = WorkspaceFolder. We avoid importing vscode
	// here so this module stays pure (renderable from tests without a host).
	switch (Number(target)) {
		case 1: return 'Global';
		case 2: return 'Workspace';
		case 3: return 'WorkspaceFolder';
		default: return String(target);
	}
}

/**
 * HTML-escape a string for safe inclusion in an attribute or text node.
 * Keys we render are user-influenced (a third-party extension might contribute
 * exotic key names), so this is load-bearing for safety.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
