import * as assert from 'assert';
import { RELOAD_REQUIRED_KEYS, requiresReload } from '../../utils/reloadClassification';

suite('Reload Classification (Slice 3)', () => {
	test('window.zoomLevel requires a reload', () => {
		assert.strictEqual(requiresReload('window.zoomLevel'), true);
	});

	test('editor.fontSize does NOT require a reload', () => {
		// The slice spec calls this out specifically: clearing editor.fontSize
		// applies live — the user must not be prompted to reload.
		assert.strictEqual(requiresReload('editor.fontSize'), false);
	});

	test('common live-applying size keys do NOT require a reload', () => {
		// These all take effect immediately when the user changes them via the
		// settings UI in VS Code 1.74+; clearing must therefore not trigger a
		// reload prompt either.
		const liveKeys = [
			'editor.lineHeight',
			'editor.codeLensFontSize',
			'editor.suggestFontSize',
			'editor.suggestLineHeight',
			'editor.inlayHints.fontSize',
			'terminal.integrated.fontSize',
			'terminal.integrated.lineHeight',
			'debug.console.fontSize',
			'debug.console.lineHeight',
			'markdown.preview.fontSize',
			'markdown.preview.lineHeight',
			'scm.inputFontSize',
			'chat.editor.fontSize',
			'chat.editor.lineHeight',
			'notebook.markup.fontSize',
			'notebook.output.fontSize',
			'notebook.output.lineHeight'
		];
		for (const key of liveKeys) {
			assert.strictEqual(
				requiresReload(key), false,
				`${key} should not require a reload (it applies live)`
			);
		}
	});

	test('third-party suffix-matched keys do NOT require a reload by default', () => {
		// We don't know what an arbitrary third-party extension does with its
		// setting, but a spurious reload prompt is more disruptive than a
		// missed one — the user can reload manually if needed.
		assert.strictEqual(requiresReload('myExt.editor.fontSize'), false);
		assert.strictEqual(requiresReload('someExt.someZoomLevel'), false);
	});

	test('unrecognised keys do NOT require a reload', () => {
		// The classifier only knows about the keys on its list. Everything
		// else (including non-size keys, mistyped keys, future VS Code keys
		// we haven't classified) is "no reload" by default.
		assert.strictEqual(requiresReload('editor.tabSize'), false);
		assert.strictEqual(requiresReload('workbench.colorTheme'), false);
		assert.strictEqual(requiresReload(''), false);
	});

	test('the reload-required set is non-empty', () => {
		// Sanity guard: if this slice's classification ever becomes empty, the
		// reload prompt branch can never fire, which makes S16-S19 untestable.
		assert.ok(
			RELOAD_REQUIRED_KEYS.size > 0,
			'At least one key (window.zoomLevel) must be classified as reload-required'
		);
	});

	test('every reload-required key is a real string', () => {
		for (const key of RELOAD_REQUIRED_KEYS) {
			assert.strictEqual(typeof key, 'string');
			assert.ok(key.length > 0, 'No empty keys in the reload set');
		}
	});
});
