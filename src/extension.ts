import * as vscode from 'vscode';
import { promptAndRunReset } from './commands/resetAllSizes';
import { openPreviewPanel } from './preview/previewPanel';
import { registerActivityBarView } from './preview/activityBarView';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
	// The activity log lives in this Output Channel. Slice 1 surfaces it
	// through three entry points (Command Palette, summary notification
	// action, settings-page markdown link) — we do NOT auto-show it on
	// every invocation, or those entry points would be redundant.
	outputChannel = vscode.window.createOutputChannel('Reset Sizes');
	context.subscriptions.push(outputChannel);

	context.subscriptions.push(
		vscode.commands.registerCommand('resetSizes.resetAll', async () => {
			try {
				await promptAndRunReset(outputChannel);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`Error: ${errorMessage}`);
				vscode.window.showErrorMessage(`Reset Sizes failed: ${errorMessage}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('resetSizes.openActivityLog', () => {
			outputChannel.show(true);
		})
	);

	// Slice 4: read-only preview view (S27). The panel manager handles
	// singleton-ness internally — second invocation reveals the existing
	// panel rather than spawning a duplicate.
	context.subscriptions.push(
		vscode.commands.registerCommand('resetSizes.openPreview', () => {
			openPreviewPanel(context, outputChannel);
		})
	);

	// Slice 5: Activity Bar icon entry point (S30, S31). The icon's
	// visibility is gated by `when: "config.resetSizes.showInActivityBar"`
	// directly in the manifest — the workbench evaluates this without
	// activating the extension, so a fresh install with no user config has
	// no icon (S30). Once the user enables the setting and clicks the
	// icon, the provider's `resolveWebviewView` opens the shared Preview
	// panel (S31). Registering the provider is cheap and does no work
	// until the sidebar slot becomes visible.
	registerActivityBarView(context, outputChannel);
}

export function deactivate(): void {
	// Output channel is automatically disposed via context.subscriptions.
}
