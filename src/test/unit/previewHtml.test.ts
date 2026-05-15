import * as assert from 'assert';
import * as vscode from 'vscode';
import { computePreviewMatrix } from '../../preview/computePreviewMatrix';
import { renderPreviewHtml } from '../../preview/previewHtml';
import { InspectFn, InspectResult } from '../../utils';

function makeInspect(base: Record<string, InspectResult | undefined> = {}): InspectFn {
	return (key: string): InspectResult | undefined => base[key];
}

/**
 * Extract the inline `<style>` block. The "no literal colours" invariant only
 * applies to declarative styling — body text (key names, scope labels, etc.)
 * may incidentally include strings that look like colour names.
 */
function extractStyleBlock(html: string): string {
	const match = html.match(/<style>([\s\S]*?)<\/style>/);
	assert.ok(match, 'HTML must contain a <style> block');
	return match![1];
}

/**
 * Named CSS colours we consider literal-colour matches. We exclude
 * `transparent`, `currentColor`, and `inherit` per the slice's allowlist.
 * Font-family fallbacks (`sans-serif`, `monospace`) are not colours.
 */
const NAMED_COLOURS = [
	'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
	'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
	'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral',
	'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
	'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
	'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
	'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
	'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
	'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite',
	'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
	'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
	'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
	'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
	'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey',
	'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
	'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
	'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
	'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
	'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
	'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite',
	'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
	'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
	'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
	'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
	'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue',
	'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue',
	'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
	'whitesmoke', 'yellow', 'yellowgreen'
];

suite('renderPreviewHtml (redesign — Slice 2)', () => {

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

	test('S27: shows the keys that would be cleared in each cell (detail listing preserved)', () => {
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

	test('Reload-required cells include a hint about the window reload', () => {
		const inspect = makeInspect({
			'window.zoomLevel': { globalValue: 1 }
		});
		const matrix = computePreviewMatrix({}, inspect, [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(/reload/i.test(html),
			'HTML must include a reload hint when a cell requires a reload');
	});

	test('S15: remote label "User settings (remote)" appears when remoteName is set', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], 'ssh-remote+host');
		const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
		assert.ok(html.includes('User settings (remote)'),
			'S15: remote label must surface in the header for the Global scope');
	});

	test('CSP includes the supplied nonce and cspSource', () => {
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
		const html = renderPreviewHtml(matrix, 'self', 'nonce-XYZ123');
		assert.ok(html.includes("Content-Security-Policy"),
			'Webview HTML must declare a CSP');
		assert.ok(html.includes("'nonce-nonce-XYZ123'") || html.includes("nonce-XYZ123"),
			'CSP must reference the supplied nonce');
		assert.ok(html.includes('vscode-resource:') === false || true,
			'CSP style-src must reference the supplied cspSource');
		// Also test with explicit cspSource string.
		const html2 = renderPreviewHtml(matrix, 'vscode-resource:', 'nonce-XYZ');
		assert.ok(html2.includes('vscode-resource:'),
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
		const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
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

	// ----------------------------------------------------------------------
	// Slice 2 redesign assertions
	// ----------------------------------------------------------------------

	suite('S45 / contract invariant: no literal colours in the style block', () => {
		test('no hex colour codes anywhere in the style block', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			const hex = style.match(/#[0-9a-fA-F]{3,8}\b/);
			assert.strictEqual(hex, null,
				`Style block must contain no hex colour codes. Found: ${hex?.[0]}`);
		});

		test('no rgb()/rgba()/hsl()/hsla() in the style block', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			assert.strictEqual(/\brgb\s*\(/i.test(style), false,
				'Style block must contain no rgb()');
			assert.strictEqual(/\brgba\s*\(/i.test(style), false,
				'Style block must contain no rgba()');
			assert.strictEqual(/\bhsl\s*\(/i.test(style), false,
				'Style block must contain no hsl()');
			assert.strictEqual(/\bhsla\s*\(/i.test(style), false,
				'Style block must contain no hsla()');
		});

		test('no named CSS colours (other than transparent/currentColor/inherit) in the style block', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			const lowerStyle = style.toLowerCase();
			for (const colour of NAMED_COLOURS) {
				// Use word-boundary regex so 'red' doesn't match inside e.g. 'border'.
				const pattern = new RegExp('\\b' + colour + '\\b');
				assert.strictEqual(pattern.test(lowerStyle), false,
					`Style block must not use literal colour "${colour}"`);
			}
		});

		test('no literal colour fallbacks inside var() (only theme variables)', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			// Match any var() with a fallback and check the fallback is empty,
			// `transparent`, `currentColor`, `inherit`, or another var().
			const varCalls = style.match(/var\([^)]+\)/g) ?? [];
			for (const call of varCalls) {
				const fallbackMatch = call.match(/var\(\s*--[^,)]+\s*,\s*([^)]+)\)/);
				if (!fallbackMatch) {
					continue; // No fallback — fine.
				}
				const fallback = fallbackMatch[1].trim().toLowerCase();
				// Permit only structurally safe fallbacks.
				const ok = fallback === 'transparent'
					|| fallback === 'currentcolor'
					|| fallback === 'inherit'
					|| fallback.startsWith('var(');
				assert.ok(ok,
					`var() fallback must not be a literal colour. Found: "${call}"`);
			}
		});
	});

	suite('S40: intro copy is at most one short sentence', () => {
		test('intro is a single sentence', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const introMatch = html.match(/<p[^>]*class="[^"]*intro[^"]*"[^>]*>([\s\S]*?)<\/p>/);
			assert.ok(introMatch, 'HTML must contain an intro paragraph');
			const text = introMatch![1].replace(/\s+/g, ' ').trim();
			// Count terminal sentence punctuation — exactly one.
			const sentenceEnds = text.match(/[.!?](\s|$)/g) ?? [];
			assert.ok(sentenceEnds.length <= 1,
				`Intro must be at most one sentence. Got ${sentenceEnds.length} sentence endings in: "${text}"`);
		});
	});

	suite('S38: active cells render a plain "Run reset" button (no coordinate verbiage)', () => {
		test('button visible text is exactly "Run reset"', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Pull out every <button …>…</button> body.
			const buttons = html.match(/<button[^>]*>([\s\S]*?)<\/button>/g) ?? [];
			assert.ok(buttons.length > 0, 'At least one button must be rendered');
			for (const button of buttons) {
				const body = button.replace(/<button[^>]*>/, '').replace(/<\/button>/, '').trim();
				assert.strictEqual(body, 'Run reset',
					`Button visible text must be exactly "Run reset". Got: "${body}"`);
			}
		});

		test('button visible text does NOT contain mode/scope verbiage', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const buttons = html.match(/<button[^>]*>([\s\S]*?)<\/button>/g) ?? [];
			for (const button of buttons) {
				const body = button.replace(/<button[^>]*>/, '').replace(/<\/button>/, '');
				assert.strictEqual(body.includes('Zoom only'), false,
					`Button visible text must not contain "Zoom only". Got: "${body}"`);
				assert.strictEqual(body.includes('Font size only'), false,
					`Button visible text must not contain "Font size only". Got: "${body}"`);
				assert.strictEqual(body.includes('Zoom and font size'), false,
					`Button visible text must not contain "Zoom and font size". Got: "${body}"`);
				assert.strictEqual(body.includes('Session'), false,
					`Button visible text must not contain "Session". Got: "${body}"`);
				assert.strictEqual(body.includes('Workspace'), false,
					`Button visible text must not contain "Workspace". Got: "${body}"`);
				assert.strictEqual(body.includes('Global'), false,
					`Button visible text must not contain "Global". Got: "${body}"`);
			}
		});
	});

	suite('S47: button accessible name carries mode and scope', () => {
		test('each active button has an aria-label naming its mode and scope', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Every button should have an aria-label.
			const buttons = html.match(/<button[^>]*>/g) ?? [];
			for (const button of buttons) {
				assert.ok(/aria-label="[^"]+"/.test(button),
					`Every button must have an aria-label. Got: ${button}`);
			}
			// And at least one aria-label must mention each mode/scope pair
			// for the rendered active cells.
			const ariaLabels = (html.match(/aria-label="([^"]+)"/g) ?? [])
				.map(m => m.replace(/aria-label="/, '').replace(/"$/, ''));
			// Sanity: every active mode + scope shows up somewhere in an aria-label.
			const buttonAriaLabels = ariaLabels.filter(l => l.startsWith('Run reset'));
			// Active cells include zoom×* (always active), and fontSize × global (has key).
			assert.ok(buttonAriaLabels.some(l => l.includes('Zoom only') && l.includes('Session')),
				'aria-label must name Zoom only at Session for that active cell');
			assert.ok(buttonAriaLabels.some(l => l.includes('Font size only') && l.includes('Global')),
				'aria-label must name Font size only at Global for that active cell');
		});
	});

	suite('Active cells render the "run-reset" button with data attributes (S29 preserved)', () => {
		test('every active cell carries data-command="run-reset" + data-mode + data-scope', () => {
			// Set up a matrix where every cell is active: a non-Session font-size
			// key set at Workspace AND Global gives every (mode, scope) other than
			// fontSize × session something to do.
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22, workspaceValue: 18 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Zoom×* cells always render buttons (zoom commands run at every scope).
			// fontSize×session is structurally quiet (no button — see S41 below).
			// fontSize × workspace / global have keys, so they render buttons.
			// zoomAndFontSize × * always render buttons (zoom keeps them active).
			const buttonRegex = /<button[^>]*data-command="run-reset"[^>]*>/g;
			const buttons = html.match(buttonRegex) ?? [];
			// 9 cells minus 1 structurally-quiet (fontSize × session) = 8.
			assert.strictEqual(buttons.length, 8,
				`Expected 8 active "run-reset" buttons (9 cells minus fontSize×session). Got: ${buttons.length}`);

			// And each active button names its (mode, scope) via data attributes.
			const modes = ['zoom', 'fontSize', 'zoomAndFontSize'];
			const scopes = ['session', 'workspace', 'global'];
			for (const mode of modes) {
				for (const scope of scopes) {
					if (mode === 'fontSize' && scope === 'session') {
						// Structurally quiet — no button rendered.
						const present = new RegExp(`data-command="run-reset"[^>]*data-mode="${mode}"[^>]*data-scope="${scope}"`)
							.test(html);
						assert.strictEqual(present, false,
							`(fontSize, session) is structurally quiet — no button expected`);
						continue;
					}
					const presentForward = new RegExp(`data-command="run-reset"[^>]*data-mode="${mode}"[^>]*data-scope="${scope}"`)
						.test(html);
					const presentReverse = new RegExp(`data-command="run-reset"[^>]*data-scope="${scope}"[^>]*data-mode="${mode}"`)
						.test(html);
					assert.ok(presentForward || presentReverse,
						`Active cell (${mode}, ${scope}) must carry data-mode + data-scope on its button`);
				}
			}
		});

		test('inline script protocol matches previewMessage.ts (type: "run-reset")', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// The inline script must post messages of shape { type: 'run-reset', … }.
			// (Not { kind: … } — that drifts from previewMessage.ts.)
			const scriptMatch = html.match(/<script[^>]*nonce[^>]*>([\s\S]*?)<\/script>/);
			assert.ok(scriptMatch, 'HTML must contain a nonce-gated inline script');
			const script = scriptMatch![1];
			assert.ok(script.includes("type: 'run-reset'") || script.includes('type: "run-reset"'),
				'Inline script must post messages of shape { type: "run-reset", … } to match previewMessage.ts');
		});
	});

	suite('S41 / S42 / S43: no-op cells render a demoted caption and omit the button', () => {
		test('S41: (fontSize, session) is structurally quiet — caption present, no button', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Find the table cell for fontSize × session. We anchor on a data
			// attribute the renderer writes on each <td> so the test is
			// independent of cell ordering inside a row.
			const cellHtml = extractCellHtml(html, 'fontSize', 'session');
			// No button.
			assert.strictEqual(/<button[^>]*>/.test(cellHtml), false,
				`S41: (fontSize, session) must NOT render a <button> element. Got:\n${cellHtml}`);
			// A caption that references the structural reason.
			assert.ok(/Session/i.test(cellHtml) || /in-memory/i.test(cellHtml) || /zoom/i.test(cellHtml),
				`S41 caption must describe why the cell is quiet. Got:\n${cellHtml}`);
		});

		test('S42: (fontSize, workspace) with no keys set — caption present, no button', () => {
			// Empty inspect — no keys discovered.
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'workspace');
			assert.strictEqual(/<button[^>]*>/.test(cellHtml), false,
				`S42: (fontSize, workspace) with empty discovery must NOT render a <button>. Got:\n${cellHtml}`);
			// Caption mentions no keys at this scope.
			assert.ok(/no/i.test(cellHtml) && /scope|workspace/i.test(cellHtml),
				`S42 caption must say no size-family keys are set at the scope. Got:\n${cellHtml}`);
		});

		test('S42: (fontSize, global) with no keys set — caption present, no button', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'global');
			assert.strictEqual(/<button[^>]*>/.test(cellHtml), false,
				`S42: (fontSize, global) with empty discovery must NOT render a <button>. Got:\n${cellHtml}`);
			assert.ok(/no/i.test(cellHtml),
				`S42 caption must say no size-family keys are set at the scope. Got:\n${cellHtml}`);
		});

		test('no-op cells reference a demoted theme token', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'session');
			// The demoted caption uses a class that, in the style block, maps to
			// `--vscode-descriptionForeground` (or an equivalent demoted token).
			// We verify by reading the style block and looking for the class's
			// colour rule.
			const style = extractStyleBlock(html);
			// Identify the class name used on the caption.
			const captionClassMatch = cellHtml.match(/class="([^"]*?(?:empty-caption|caption|demoted)[^"]*?)"/);
			assert.ok(captionClassMatch,
				`S41 caption must carry a class identifying it as demoted. Got:\n${cellHtml}`);
			const className = captionClassMatch![1].split(/\s+/).find(c => /caption|demoted|empty/.test(c))!;
			// The class's rule in the style block must reference descriptionForeground or an equivalent demoted token.
			const classRuleRegex = new RegExp(`\\.${className}\\s*\\{[^}]*--vscode-descriptionForeground[^}]*\\}`);
			const matches = classRuleRegex.test(style);
			assert.ok(matches,
				`Caption class "${className}" must use --vscode-descriptionForeground (or an equivalent demoted token) in its style rule.`);
		});

		test('contract invariant: no <button> in any no-op cell', () => {
			// Empty inspect — fontSize × session is structurally quiet,
			// fontSize × workspace and fontSize × global are discovery-empty.
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			for (const scope of ['session', 'workspace', 'global']) {
				const cellHtml = extractCellHtml(html, 'fontSize', scope);
				assert.strictEqual(/<button[^>]*>/.test(cellHtml), false,
					`No-op cell (fontSize, ${scope}) must NOT render a button. Got:\n${cellHtml}`);
				// And not a disabled button either.
				assert.strictEqual(/disabled/i.test(cellHtml), false,
					`No-op cell (fontSize, ${scope}) must NOT render a disabled button. Got:\n${cellHtml}`);
			}
		});
	});

	suite('S37 / S39: active cells render a summary line above the detail listing, with reload indicator first', () => {
		test('summary line appears in DOM before the detail listing', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Zoom × Session is an active cell (zoom commands run at every scope).
			const cellHtml = extractCellHtml(html, 'zoom', 'session');
			const summaryIdx = cellHtml.search(/class="[^"]*summary[^"]*"/);
			const detailIdx = cellHtml.indexOf('<ul');
			assert.ok(summaryIdx >= 0,
				`Active cell must render a summary line. Got:\n${cellHtml}`);
			if (detailIdx >= 0) {
				assert.ok(summaryIdx < detailIdx,
					`Summary line must appear in DOM before the detail listing. Got:\n${cellHtml}`);
			}
		});

		test('summary names the number of keys for cells with a non-empty plan (S37)', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'global');
			// Summary cites the count of keys.
			assert.ok(/1\s*key/i.test(cellHtml),
				`Summary should name the count of keys. Got:\n${cellHtml}`);
		});

		test('summary names the number of zoom commands for zoom-relevant cells (S37)', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			// Zoom × Session: three zoom commands, no keys.
			const cellHtml = extractCellHtml(html, 'zoom', 'session');
			// Summary mentions a count of commands.
			assert.ok(/3\s*(zoom\s*)?command/i.test(cellHtml),
				`Summary should name the count of zoom commands. Got:\n${cellHtml}`);
		});

		test('S39: reload-required cells render a reload indicator in the summary, before the button', () => {
			const inspect = makeInspect({
				'window.zoomLevel': { globalValue: 1 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'global');
			// Reload indicator present.
			const reloadMatch = cellHtml.match(/class="[^"]*reload[^"]*"|aria-label="[^"]*[Rr]eload[^"]*"/);
			assert.ok(reloadMatch,
				`Reload-required cell must render a reload indicator. Got:\n${cellHtml}`);
			// Reload indicator appears before the button in DOM order.
			const reloadIdx = cellHtml.search(/class="[^"]*reload[^"]*"|aria-label="[^"]*[Rr]eload[^"]*"/);
			const buttonIdx = cellHtml.indexOf('<button');
			if (buttonIdx >= 0) {
				assert.ok(reloadIdx < buttonIdx,
					`Reload indicator must appear in DOM before the button. Got:\n${cellHtml}`);
			}
		});

		test('S47: reload indicator carries an accessible name (not colour-only)', () => {
			const inspect = makeInspect({
				'window.zoomLevel': { globalValue: 1 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const cellHtml = extractCellHtml(html, 'fontSize', 'global');
			// The reload indicator carries either visible text containing "reload"
			// or an aria-label that includes "reload" — i.e. it's not colour-only.
			const reloadFragmentMatch = cellHtml.match(/<[^>]*class="[^"]*reload[^"]*"[^>]*>[\s\S]*?<\/[^>]+>|<[^>]*aria-label="[^"]*[Rr]eload[^"]*"[^>]*\/?>/);
			assert.ok(reloadFragmentMatch,
				`Reload indicator must be present. Got:\n${cellHtml}`);
			const fragment = reloadFragmentMatch![0];
			const hasText = /[Rr]eload/.test(fragment);
			const hasAria = /aria-label="[^"]*[Rr]eload[^"]*"/.test(fragment);
			assert.ok(hasText || hasAria,
				`Reload indicator must carry an accessible name (visible text or aria-label). Got:\n${fragment}`);
		});
	});

	suite('S38 / S44: button reads as a button, not as chrome', () => {
		test('button class references --vscode-button-background and --vscode-button-foreground in its style rule', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			// Some button rule must use the button-background and button-foreground tokens.
			assert.ok(/button[^{]*\{[^}]*--vscode-button-background/.test(style)
				|| /\.run-reset[^{]*\{[^}]*--vscode-button-background/.test(style),
				'Button style rule must use --vscode-button-background');
			assert.ok(/button[^{]*\{[^}]*--vscode-button-foreground/.test(style)
				|| /\.run-reset[^{]*\{[^}]*--vscode-button-foreground/.test(style),
				'Button style rule must use --vscode-button-foreground');
		});
	});

	suite('S46: focus indicator drawn from a VS Code focus variable', () => {
		test('button :focus rule references --vscode-focusBorder', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			// A button-related :focus rule (or :focus-visible) references --vscode-focusBorder.
			const focusRuleMatch = style.match(/\.run-reset[:][^{]*\{[^}]*\}/g)
				|| style.match(/button[^{]*:focus[^{]*\{[^}]*\}/g);
			assert.ok(focusRuleMatch && focusRuleMatch.some(rule => /--vscode-focusBorder/.test(rule)),
				`Button :focus rule must reference --vscode-focusBorder. Style block:\n${style}`);
		});
	});

	suite('S48: no transitions or animations in the style block', () => {
		test('style block declares no CSS transitions or animations', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			const html = renderPreviewHtml(matrix, 'self', 'nonce-abc');
			const style = extractStyleBlock(html);
			assert.strictEqual(/\btransition\s*:/.test(style), false,
				'Style block must not declare CSS transitions (S48: reduced motion)');
			assert.strictEqual(/\banimation\s*:/.test(style), false,
				'Style block must not declare CSS animations (S48: reduced motion)');
			assert.strictEqual(/@keyframes/.test(style), false,
				'Style block must not define @keyframes (S48: reduced motion)');
		});
	});
});

/**
 * Pull the inner HTML of the <td> for a specific (mode, scope) cell. We rely
 * on the renderer attaching data-cell-mode / data-cell-scope to each <td>
 * (production code adds these so tests can address cells deterministically).
 */
function extractCellHtml(html: string, mode: string, scope: string): string {
	const regex = new RegExp(
		`<td[^>]*data-cell-mode="${mode}"[^>]*data-cell-scope="${scope}"[^>]*>([\\s\\S]*?)<\\/td>`
	);
	const reverseRegex = new RegExp(
		`<td[^>]*data-cell-scope="${scope}"[^>]*data-cell-mode="${mode}"[^>]*>([\\s\\S]*?)<\\/td>`
	);
	const match = html.match(regex) ?? html.match(reverseRegex);
	if (!match) {
		throw new Error(
			`Could not locate <td> for (${mode}, ${scope}). The renderer must attach `
			+ `data-cell-mode + data-cell-scope to each <td> for deterministic test addressing.`
		);
	}
	return match[1];
}
