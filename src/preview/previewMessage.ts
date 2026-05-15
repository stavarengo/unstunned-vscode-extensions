/**
 * Preview view message protocol (Slice 4, S29).
 *
 * The webview posts messages back to the extension host whenever the user
 * clicks a "Run reset" button. The handler delegates straight to `runReset` —
 * not `promptAndRunReset` — so the (mode, scope) pair carried by the
 * message is preserved and the confirmation/reload flow inside `runReset`
 * still fires (ADR 0005: the preview never defines its own action path).
 *
 * The message protocol is extracted from the webview code so:
 *  - The S29 contract ("clicking a button is identical to Command Palette →
 *    same mode+scope") is unit-testable without puppeteering the webview.
 *  - Future message types (refresh, telemetry, etc.) have an obvious home.
 */
import * as vscode from 'vscode';
import { ResetMode, ResetScope } from '../types';
import { RunResetOptions, runReset } from '../commands/resetAllSizes';

/**
 * "Run reset" message sent by the webview when the user clicks a cell button.
 *
 * Tests construct these synthetically and feed them to `handlePreviewMessage`;
 * the production webview composes them in its inline script.
 */
export interface RunResetMessage {
	type: 'run-reset';
	mode: ResetMode;
	scope: ResetScope;
}

/** Union of all messages the preview webview can post (room to grow). */
export type PreviewMessage = RunResetMessage;

/**
 * Type guard: is `value` a valid `RunResetMessage`? Rejects messages with
 * unexpected mode/scope values so a misbehaving (or hostile) webview cannot
 * coerce `runReset` into running an unsupported combination.
 */
export function isRunResetMessage(value: unknown): value is RunResetMessage {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const msg = value as Record<string, unknown>;
	if (msg.type !== 'run-reset') {
		return false;
	}
	const validModes: ResetMode[] = ['zoom', 'fontSize', 'zoomAndFontSize'];
	const validScopes: ResetScope[] = ['session', 'workspace', 'global'];
	return (
		typeof msg.mode === 'string' &&
		(validModes as string[]).includes(msg.mode) &&
		typeof msg.scope === 'string' &&
		(validScopes as string[]).includes(msg.scope)
	);
}

/**
 * Route an incoming webview message. Unknown / malformed messages are dropped
 * silently — they can't have been legitimate, and surfacing an error in the
 * status bar for a webview hiccup would be annoying.
 *
 * For `run-reset`, the call is `runReset(mode, scope, channel)` exactly —
 * same arguments the Command Palette path uses (S29). The confirmation
 * dialog (Slice 2) and the reload flow (Slice 3) both live inside `runReset`,
 * so the preview gets them by going through the same door.
 *
 * The optional `runResetOptions` is reserved for tests that need to inject a
 * surrogate confirmer / reload prompter so the headless host doesn't have to
 * drive a real modal. Production never supplies them — the production webview
 * always wants the default modal dialog the Command Palette would show.
 */
export async function handlePreviewMessage(
	message: unknown,
	outputChannel: vscode.OutputChannel,
	runResetOptions: RunResetOptions = {}
): Promise<void> {
	if (!isRunResetMessage(message)) {
		return;
	}
	await runReset(message.mode, message.scope, outputChannel, runResetOptions);
}
