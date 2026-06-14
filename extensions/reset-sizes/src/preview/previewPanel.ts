/**
 * Preview webview panel manager (Slice 4).
 *
 * Owns the single `WebviewPanel` instance for the Reset Sizes preview view.
 * The panel:
 *
 *  - Is created on first invocation of `resetSizes.openPreview`, revealed on
 *    subsequent invocations (no duplicate panels).
 *  - Renders a fresh matrix from the current editor state every time it
 *    becomes visible or when relevant configuration changes (so the user
 *    never sees stale data).
 *  - Forwards `run-reset` messages to `handlePreviewMessage`, which calls
 *    the same `runReset(mode, scope, channel)` the Command Palette would —
 *    no per-cell shortcut path (ADR 0005, S29).
 *  - Performs **zero writes** when opening, refreshing, or closing
 *    (S28 — verified by snapshot tests).
 *
 * The panel is disposed by VS Code when the user closes it; the disposable
 * listeners we attach are cleaned up via `panel.onDidDispose`.
 */
import * as vscode from 'vscode';
import { computePreviewMatrix } from './computePreviewMatrix';
import { handlePreviewMessage } from './previewMessage';
import { renderPreviewHtml } from './previewHtml';
import { inspectViaConfig } from '../commands/resetAllSizes';

/**
 * Title shown in the webview tab. Kept consistent across activations so
 * "reveal-existing" works (we look up by reference, not by title, but the
 * title is also a user-facing constant).
 */
export const PREVIEW_PANEL_TITLE = 'Reset Sizes — Preview';

/**
 * View type for the webview (VS Code's internal identifier for the panel
 * type). Used by `createWebviewPanel`.
 */
export const PREVIEW_VIEW_TYPE = 'resetSizes.preview';

let currentPanel: vscode.WebviewPanel | undefined;

/**
 * Open (or reveal) the preview view. Idempotent: a second call brings the
 * existing panel back into focus rather than spawning a duplicate.
 *
 * The output channel is passed through so the "Run reset" button can append
 * to the same activity log surface as a Command Palette invocation.
 */
export function openPreviewPanel(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): vscode.WebviewPanel {
	if (currentPanel) {
		// Already open — bring it forward. No re-render here; the
		// `onDidChangeViewState` listener below handles refresh on visibility.
		currentPanel.reveal(vscode.ViewColumn.Active, false);
		return currentPanel;
	}

	const panel = vscode.window.createWebviewPanel(
		PREVIEW_VIEW_TYPE,
		PREVIEW_PANEL_TITLE,
		vscode.ViewColumn.Active,
		{
			// Inline scripts (the button → message channel) require scripts on.
			enableScripts: true,
			// Don't keep the webview alive in the background. Re-rendering on
			// becoming visible is cheap and means the matrix is always fresh
			// against current state.
			retainContextWhenHidden: false
		}
	);

	currentPanel = panel;

	// Initial render against current state.
	refreshPreview(panel);

	// Re-render when the webview becomes visible again (back from background).
	const visibilityDisposable = panel.onDidChangeViewState(state => {
		if (state.webviewPanel.visible) {
			refreshPreview(state.webviewPanel);
		}
	});

	// Re-render when relevant configuration changes — keeps the matrix from
	// going stale if the user edits settings.json in another tab. Scoped to
	// the configuration change events so we don't refresh on unrelated
	// signals.
	const configDisposable = vscode.workspace.onDidChangeConfiguration(event => {
		// Cheap heuristic: if anything in the resetSizes namespace OR anything
		// the user might have changed could affect the matrix, refresh. Webview
		// re-render is bounded (curated list + folder count) so we don't need
		// a finer-grained filter.
		if (event.affectsConfiguration('resetSizes') || event.affectsConfiguration('editor')
			|| event.affectsConfiguration('terminal') || event.affectsConfiguration('window')
			|| event.affectsConfiguration('notebook') || event.affectsConfiguration('debug')
			|| event.affectsConfiguration('markdown') || event.affectsConfiguration('scm')
			|| event.affectsConfiguration('chat')) {
			refreshPreview(panel);
		}
	});

	// Re-render when the workspace folders change (e.g. a folder is added or
	// removed) so the WorkspaceFolder rows are accurate.
	const foldersDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
		refreshPreview(panel);
	});

	panel.webview.onDidReceiveMessage(async message => {
		await handlePreviewMessage(message, outputChannel);
	}, undefined, context.subscriptions);

	panel.onDidDispose(() => {
		visibilityDisposable.dispose();
		configDisposable.dispose();
		foldersDisposable.dispose();
		if (currentPanel === panel) {
			currentPanel = undefined;
		}
	}, undefined, context.subscriptions);

	return panel;
}

/**
 * For tests that need a deterministic "is the panel registered as singleton?"
 * answer. Production code never reads this — it's purely a test seam.
 */
export function _testGetCurrentPanel(): vscode.WebviewPanel | undefined {
	return currentPanel;
}

/**
 * Hard reset hook used by tests to recover from a panel that was forcibly
 * disposed outside the normal lifecycle. Not meant for production use.
 */
export function _testResetCurrentPanel(): void {
	currentPanel = undefined;
}

/**
 * Re-render the preview against the current editor state. Pure with respect
 * to settings, memento, and zoom: the only output is HTML written into the
 * webview's `html` property.
 */
function refreshPreview(panel: vscode.WebviewPanel): void {
	const rootConfig = vscode.workspace.getConfiguration();
	const folders = vscode.workspace.workspaceFolders ?? [];
	const matrix = computePreviewMatrix(
		rootConfig,
		inspectViaConfig,
		folders,
		vscode.env.remoteName
	);
	const nonce = generateNonce();
	panel.webview.html = renderPreviewHtml(matrix, panel.webview.cspSource, nonce);
}

/**
 * Generate a CSP nonce. The value must be unique per page render so a script
 * with a stale nonce cannot be replayed; we use a 32-char hex string.
 *
 * Math.random is fine here — the nonce is a freshness guard for our own
 * inline script, not a security token against an adversary.
 */
function generateNonce(): string {
	let s = '';
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i += 1) {
		s += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return s;
}
