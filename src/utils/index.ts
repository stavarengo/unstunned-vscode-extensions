import * as vscode from 'vscode';
import {
	CommandStepResult,
	ExtensionConfig,
	PickerOption,
	ResetInvocationRecord,
	ResetMode,
	ResetScope,
	SettingChange
} from '../types';

import { SettingClearStep } from './cascade';

export { CURATED_SIZE_KEYS, SIZE_KEY_SUFFIXES, EXTENSION_NAMESPACE_PREFIX, isSizeFamilyKey, flattenConfigKeys, discoverCandidateKeys } from './discovery';
export { planCascade, SettingClearStep, InspectResult, InspectFn } from './cascade';
export { RELOAD_REQUIRED_KEYS, requiresReload } from './reloadClassification';

/**
 * VS Code commands that reset the in-memory zoom state. Slice 1's Zoom-only
 * mode executes all three; later slices reuse this list when "zoom and font
 * size" combines the zoom path with settings clearing.
 */
export const ZOOM_RESET_COMMANDS: readonly string[] = [
	'workbench.action.zoomReset',
	'editor.action.fontZoomReset',
	'workbench.action.terminal.fontZoomReset'
];

/**
 * Mode picker options. Exposed as a constant so tests can assert the surface
 * is exactly three modes with no "Custom" option (S35).
 */
export const MODE_OPTIONS: readonly PickerOption<ResetMode>[] = [
	{
		value: 'zoom',
		label: 'Zoom only',
		description: 'Undo UI, editor, and terminal zoom without touching settings.'
	},
	{
		value: 'fontSize',
		label: 'Font size only',
		description: 'Clear size-family settings only.'
	},
	{
		value: 'zoomAndFontSize',
		label: 'Zoom and font size',
		description: 'Undo zoom and clear size-family settings.'
	}
];

/**
 * Scope picker options. Exactly three rungs, per ADR 0002. Copy uses
 * destructiveness vocabulary ("the broader you pick, the more places get
 * cleaned"), never precedence vocabulary.
 *
 * NB: the `label` is the static, scope-only name. The user-facing label that
 * adapts to a remote host (S15) is computed via `labelForScope` at display
 * time.
 */
export const SCOPE_OPTIONS: readonly PickerOption<ResetScope>[] = [
	{
		value: 'session',
		label: 'Session',
		description: 'In-memory state only. Nothing on disk is touched.'
	},
	{
		value: 'workspace',
		label: 'Workspace',
		description: 'Also clean this workspace, including every folder override.'
	},
	{
		value: 'global',
		label: 'Global',
		description: 'Also clean your global user settings. The broadest scope.'
	}
];

/**
 * The user-facing label for a scope, adapted to a remote host when one is
 * connected (S15). The underlying write target never changes — there is one
 * `ConfigurationTarget.Global`; only the label differs.
 *
 * Pure function so tests can drive it without VS Code env mocking.
 */
export function labelForScope(scope: ResetScope, remoteName: string | undefined): string {
	switch (scope) {
		case 'session':
			return 'Session';
		case 'workspace':
			return 'Workspace';
		case 'global':
			return remoteName && remoteName.length > 0 ? 'User settings (remote)' : 'Global';
	}
}

/**
 * Read the extension's runtime preferences.
 */
export function getExtensionConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration('resetSizes');
	return {
		confirmBeforeDestructiveReset: config.get<boolean>('confirmBeforeDestructiveReset', true),
		showSummaryNotification: config.get<boolean>('showSummaryNotification', true),
		reloadSilently: config.get<boolean>('reloadSilently', false)
	};
}

/**
 * Execute a VS Code command and capture failure as data, never as a thrown
 * exception. Used so a single failing sub-step (e.g. no terminal open) cannot
 * abort the rest of the reset (S23, Slice 2+).
 */
export async function executeVSCodeCommand(commandId: string): Promise<CommandStepResult> {
	try {
		await vscode.commands.executeCommand(commandId);
		return { id: commandId, success: true };
	} catch (error) {
		return {
			id: commandId,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Clear `key` at the given `ConfigurationTarget` by writing `undefined` via
 * `WorkspaceConfiguration.update`. Failures are captured as data on the
 * returned `SettingChange`; the function never throws (S23 partial-failure
 * tolerance, mirroring `executeVSCodeCommand`).
 *
 * `folderUri` is required for `WorkspaceFolder` clears and ignored otherwise.
 */
export async function updateSettingTarget(
	key: string,
	target: vscode.ConfigurationTarget,
	folderUri?: vscode.Uri
): Promise<SettingChange> {
	try {
		const config = target === vscode.ConfigurationTarget.WorkspaceFolder && folderUri
			? vscode.workspace.getConfiguration(undefined, folderUri)
			: vscode.workspace.getConfiguration();
		await config.update(key, undefined, target);
		return { key, target, success: true };
	} catch (error) {
		return {
			key,
			target,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Format an invocation record as a human-readable activity-log block. The
 * formatter is pure so tests can assert that every required field appears.
 *
 * The log uses the API target names ("Global", "Workspace", "WorkspaceFolder")
 * verbatim; the user-facing remote label is reserved for the summary
 * notification and confirmation dialog. The log is the diagnostic surface —
 * users diffing runs should see the underlying targets, not a UX label.
 */
export function formatInvocationLog(record: ResetInvocationRecord): string {
	const lines: string[] = [];
	lines.push('--------');
	lines.push(`[${record.timestamp.toISOString()}] Reset Sizes invoked`);
	lines.push(`  Mode: ${describeMode(record.mode)}`);
	lines.push(`  Scope: ${describeScope(record.scope)}`);

	if (record.keysConsidered.length === 0) {
		lines.push('  Keys considered: (none)');
	} else {
		lines.push(`  Keys considered (${record.keysConsidered.length}):`);
		for (const key of record.keysConsidered) {
			lines.push(`    - ${key}`);
		}
	}

	if (record.keysChanged.length === 0) {
		lines.push('  Keys changed: (none)');
	} else {
		lines.push(`  Keys changed (${record.keysChanged.length}):`);
		for (const change of record.keysChanged) {
			const status = change.success ? 'ok' : `failed: ${change.error ?? 'unknown error'}`;
			lines.push(`    - ${change.key} [${describeTarget(change.target)}] ${status}`);
		}
	}

	if (record.commands.length === 0) {
		lines.push('  Commands executed: (none)');
	} else {
		lines.push(`  Commands executed (${record.commands.length}):`);
		for (const step of record.commands) {
			const status = step.success ? 'ok' : `failed: ${step.error ?? 'unknown error'}`;
			lines.push(`    - ${step.id} ${status}`);
		}
	}

	if (record.failures.length > 0) {
		lines.push(`  Failures (${record.failures.length}):`);
		for (const failure of record.failures) {
			lines.push(`    - ${failure}`);
		}
	}

	lines.push(`  Reload: ${describeReloadOutcome(record.reloadOutcome)}`);

	return lines.join('\n');
}

function describeReloadOutcome(outcome: ResetInvocationRecord['reloadOutcome']): string {
	switch (outcome) {
		case 'not-required':
			return 'not required';
		case 'prompted-deferred':
			return 'prompted — user deferred';
		case 'reloaded':
			return 'window reloaded';
	}
}

/**
 * Optional context for `summariseInvocation` — the remote name in particular
 * shifts the Global heading to "User settings (remote)" (S15).
 */
export interface SummariseContext {
	/** From `vscode.env.remoteName`. Undefined or empty means local. */
	remoteName?: string;
}

/**
 * Build the dismissable text shown in the summary notification. Names what
 * was changed (or "Nothing changed.") so the user is never left guessing
 * (S24 and contract invariant: the user must never have to diff settings.json
 * to find out what happened).
 *
 * Setting changes are grouped under a single heading per scope label.
 * `WorkspaceFolder` clears are folded into the "Workspace" heading so the
 * three-rung UX is preserved (S6, S7). The Global heading adapts to the
 * remote name (S15).
 */
export function summariseInvocation(
	record: ResetInvocationRecord,
	context: SummariseContext = {}
): string {
	const successfulCommands = record.commands.filter(c => c.success);
	const failedCommands = record.commands.filter(c => !c.success);
	const successfulKeys = record.keysChanged.filter(c => c.success);
	const failedKeys = record.keysChanged.filter(c => !c.success);

	const parts: string[] = [];

	if (successfulCommands.length > 0) {
		parts.push(`Zoom reset (${successfulCommands.length} step${successfulCommands.length === 1 ? '' : 's'})`);
	}

	if (successfulKeys.length > 0) {
		parts.push(formatKeysByScope(successfulKeys, context.remoteName));
	}

	const failureCount = failedCommands.length + failedKeys.length;
	if (failureCount > 0) {
		parts.push(`Failed: ${failureCount} step${failureCount === 1 ? '' : 's'}`);
	}

	// S21: when the reload flow reloaded the window (silently or after the
	// user picked "Reload now" / "Reload and don't ask again"), the summary
	// must say so. We add the reload note even when `parts` is empty so a
	// degenerate "reloaded with no other changes" run is still informative.
	if (record.reloadOutcome === 'reloaded') {
		parts.push('Window reloaded');
	}

	if (parts.length === 0) {
		return 'Reset Sizes: Nothing changed.';
	}

	return `Reset Sizes: ${parts.join('. ')}.`;
}

/**
 * Group cleared keys by the user-facing scope label (Workspace folds in
 * WorkspaceFolder, Global adapts to remote). The output looks like:
 *   "Workspace: editor.fontSize, terminal.integrated.fontSize"
 *   "Global: editor.fontSize"
 *
 * Long key lists are truncated with "+N more" so the notification stays
 * readable; the full list is always in the activity log.
 */
function formatKeysByScope(changes: SettingChange[], remoteName?: string): string {
	const byBucket = new Map<string, Set<string>>();
	for (const change of changes) {
		const bucket = bucketLabelForTarget(change.target, remoteName);
		if (!byBucket.has(bucket)) {
			byBucket.set(bucket, new Set<string>());
		}
		byBucket.get(bucket)!.add(change.key);
	}

	const segments: string[] = [];
	// Order: Workspace, then Global (matches "broader scope shown after").
	const orderedBuckets = ['Workspace', 'Global', 'User settings (remote)'];
	const bucketsInOrder = orderedBuckets.filter(b => byBucket.has(b));
	// Any bucket not in the canonical order list (defensive — shouldn't happen).
	for (const bucket of byBucket.keys()) {
		if (!orderedBuckets.includes(bucket)) {
			bucketsInOrder.push(bucket);
		}
	}

	const KEY_LIMIT = 3;
	for (const bucket of bucketsInOrder) {
		const keys = [...byBucket.get(bucket)!].sort();
		const shown = keys.slice(0, KEY_LIMIT);
		const overflow = keys.length - shown.length;
		const list = overflow > 0
			? `${shown.join(', ')} +${overflow} more`
			: shown.join(', ');
		segments.push(`${bucket}: ${list}`);
	}
	return `Cleared ${segments.join('; ')}`;
}

/**
 * User-facing bucket label for a configuration target. Both Workspace and
 * WorkspaceFolder fold into "Workspace" (S6, S7); Global adapts to the remote
 * name (S15). Exported so the confirmation dialog and summary share a single
 * source of truth.
 */
export function bucketLabelForTarget(
	target: vscode.ConfigurationTarget,
	remoteName?: string
): string {
	switch (target) {
		case vscode.ConfigurationTarget.Workspace:
		case vscode.ConfigurationTarget.WorkspaceFolder:
			return 'Workspace';
		case vscode.ConfigurationTarget.Global:
			return remoteName && remoteName.length > 0 ? 'User settings (remote)' : 'Global';
		default:
			return String(target);
	}
}

/**
 * Compose the user-facing message shown in the modal confirmation dialog. The
 * message lists the keys grouped by bucket label (Workspace folds in folder
 * overrides; Global adapts to the remote name) so the user sees exactly what
 * is about to be cleared (S3).
 *
 * Pure function so the message can be asserted in tests without driving the
 * modal dialog.
 */
export function buildConfirmationMessage(
	plan: readonly SettingClearStep[],
	scope: ResetScope,
	remoteName: string | undefined
): string {
	const byBucket = new Map<string, Set<string>>();
	for (const step of plan) {
		const bucket = bucketLabelForTarget(step.target, remoteName);
		if (!byBucket.has(bucket)) {
			byBucket.set(bucket, new Set<string>());
		}
		byBucket.get(bucket)!.add(step.key);
	}

	const headerScope = labelForScope(scope, remoteName);
	const lines: string[] = [];
	lines.push(`Reset Sizes will clear ${plan.length} setting${plan.length === 1 ? '' : 's'} at scope: ${headerScope}.`);
	lines.push('');
	for (const [bucket, keys] of byBucket) {
		const sortedKeys = [...keys].sort();
		lines.push(`${bucket}:`);
		for (const key of sortedKeys) {
			lines.push(`  • ${key}`);
		}
	}
	lines.push('');
	lines.push('This cannot be undone. Reset means "back to built-in defaults".');
	return lines.join('\n');
}

function describeMode(mode: ResetMode): string {
	const found = MODE_OPTIONS.find(opt => opt.value === mode);
	return found ? found.label : mode;
}

function describeScope(scope: ResetScope): string {
	const found = SCOPE_OPTIONS.find(opt => opt.value === scope);
	return found ? found.label : scope;
}

function describeTarget(target: vscode.ConfigurationTarget): string {
	switch (target) {
		case vscode.ConfigurationTarget.Global:
			return 'Global';
		case vscode.ConfigurationTarget.Workspace:
			return 'Workspace';
		case vscode.ConfigurationTarget.WorkspaceFolder:
			return 'WorkspaceFolder';
		default:
			return String(target);
	}
}
