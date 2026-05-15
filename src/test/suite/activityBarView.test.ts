import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	ACTIVITY_BAR_VIEW_ID,
	ResetSizesActivityBarViewProvider,
	renderPlaceholderHtml
} from '../../preview/activityBarView';
import {
	_testGetCurrentPanel,
	_testResetCurrentPanel
} from '../../preview/previewPanel';

/**
 * Build a fake `WebviewView` that captures the `html` assigned to it and
 * records messages routed through `onDidReceiveMessage`. We do not drive
 * VS Code's real activity-bar view from tests — `resolveWebviewView` is
 * just a method on our provider class; calling it directly is the
 * behaviour-bearing path.
 */
function fakeWebviewView(): {
	view: vscode.WebviewView;
	getHtml: () => string;
	postMessage: (msg: unknown) => void;
} {
	let html = '';
	const messageHandlers: Array<(msg: unknown) => void> = [];

	const webview: vscode.Webview = {
		get options(): vscode.WebviewOptions { return {}; },
		set options(_: vscode.WebviewOptions) { /* no-op for the fake */ },
		get html(): string { return html; },
		set html(value: string) { html = value; },
		cspSource: 'vscode-webview://fake',
		onDidReceiveMessage: ((listener: (msg: unknown) => void) => {
			messageHandlers.push(listener);
			return { dispose: () => { /* no-op */ } };
		}) as vscode.Webview['onDidReceiveMessage'],
		postMessage: () => Promise.resolve(true),
		asWebviewUri: (u: vscode.Uri) => u,
	};

	const view: vscode.WebviewView = {
		viewType: ACTIVITY_BAR_VIEW_ID,
		webview,
		visible: true,
		onDidChangeVisibility: (() => ({ dispose: () => undefined })) as vscode.WebviewView['onDidChangeVisibility'],
		onDidDispose: (() => ({ dispose: () => undefined })) as vscode.WebviewView['onDidDispose'],
		show: (() => undefined) as vscode.WebviewView['show'],
		title: undefined,
		description: undefined,
		badge: undefined,
	} as unknown as vscode.WebviewView;

	return {
		view,
		getHtml: () => html,
		postMessage: (msg: unknown) => {
			for (const h of messageHandlers) {
				h(msg);
			}
		}
	};
}

function fakeContext(): vscode.ExtensionContext {
	const subs: { dispose: () => unknown }[] = [];
	return {
		subscriptions: subs,
	} as unknown as vscode.ExtensionContext;
}

suite('renderPlaceholderHtml — Slice 5 sidebar placeholder', () => {

	test('S31: produces an "Open Preview" button with data-command="open-preview"', () => {
		const html = renderPlaceholderHtml('vscode-webview://fake', 'nonce-abc');
		assert.ok(
			html.includes('data-command="open-preview"'),
			'S31: the placeholder must offer a button whose click dispatches an "open-preview" message'
		);
		assert.ok(
			html.includes('Open Preview'),
			'Button label must read "Open Preview"'
		);
	});

	test('Includes the CSP source and nonce so the inline script can run', () => {
		const html = renderPlaceholderHtml('vscode-webview://fake', 'nonce-xyz');
		assert.ok(
			html.includes("script-src 'nonce-nonce-xyz'"),
			'CSP must reference the supplied nonce'
		);
		assert.ok(
			html.includes("style-src vscode-webview://fake"),
			'CSP must include the supplied cspSource for styles'
		);
		assert.ok(
			html.includes('<script nonce="nonce-xyz">'),
			'Inline script tag must carry the matching nonce'
		);
	});

	test('Inline script posts an open-preview message on a matching click', () => {
		const html = renderPlaceholderHtml('vscode-webview://fake', 'nonce-z');
		// We assert the script source contains the message type and command
		// gate — same shape-check pattern as Slice 4's previewHtml tests.
		assert.ok(
			html.includes("'open-preview'"),
			'Inline script must use the open-preview message type'
		);
		assert.ok(
			html.includes("dataset.command !== 'open-preview'"),
			'Inline script must gate on the data-command attribute so unrelated clicks are ignored'
		);
	});

	test('Mentions that the Preview is read-only (sets user expectations)', () => {
		const html = renderPlaceholderHtml('vscode-webview://fake', 'nonce-a');
		assert.ok(
			html.toLowerCase().includes('read-only'),
			'Placeholder text must tell the user the Preview is read-only so the icon does not look like a destructive entry point'
		);
	});
});

suite('ResetSizesActivityBarViewProvider — resolveWebviewView opens the Preview panel (S31)', () => {

	// Silence the summary notification across the suite so resolving the view
	// (which opens the Preview panel) does not stack confirmation modals.
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

	test('ACTIVITY_BAR_VIEW_ID matches the manifest view id', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const views = extension.packageJSON?.contributes?.views?.['resetSizesActivityBar'] ?? [];
		const ours = views.find((v: { id: string }) => v.id === ACTIVITY_BAR_VIEW_ID);
		assert.ok(
			ours,
			'ACTIVITY_BAR_VIEW_ID constant must match the view id declared in package.json'
		);
	});

	test('S31: resolveWebviewView opens the shared Preview panel via openPreviewPanel', () => {
		assert.strictEqual(
			_testGetCurrentPanel(),
			undefined,
			'No panel should be open before the test starts'
		);

		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (activity bar)');
		try {
			const provider = new ResetSizesActivityBarViewProvider(context, channel);
			const { view } = fakeWebviewView();
			provider.resolveWebviewView(
				view,
				{} as vscode.WebviewViewResolveContext,
				{} as vscode.CancellationToken
			);
			assert.ok(
				_testGetCurrentPanel(),
				'S31: clicking the Activity Bar icon (resolving the view) must open the Preview panel'
			);
		} finally {
			channel.dispose();
		}
	});

	test('S31: clicking the "Open Preview" button in the placeholder also opens the panel', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (button)');
		try {
			const provider = new ResetSizesActivityBarViewProvider(context, channel);
			const { view, postMessage } = fakeWebviewView();
			provider.resolveWebviewView(
				view,
				{} as vscode.WebviewViewResolveContext,
				{} as vscode.CancellationToken
			);
			// Close the panel that was opened by resolve.
			const opened = _testGetCurrentPanel();
			assert.ok(opened);
			opened.dispose();
			_testResetCurrentPanel();

			// Simulate the user clicking the "Open Preview" button.
			postMessage({ type: 'open-preview' });
			assert.ok(
				_testGetCurrentPanel(),
				'S31: clicking the placeholder button must re-open the Preview panel'
			);
		} finally {
			channel.dispose();
		}
	});

	test('S31: a second resolveWebviewView reveals the same panel (no duplicate)', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (single panel)');
		try {
			const provider = new ResetSizesActivityBarViewProvider(context, channel);
			const { view: viewA } = fakeWebviewView();
			provider.resolveWebviewView(
				viewA,
				{} as vscode.WebviewViewResolveContext,
				{} as vscode.CancellationToken
			);
			const first = _testGetCurrentPanel();
			assert.ok(first);

			const { view: viewB } = fakeWebviewView();
			provider.resolveWebviewView(
				viewB,
				{} as vscode.WebviewViewResolveContext,
				{} as vscode.CancellationToken
			);
			const second = _testGetCurrentPanel();
			assert.strictEqual(
				second,
				first,
				'Activity Bar resolves must reuse the existing Preview panel singleton'
			);
		} finally {
			channel.dispose();
		}
	});

	test('Unknown messages from the placeholder are ignored', () => {
		const context = fakeContext();
		const channel = vscode.window.createOutputChannel('Test Reset Sizes (junk msg)');
		try {
			const provider = new ResetSizesActivityBarViewProvider(context, channel);
			const { view, postMessage } = fakeWebviewView();
			provider.resolveWebviewView(
				view,
				{} as vscode.WebviewViewResolveContext,
				{} as vscode.CancellationToken
			);
			const opened = _testGetCurrentPanel();
			assert.ok(opened);
			opened.dispose();
			_testResetCurrentPanel();

			// Garbage messages must not open a panel.
			postMessage({ type: 'something-else' });
			postMessage(undefined);
			postMessage(null);
			postMessage({});
			postMessage({ type: 'run-reset' });
			assert.strictEqual(
				_testGetCurrentPanel(),
				undefined,
				'Unknown messages must not trigger a Preview open'
			);
		} finally {
			channel.dispose();
		}
	});
});
