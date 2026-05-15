/**
 * Preview HTML renderer (Slice 4, S27).
 *
 * Builds the HTML body for the read-only webview from a fully computed
 * `PreviewMatrix`. Pure: no DOM, no VS Code APIs, no I/O. Each cell renders
 * the mode label, the scope label, the keys that would be cleared, the zoom
 * commands that would run, the reload-required hint, and a "Run reset" button
 * carrying that cell's (mode, scope) — which the inline script posts as a
 * `run-reset` message to the extension host (see `previewMessage.ts`).
 *
 * The HTML is rendered with a CSP nonce because `enableScripts: true` plus
 * an inline `<script>` is the simplest way to wire the button → message
 * channel without bundling. VS Code's webview docs recommend exactly this
 * pattern.
 */
import { ResetMode, ResetScope } from '../types';
import { PreviewMatrix } from './computePreviewMatrix';
import { MODE_OPTIONS, SCOPE_OPTIONS } from '../utils';

/**
 * Pure function — given a webview's CSP source and a fresh nonce, return the
 * full `<html>` document the webview should display.
 *
 * Exposed so it can be unit-tested without instantiating a webview: a test
 * just asserts the returned HTML contains the keys, scope labels, and
 * (mode, scope) data attributes for every cell.
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
		// Use the *dynamic* label from the cell (which respects remoteName via
		// labelForScope, S15) — but we don't have the cell here, so look it up.
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
	// The script is a *single*, deterministic, side-effect-free dispatcher —
	// it does not store state, observe the DOM beyond click events, or call
	// `vscode.*` (it has no access). Per VS Code webview docs, the nonce
	// keeps CSP happy with an inline script.
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

	// CSP: allow only same-origin styles (from cspSource) and inline scripts
	// marked with our nonce. No external resources are fetched.
	const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>Reset Sizes — Preview</title>
	<style>
		body {
			font-family: var(--vscode-font-family, sans-serif);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 16px;
			margin: 0;
		}
		h1 { font-size: 1.4em; margin: 0 0 6px 0; }
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
		caption {
			text-align: left;
			font-weight: 600;
			padding: 8px 0;
		}
		th, td {
			border: 1px solid var(--vscode-panel-border, #555);
			padding: 10px;
			vertical-align: top;
			text-align: left;
		}
		thead th {
			background: var(--vscode-editorWidget-background, #2a2a2a);
		}
		tbody th[scope="row"] {
			background: var(--vscode-editorWidget-background, #2a2a2a);
			min-width: 140px;
			font-weight: 600;
		}
		ul {
			list-style: none;
			padding: 0;
			margin: 4px 0;
		}
		li {
			padding: 2px 0;
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 0.9em;
		}
		.empty {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.reload-hint {
			color: var(--vscode-editorWarning-foreground, #cc8400);
			font-size: 0.85em;
			margin-top: 6px;
		}
		button.run-reset {
			margin-top: 10px;
			padding: 6px 12px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: 1px solid var(--vscode-button-border, transparent);
			border-radius: 2px;
			cursor: pointer;
			font-family: inherit;
		}
		button.run-reset:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.section-label {
			font-weight: 600;
			font-size: 0.85em;
			color: var(--vscode-descriptionForeground);
			margin-top: 6px;
		}
	</style>
</head>
<body>
	<h1>Reset Sizes — Preview</h1>
	<p class="intro">
		This is a read-only preview of what each (mode, scope) combination would change against your current editor state. Nothing is changed by viewing this page. Clicking a "Run reset" button goes through the same confirmation and reload flow as the Command Palette.
	</p>
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

function renderCellHtml(
	cell: PreviewMatrix['cells'][ResetMode][ResetScope],
	modeLabel: (m: ResetMode) => string,
	scopeStaticLabel: (s: ResetScope) => string
): string {
	const wantsZoom = cell.zoomCommands.length > 0;
	const wantsSettings = cell.plan.length > 0;

	const settingsBlock = wantsSettings
		? `
			<div class="section-label">Keys that would be cleared (${cell.plan.length}):</div>
			<ul>${cell.plan
				.map(s => `<li>${escapeHtml(s.key)} <em>(${describeTarget(s.target)})</em></li>`)
				.join('')}</ul>
		`
		: `<div class="section-label">Keys that would be cleared:</div><div class="empty">none</div>`;

	const zoomBlock = wantsZoom
		? `
			<div class="section-label">Zoom commands that would run:</div>
			<ul>${cell.zoomCommands.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
		`
		: `<div class="section-label">Zoom commands:</div><div class="empty">none</div>`;

	const reloadHint = cell.requiresReload
		? `<div class="reload-hint">A window reload would be required (window.zoomLevel cleared).</div>`
		: '';

	const button = `<button class="run-reset" data-command="run-reset" data-mode="${escapeHtml(cell.mode)}" data-scope="${escapeHtml(cell.scope)}">Run reset (${escapeHtml(modeLabel(cell.mode))} at ${escapeHtml(scopeStaticLabel(cell.scope))})</button>`;

	return `<td>${zoomBlock}${settingsBlock}${reloadHint}${button}</td>`;
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
