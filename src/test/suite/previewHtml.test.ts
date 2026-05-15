import * as assert from 'assert';
import * as vscode from 'vscode';
import { computePreviewMatrix } from '../../preview/computePreviewMatrix';
import { renderPreviewHtml } from '../../preview/previewHtml';
import { InspectFn, InspectResult } from '../../utils';

function makeInspect(base: Record<string, InspectResult | undefined> = {}): InspectFn {
	return (key: string): InspectResult | undefined => base[key];
}

suite('renderPreviewHtml (Slice 4)', () => {

	test('renders the page title', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(html.includes('Reset Sizes — Preview'),
			'HTML must include the page title');
	});

	test('S27: includes every mode label and scope label', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		// Mode labels from MODE_OPTIONS.
		assert.ok(html.includes('Zoom only'));
		assert.ok(html.includes('Font size only'));
		assert.ok(html.includes('Zoom and font size'));
		// Scope labels.
		assert.ok(html.includes('Session'));
		assert.ok(html.includes('Workspace'));
		assert.ok(html.includes('Global'));
	});

	test('S27: shows the keys that would be cleared in each cell', () => {
		const inspect = makeInspect({
			'editor.fontSize': { globalValue: 22 }
		});
		const matrix = computePreviewMatrix({}, inspect, [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		// editor.fontSize is in the fontSize × global cell (and zoomAndFontSize × global).
		assert.ok(html.includes('editor.fontSize'),
			'HTML must name the keys planned for each cell');
	});

	test('S27: lists the zoom commands that would run', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(html.includes('workbench.action.zoomReset'),
			'HTML must list the zoom commands for zoom-relevant cells');
		assert.ok(html.includes('editor.action.fontZoomReset'));
		assert.ok(html.includes('workbench.action.terminal.fontZoomReset'));
	});

	test('Cells with no work say "none"', () => {
		// Empty inspect: Font-size-only at Session has neither keys nor zoom.
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(html.includes('none'),
			'HTML must show "none" markers for cells with no work');
	});

	test('Reload-required cells include a hint about the window reload', () => {
		const inspect = makeInspect({
			'window.zoomLevel': { globalValue: 1 }
		});
		const matrix = computePreviewMatrix({}, inspect, [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(/window reload/i.test(html),
			'HTML must include a reload hint when a cell requires a reload');
	});

	test('S29: every cell carries a "run-reset" button with its mode and scope as data attributes', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		// Check each (mode, scope) pair appears as data attributes.
		const modes = ['zoom', 'fontSize', 'zoomAndFontSize'];
		const scopes = ['session', 'workspace', 'global'];
		for (const mode of modes) {
			for (const scope of scopes) {
				assert.ok(
					html.includes(`data-mode="${mode}"`),
					`HTML must carry data-mode="${mode}" on a button`
				);
				assert.ok(
					html.includes(`data-scope="${scope}"`),
					`HTML must carry data-scope="${scope}" on a button`
				);
			}
		}
	});

	test('every cell has a "data-command=run-reset" button', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		const buttonCount = (html.match(/data-command="run-reset"/g) || []).length;
		assert.strictEqual(buttonCount, 9,
			`Exactly 9 buttons (3 modes × 3 scopes) must carry data-command="run-reset". Got: ${buttonCount}`);
	});

	test('S15: remote label "User settings (remote)" appears when remoteName is set', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], 'ssh-remote+host');
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(html.includes('User settings (remote)'),
			'S15: remote label must surface in the header for the Global scope');
	});

	test('CSP includes the supplied nonce and cspSource', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'vscode-resource:', 'nonce-XYZ123');
		assert.ok(html.includes("Content-Security-Policy"),
			'Webview HTML must declare a CSP');
		assert.ok(html.includes("'nonce-nonce-XYZ123'") || html.includes("nonce-XYZ123"),
			'CSP must reference the supplied nonce');
		assert.ok(html.includes('vscode-resource:'),
			'CSP style-src must reference the supplied cspSource');
	});

	test('inline <script> is gated by the nonce attribute', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abcdef');
		// Find the inline script tag.
		const match = html.match(/<script\s+nonce="([^"]+)">/);
		assert.ok(match, 'HTML must include an inline <script> with a nonce attribute');
		assert.strictEqual(match![1], 'nonce-abcdef',
			'Inline script nonce must match the supplied nonce');
	});

	test('HTML-escapes key names so a hostile key cannot break the page', () => {
		// We can't easily inject a malicious key into discovery, but we can
		// render the matrix with a synthetic plan whose keys contain HTML
		// special characters and assert they're escaped.
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		// Inject a fake step into the fontSize × global cell after computation
		// to test the escape path. (This is a unit test on the renderer's
		// escape behaviour, not on the discovery contract.)
		matrix.cells.fontSize.global.plan.push({
			key: '<script>alert(1)</script>',
			target: vscode.ConfigurationTarget.Global
		});
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(
			!html.includes('<script>alert(1)</script>'),
			'Hostile key string must NOT appear verbatim in the rendered HTML'
		);
		assert.ok(
			html.includes('&lt;script&gt;'),
			'Hostile key string must be HTML-escaped'
		);
	});

	test('matrix headers list each scope label exactly once per header', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		// Pull out the <thead> block.
		const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/);
		assert.ok(theadMatch, 'HTML must contain a <thead>');
		const thead = theadMatch![0];
		// Each scope label appears once in the header row.
		assert.strictEqual(
			(thead.match(/Session/g) || []).length, 1,
			'Session must appear exactly once in the header'
		);
		assert.strictEqual(
			(thead.match(/Workspace/g) || []).length, 1,
			'Workspace must appear exactly once in the header'
		);
		assert.strictEqual(
			(thead.match(/Global/g) || []).length, 1,
			'Global must appear exactly once in the header'
		);
	});
});
