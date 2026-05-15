/**
 * Activity Bar view provider (Slice 5, S30, S31).
 *
 * The Activity Bar contribution is hidden by default. The user opts in via
 * `resetSizes.showInActivityBar`; visibility is gated by VS Code's workbench
 * directly through the `when: "config.resetSizes.showInActivityBar"` clause on
 * the view in `package.json`. We do not maintain our own context key — that
 * would require the extension to be active before the icon can appear (and our
 * activation events are all on-demand, by design, per the contract's "no
 * startup activation cost" invariant).
 *
 * When the user clicks the icon, VS Code reveals the sidebar view, which fires
 * `resolveWebviewView` on this provider. The provider's job is then to open
 * the existing Preview webview panel (Slice 4) — there is exactly one Preview
 * surface in the extension, shared between the Command Palette entry, the
 * settings-page link, and this Activity Bar entry. The sidebar itself shows a
 * small placeholder so the user knows where the action went.
 */
import * as vscode from 'vscode';
import { openPreviewPanel } from './previewPanel';

/**
 * View ID declared in `package.json` under
 * `contributes.views["resetSizes.activityBarContainer"]`. Used by
 * `vscode.window.registerWebviewViewProvider` and by the activation event
 * `onView:resetSizes.activityBarView`.
 */
export const ACTIVITY_BAR_VIEW_ID = 'resetSizes.activityBarView';

/**
 * The `WebviewViewProvider` that owns the sidebar slot under the Reset Sizes
 * Activity Bar icon. On first resolve (icon clicked, sidebar opened), it
 * opens the shared Preview panel via `openPreviewPanel` and renders a small
 * placeholder in the sidebar with a button that re-opens the panel if the
 * user has closed it.
 */
export class ResetSizesActivityBarViewProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_resolveContext: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void | Thenable<void> {
		webviewView.webview.options = {
			// We need an inline script for the "Open Preview" button to dispatch
			// its message back to the extension host.
			enableScripts: true
		};

		const nonce = generateNonce();
		webviewView.webview.html = renderPlaceholderHtml(
			webviewView.webview.cspSource,
			nonce
		);

		// On any message from the placeholder, open the shared Preview panel.
		// The single message type ('open-preview') is the only thing this view
		// owns; everything else is delegated.
		webviewView.webview.onDidReceiveMessage(
			message => {
				if (message && message.type === 'open-preview') {
					openPreviewPanel(this.context, this.outputChannel);
				}
			},
			undefined,
			this.context.subscriptions
		);

		// S31: clicking the Activity Bar icon should open the Preview. The icon
		// click reveals the sidebar, which calls `resolveWebviewView`. Opening
		// the panel here means the first click does the right thing without
		// requiring the user to click the placeholder button first.
		openPreviewPanel(this.context, this.outputChannel);
	}
}

/**
 * Register the activity-bar view provider with VS Code. The registration
 * itself is cheap; the provider's `resolveWebviewView` is only called when the
 * sidebar slot actually becomes visible (i.e. when the user clicks the icon
 * or the workbench restores a previously-open sidebar).
 *
 * The provider's lifecycle is owned by `context.subscriptions`.
 */
export function registerActivityBarView(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): vscode.Disposable {
	const provider = new ResetSizesActivityBarViewProvider(context, outputChannel);
	const disposable = vscode.window.registerWebviewViewProvider(
		ACTIVITY_BAR_VIEW_ID,
		provider,
		{
			// The sidebar webview is cheap to re-render (it's a static placeholder).
			// Letting it dispose when hidden keeps memory bounded.
			webviewOptions: { retainContextWhenHidden: false }
		}
	);
	context.subscriptions.push(disposable);
	return disposable;
}

/**
 * Placeholder HTML shown in the Activity Bar sidebar slot. Explains what the
 * icon does and offers a button to re-open the Preview panel if the user has
 * closed it. Pure function for testability — same shape as `renderPreviewHtml`.
 */
export function renderPlaceholderHtml(cspSource: string, nonce: string): string {
	const inlineScript = `
		const vscode = acquireVsCodeApi();
		document.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}
			if (target.dataset.command !== 'open-preview') {
				return;
			}
			vscode.postMessage({ type: 'open-preview' });
		});
	`.trim();

	const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>Reset Sizes</title>
	<style>
		body {
			font-family: var(--vscode-font-family, sans-serif);
			color: var(--vscode-foreground);
			background: var(--vscode-sideBar-background, transparent);
			padding: 12px;
			margin: 0;
		}
		p {
			margin: 0 0 12px 0;
			color: var(--vscode-descriptionForeground);
			font-size: 0.9em;
			line-height: 1.4;
		}
		button.open-preview {
			width: 100%;
			padding: 6px 12px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: 1px solid var(--vscode-button-border, transparent);
			border-radius: 2px;
			cursor: pointer;
			font-family: inherit;
		}
		button.open-preview:hover {
			background: var(--vscode-button-hoverBackground);
		}
	</style>
</head>
<body>
	<p>The Reset Sizes preview shows what each (mode, scope) combination would change against your current editor state. The preview is read-only.</p>
	<button class="open-preview" data-command="open-preview">Open Preview</button>
	<script nonce="${nonce}">${inlineScript}</script>
</body>
</html>`;
}

/**
 * 32-char alphanumeric nonce for the inline script's CSP allow-list. Same
 * approach as `previewPanel.ts` — a freshness guard for our own script, not
 * an adversary-grade token.
 */
function generateNonce(): string {
	let s = '';
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i += 1) {
		s += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return s;
}
