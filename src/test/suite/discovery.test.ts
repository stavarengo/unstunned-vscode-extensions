import * as assert from 'assert';
import {
	CURATED_SIZE_KEYS,
	EXTENSION_NAMESPACE_PREFIX,
	flattenConfigKeys,
	isSizeFamilyKey,
	SIZE_KEY_SUFFIXES
} from '../../utils';

suite('Size-key discovery (ADR 0003)', () => {

	suite('CURATED_SIZE_KEYS', () => {
		test('contains the canonical editor and terminal size keys', () => {
			const list = [...CURATED_SIZE_KEYS];
			assert.ok(list.includes('editor.fontSize'), 'editor.fontSize must be on the curated list');
			assert.ok(list.includes('editor.lineHeight'), 'editor.lineHeight must be on the curated list');
			assert.ok(list.includes('terminal.integrated.fontSize'), 'terminal.integrated.fontSize must be on the curated list');
			assert.ok(list.includes('terminal.integrated.lineHeight'), 'terminal.integrated.lineHeight must be on the curated list');
			assert.ok(list.includes('window.zoomLevel'), 'window.zoomLevel must be on the curated list');
		});

		test('contains no resetSizes.* keys (S32)', () => {
			for (const key of CURATED_SIZE_KEYS) {
				assert.ok(
					!key.startsWith(EXTENSION_NAMESPACE_PREFIX),
					`Curated list must not include any ${EXTENSION_NAMESPACE_PREFIX}* key (found: ${key})`
				);
			}
		});

		test('every entry is a well-formed dotted key', () => {
			for (const key of CURATED_SIZE_KEYS) {
				assert.ok(key.length > 0, 'Curated keys must be non-empty');
				assert.ok(key.includes('.'), `Curated key should be a dotted path (got: ${key})`);
				assert.ok(!key.endsWith('.'), `Curated key must not end with a dot (got: ${key})`);
				assert.ok(!key.startsWith('.'), `Curated key must not start with a dot (got: ${key})`);
			}
		});
	});

	suite('SIZE_KEY_SUFFIXES', () => {
		test('contains the canonical size-family suffixes', () => {
			const set = new Set(SIZE_KEY_SUFFIXES);
			assert.ok(set.has('fontSize'), 'fontSize suffix must be recognised');
			assert.ok(set.has('lineHeight'), 'lineHeight suffix must be recognised');
			assert.ok(set.has('zoomLevel'), 'zoomLevel suffix must be recognised');
		});
	});

	suite('isSizeFamilyKey', () => {
		test('returns true for curated keys', () => {
			for (const key of CURATED_SIZE_KEYS) {
				assert.strictEqual(
					isSizeFamilyKey(key), true,
					`Curated key must be recognised as size-family: ${key}`
				);
			}
		});

		test('returns true for third-party keys matching the fontSize suffix (S10)', () => {
			// myExt.editor.fontSize is the contract scenario S10.
			assert.strictEqual(isSizeFamilyKey('myExt.editor.fontSize'), true);
			assert.strictEqual(isSizeFamilyKey('thirdParty.someView.fontSize'), true);
		});

		test('returns true for keys ending in lineHeight or zoomLevel', () => {
			assert.strictEqual(isSizeFamilyKey('myExt.lineHeight'), true);
			assert.strictEqual(isSizeFamilyKey('zenMode.zoomLevel'), true);
		});

		test('returns true for camel-cased compound suffixes (e.g. codeLensFontSize)', () => {
			// VS Code itself ships these; ADR 0003 lists them as in-family.
			assert.strictEqual(isSizeFamilyKey('editor.codeLensFontSize'), true);
			assert.strictEqual(isSizeFamilyKey('editor.suggestFontSize'), true);
			assert.strictEqual(isSizeFamilyKey('editor.suggestLineHeight'), true);
		});

		test('returns false for editor.tabSize (S11: not all "size" keys are size-family)', () => {
			assert.strictEqual(
				isSizeFamilyKey('editor.tabSize'), false,
				'editor.tabSize must NOT be matched — its suffix is "tabSize", not "fontSize"'
			);
		});

		test('returns false for unrelated settings like editor.fontFamily (S9)', () => {
			assert.strictEqual(isSizeFamilyKey('editor.fontFamily'), false);
			assert.strictEqual(isSizeFamilyKey('workbench.colorTheme'), false);
			assert.strictEqual(isSizeFamilyKey('editor.tokenColorCustomizations'), false);
		});

		test('returns false for any resetSizes.* key (S32)', () => {
			assert.strictEqual(isSizeFamilyKey('resetSizes.confirmBeforeDestructiveReset'), false);
			assert.strictEqual(isSizeFamilyKey('resetSizes.showSummaryNotification'), false);
			// Even something that would otherwise match a suffix must be excluded.
			assert.strictEqual(isSizeFamilyKey('resetSizes.fontSize'), false, 'extension namespace must never match');
			assert.strictEqual(isSizeFamilyKey('resetSizes.something.fontSize'), false);
		});
	});

	suite('flattenConfigKeys', () => {
		test('flattens a nested config object to dotted paths', () => {
			const fakeConfig = {
				editor: {
					fontSize: 14,
					fontFamily: 'Menlo',
					suggest: {
						fontSize: 12
					}
				},
				terminal: {
					integrated: {
						fontSize: 13
					}
				}
			};
			const keys = flattenConfigKeys(fakeConfig).sort();
			assert.deepStrictEqual(keys, [
				'editor.fontFamily',
				'editor.fontSize',
				'editor.suggest.fontSize',
				'terminal.integrated.fontSize'
			]);
		});

		test('stops at array values (arrays are leaves, not branches)', () => {
			const fakeConfig = {
				editor: {
					rulers: [80, 120],
					fontSize: 14
				}
			};
			const keys = flattenConfigKeys(fakeConfig).sort();
			assert.deepStrictEqual(keys, ['editor.fontSize', 'editor.rulers']);
		});

		test('returns an empty list for an empty config', () => {
			assert.deepStrictEqual(flattenConfigKeys({}), []);
		});

		test('handles primitive leaves at the root', () => {
			const fakeConfig = { 'window.zoomLevel': 0 };
			const keys = flattenConfigKeys(fakeConfig).sort();
			// Dot-containing keys at the root level are leaves themselves.
			assert.deepStrictEqual(keys, ['window.zoomLevel']);
		});
	});
});
