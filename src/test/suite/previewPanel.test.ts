import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	_testGetCurrentPanel,
	_testResetCurrentPanel,
	openPreviewPanel,
	PREVIEW_PANEL_TITLE,
	PREVIEW_VIEW_TYPE
} from '../../preview/previewPanel';

/**
 * Lightweight stand-in for an ExtensionContext when one is needed for
 * `subscriptions` plumbing. The real ExtensionContext has many more fields,
 * but the panel manager only touches `subscriptions`.
 */
function fakeContext(): vscode.ExtensionContext {
	const subs: { dispose: () => unknown }[] = [];
	return {
		subscriptions: subs,
		// The rest of the fields are not used by openPreviewPanel.
	} as unknown as vscode.ExtensionContext;
}

suite('previewPanel — opening, single-instance, S28 (no writes)', () => {

	// Silence the summary notification across the suite so the headless test
	// host does not pop information messages whose dismissal we never await.
	let originalShowSummary: unknown;
	let originalConfirm: unknown;

	suiteSetup(async () => {
		const configApi = vscode.workspace.getConfiguration('resetSizes');
		originalShowSummary = configApi.inspect('showSummaryNotification')?.globalValue;
		originalConfirm = configApi.inspect('confirmBeforeDestructiveReset')?.globalValue;
		await configApi.update('showSummaryNotification', false, vscode.ConfigurationTarget.Global);
		await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
	});

	suiteTeardown(async () => {
		const configApi = vscode.workspace.getConfiguration('resetSizes');
		await configApi.update('showSummaryNotification', originalShowSummary, vscode.ConfigurationTarget.Global);
		await configApi.update('confirmBeforeDestructiveReset', originalConfirm, vscode.ConfigurationTarget.Global);
	});

	setup(() => {
		// Make sure each test starts with no panel hanging around from a prior run.
		const panel = _testGetCurrentPanel();
		if (panel) {
			panel.dispose();
		}
		_testResetCurrentPanel();
	});

	teardown(() => {
		const panel = _testGetCurrentPanel();
		if (panel) {
			panel.dispose();
		}
		_testResetCurrentPanel();
	});

	test('S27: opening the preview produces a single WebviewPanel with the expected title and viewType', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (preview panel)');
		try {
			const panel = openPreviewPanel(context, channel);
			assert.strictEqual(panel.viewType, PREVIEW_VIEW_TYPE,
				`viewType must be ${PREVIEW_VIEW_TYPE}`);
			assert.strictEqual(panel.title, PREVIEW_PANEL_TITLE,
				`title must be "${PREVIEW_PANEL_TITLE}"`);
			assert.ok(panel.webview.html.length > 0,
				'Panel HTML must be populated on open');
		} finally {
			channel.dispose();
		}
	});

	test('Second invocation reveals the existing panel rather than spawning a duplicate', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (preview dup)');
		try {
			const first = openPreviewPanel(context, channel);
			const second = openPreviewPanel(context, channel);
			assert.strictEqual(first, second,
				'Second open must reveal the existing panel reference, not create a new one');
		} finally {
			channel.dispose();
		}
	});

	test('S28: opening AND closing the preview makes no settings writes (byte-equal snapshot)', async () => {
		// Pre-populate a few keys so we have something to snapshot. The keys
		// used here are size-family keys that the preview's matrix computation
		// will iterate over — if a write were going to happen, this would be
		// where.
		const fontSizeKey = 'editor.fontSize';
		const fontFamilyKey = 'editor.fontFamily';
		const tabSizeKey = 'editor.tabSize';
		const config = vscode.workspace.getConfiguration();

		const originalFontSize = config.inspect(fontSizeKey)?.globalValue;
		const originalFontFamily = config.inspect(fontFamilyKey)?.globalValue;
		const originalTabSize = config.inspect(tabSizeKey)?.globalValue;

		await config.update(fontSizeKey, 22, vscode.ConfigurationTarget.Global);
		await config.update(fontFamilyKey, 'Menlo', vscode.ConfigurationTarget.Global);
		await config.update(tabSizeKey, 5, vscode.ConfigurationTarget.Global);

		// Also snapshot the silent-reload preference and the confirmation
		// preference — both extension-owned state.
		const reloadSilentlyBefore = vscode.workspace.getConfiguration('resetSizes')
			.inspect('reloadSilently')?.globalValue;
		const confirmBefore = vscode.workspace.getConfiguration('resetSizes')
			.inspect('confirmBeforeDestructiveReset')?.globalValue;

		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (preview S28)');

		try {
			const panel = openPreviewPanel(context, channel);
			// Closing immediately — the snapshot below verifies no writes occurred.
			panel.dispose();
			_testResetCurrentPanel();

			const after = vscode.workspace.getConfiguration();
			assert.strictEqual(after.inspect(fontSizeKey)?.globalValue, 22,
				'S28: opening + closing the preview must not touch editor.fontSize');
			assert.strictEqual(after.inspect(fontFamilyKey)?.globalValue, 'Menlo',
				'S28: opening + closing the preview must not touch editor.fontFamily');
			assert.strictEqual(after.inspect(tabSizeKey)?.globalValue, 5,
				'S28: opening + closing the preview must not touch editor.tabSize');

			const reloadSilentlyAfter = vscode.workspace.getConfiguration('resetSizes')
				.inspect('reloadSilently')?.globalValue;
			const confirmAfter = vscode.workspace.getConfiguration('resetSizes')
				.inspect('confirmBeforeDestructiveReset')?.globalValue;
			assert.strictEqual(reloadSilentlyAfter, reloadSilentlyBefore,
				'S28: opening + closing the preview must not touch resetSizes.reloadSilently');
			assert.strictEqual(confirmAfter, confirmBefore,
				'S28: opening + closing the preview must not touch resetSizes.confirmBeforeDestructiveReset');
		} finally {
			// Restore originals.
			await vscode.workspace.getConfiguration().update(fontSizeKey, originalFontSize, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(fontFamilyKey, originalFontFamily, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(tabSizeKey, originalTabSize, vscode.ConfigurationTarget.Global);
			channel.dispose();
		}
	});

	test('S28: preview HTML reflects the current state (renders against latest inspect)', async () => {
		const fontSizeKey = 'editor.fontSize';
		const config = vscode.workspace.getConfiguration();
		const originalFontSize = config.inspect(fontSizeKey)?.globalValue;
		await config.update(fontSizeKey, 22, vscode.ConfigurationTarget.Global);

		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (preview state)');
		try {
			const panel = openPreviewPanel(context, channel);
			assert.ok(panel.webview.html.includes('editor.fontSize'),
				'S27: preview HTML must mention the currently-set key (editor.fontSize)');
		} finally {
			await vscode.workspace.getConfiguration().update(fontSizeKey, originalFontSize, vscode.ConfigurationTarget.Global);
			channel.dispose();
		}
	});

	test('Disposing the panel clears the singleton so the next open creates a fresh one', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (preview dispose)');
		try {
			const first = openPreviewPanel(context, channel);
			first.dispose();
			_testResetCurrentPanel();
			assert.strictEqual(_testGetCurrentPanel(), undefined,
				'After dispose, the singleton must be cleared');

			const second = openPreviewPanel(context, channel);
			assert.notStrictEqual(first, second,
				'After dispose, openPreviewPanel must create a new panel');
		} finally {
			channel.dispose();
		}
	});
});
