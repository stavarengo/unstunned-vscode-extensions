import * as vscode from 'vscode';
import {
	CommandStepResult,
	ReloadOutcome,
	ResetInvocationRecord,
	ResetMode,
	ResetScope,
	SettingChange
} from '../types';
import {
	buildConfirmationMessage,
	CURATED_SIZE_KEYS,
	discoverCandidateKeys,
	executeVSCodeCommand,
	formatInvocationLog,
	getExtensionConfig,
	InspectFn,
	labelForScope,
	MODE_OPTIONS,
	planCascade,
	requiresReload,
	SCOPE_OPTIONS,
	SettingClearStep,
	summariseInvocation,
	updateSettingTarget,
	ZOOM_RESET_COMMANDS
} from '../utils';

/**
 * Choice made by the user (or test/preview surrogate) on the post-reset reload
 * prompt (Slice 3, S16–S19):
 *
 * - `'defer'`: "Don't reload now" — leave the window as-is, remember nothing.
 *   `undefined` from `showInformationMessage` (dismissed) also maps to this.
 * - `'reload'`: "Reload now" — reload immediately, remember nothing.
 * - `'reload-silent'`: "Reload and don't ask again" — reload now AND persist
 *   the silent-reload preference (S19).
 */
export type ReloadPromptChoice = 'defer' | 'reload' | 'reload-silent';

/**
 * Hook for tests (and Slice 4's preview surface) to substitute their own
 * confirmer / reload prompter / reloader in place of the production defaults.
 *
 * The default confirmer presents a modal `showInformationMessage` that names
 * every key and rung in the plan and returns `true` only when the user picks
 * the "Reset" affirmative button.
 *
 * The default `reloadPrompter` shows an information notification with the
 * three labelled options from S16. Tests inject a stub so the prompt branch
 * is observable without driving the real notification.
 *
 * The default `reloader` executes `workbench.action.reloadWindow`. Tests MUST
 * inject a no-op stub — invoking the real reloader would kill the test host.
 */
export interface RunResetOptions {
	confirmer?: (plan: SettingClearStep[], scope: ResetScope) => Promise<boolean>;
	reloadPrompter?: (reloadRequiringChanges: SettingChange[]) => Promise<ReloadPromptChoice>;
	reloader?: () => Promise<void>;
}

/**
 * Orchestrate one reset invocation against a pre-chosen (mode, scope) pair.
 *
 * The picker UI is intentionally a separate function so this orchestrator can
 * be exercised directly from automated tests without driving the QuickPick.
 *
 * Slice 2 wires the settings-clearing path for `fontSize` and the combined
 * `zoomAndFontSize`. Mode `zoom` behaves as in Slice 1 (no settings touched).
 */
export async function runReset(
	mode: ResetMode,
	scope: ResetScope,
	outputChannel: vscode.OutputChannel,
	options: RunResetOptions = {}
): Promise<ResetInvocationRecord> {
	const record: ResetInvocationRecord = {
		timestamp: new Date(),
		mode,
		scope,
		keysConsidered: [],
		keysChanged: [],
		commands: [],
		failures: [],
		reloadOutcome: 'not-required'
	};

	const wantsZoom = mode === 'zoom' || mode === 'zoomAndFontSize';
	const wantsSettings = mode === 'fontSize' || mode === 'zoomAndFontSize';

	// Discovery (settings modes only).
	//
	// "Considered" per the Contract invariant = curated list ∪ suffix-matched
	// keys present in the user's configuration at the *targeted* scopes. The
	// search universe is curated + every suffix-matched key found anywhere in
	// the resolved configuration tree. From that universe we plan the writes;
	// the plan tells us which keys actually had a user value at a rung the
	// cascade reaches. `keysConsidered` is curated + (suffix-matched keys
	// that landed in the plan).
	let plan: SettingClearStep[] = [];
	if (wantsSettings) {
		const rootConfig = vscode.workspace.getConfiguration();
		const candidates = discoverCandidateKeys(rootConfig);
		plan = planCascade(scope, candidates, inspectViaConfig, vscode.workspace.workspaceFolders ?? []);

		const curated = new Set<string>(CURATED_SIZE_KEYS);
		const presentSuffixMatched = new Set(plan.map(s => s.key).filter(k => !curated.has(k)));
		// Curated keys are always considered (predictability); suffix-matched
		// keys are considered only when they were actually present at one of
		// the targeted rungs.
		record.keysConsidered = [
			...CURATED_SIZE_KEYS,
			...[...presentSuffixMatched].sort()
		];
	}

	// Confirmation gate: only when there is something destructive about to
	// happen AND the preference is on. Pure Session resets and empty plans
	// never confirm (per Brief invariant and Slice 2 scope).
	const config = getExtensionConfig();
	const needsConfirmation =
		config.confirmBeforeDestructiveReset &&
		(scope === 'workspace' || scope === 'global') &&
		plan.length > 0;

	if (needsConfirmation) {
		const confirmer = options.confirmer ?? defaultConfirmer;
		const accepted = await confirmer(plan, scope);
		if (!accepted) {
			// User declined. Record the cancellation and exit — no zoom, no
			// settings clear, no reload prompt (no reload prompt is Slice 3
			// territory; we just don't write).
			record.failures.push('Cancelled at confirmation');
			appendActivityLog(outputChannel, record);
			void showSummaryIfEnabled(record, outputChannel);
			return record;
		}
	}

	// Apply zoom (Zoom only and Zoom and font size).
	if (wantsZoom) {
		record.commands = await runZoomReset();
	}

	// Apply settings cascade (Font size only and Zoom and font size). Each
	// step is wrapped so a single rejection does not abort the run (S23).
	if (wantsSettings && plan.length > 0) {
		const changes: SettingChange[] = [];
		for (const step of plan) {
			changes.push(await updateSettingTarget(step.key, step.target, step.folderUri));
		}
		record.keysChanged = changes;
	}

	// Reload flow (Slice 3, S16–S22). Sits after the writes (so we can compute
	// the actually-changed reload-requiring keys) but before the activity log
	// is appended (so the log records the final reload outcome) and before the
	// summary notification fires (so the summary can report "Window reloaded"
	// when one occurred — S21).
	//
	// We only consider successful changes — a failed clear of window.zoomLevel
	// did not change the value and so cannot require a reload.
	const reloadRequiringChanges = record.keysChanged.filter(
		c => c.success && requiresReload(c.key)
	);
	record.reloadOutcome = await handleReloadFlow(
		reloadRequiringChanges,
		options
	);

	appendActivityLog(outputChannel, record);

	// Fire the summary notification without awaiting the user's button choice
	// so callers (and tests) can complete promptly. The "View log" action is
	// still wired — see showSummaryIfEnabled.
	void showSummaryIfEnabled(record, outputChannel);

	return record;
}

/**
 * Decide the reload outcome for an invocation. Returns the outcome to record
 * on `ResetInvocationRecord.reloadOutcome`; performs the reload itself when
 * appropriate via the injected `reloader`.
 *
 * The three exit branches:
 *  - `'not-required'`: no key requiring a reload was successfully changed.
 *    Never prompt, never reload.
 *  - `'reloaded'`: the user (or silent-reload preference) asked to reload, and
 *    the reloader was invoked.
 *  - `'prompted-deferred'`: the user was prompted and picked "Don't reload now"
 *    (or dismissed the prompt); window stays as-is.
 *
 * S22 is satisfied by construction: when `reloadRequiringChanges` is empty —
 * which is always the case for Zoom-only mode and for any mode that didn't
 * clear a reload-required key — we take the `'not-required'` branch
 * regardless of the silent-reload preference.
 */
async function handleReloadFlow(
	reloadRequiringChanges: SettingChange[],
	options: RunResetOptions
): Promise<ReloadOutcome> {
	if (reloadRequiringChanges.length === 0) {
		return 'not-required';
	}

	const config = getExtensionConfig();
	const reloader = options.reloader ?? defaultReloader;

	if (config.reloadSilently) {
		// S21: silent-reload on AND a reload is needed → reload immediately.
		await reloader();
		return 'reloaded';
	}

	const prompter = options.reloadPrompter ?? defaultReloadPrompter;
	const choice = await prompter(reloadRequiringChanges);

	if (choice === 'reload') {
		// S18: reload immediately, remember nothing.
		await reloader();
		return 'reloaded';
	}

	if (choice === 'reload-silent') {
		// S19: reload immediately AND persist the silent-reload preference at
		// Global scope so it survives across workspaces / sessions.
		await persistReloadSilentlyPreference();
		await reloader();
		return 'reloaded';
	}

	// 'defer' (or any future fallback): S17 — leave the window alone, persist
	// nothing, and let the same prompt re-appear next time.
	return 'prompted-deferred';
}

/**
 * The three options the reload prompt offers (S16). The order matches the
 * order shown in the notification — VS Code renders the first argument as
 * the rightmost button.
 *
 * Exported as a constant so tests can assert the surface is exactly three
 * options and the exact wording, mirroring the `MODE_OPTIONS` / `SCOPE_OPTIONS`
 * source-level invariant pattern from Slice 1.
 */
export const RELOAD_PROMPT_OPTIONS = Object.freeze({
	reloadNow: 'Reload now',
	defer: "Don't reload now",
	reloadSilent: "Reload and don't ask again"
} as const);

/** All three reload-prompt button labels in display order, for tests. */
export const RELOAD_PROMPT_BUTTON_LABELS: readonly string[] = Object.freeze([
	RELOAD_PROMPT_OPTIONS.reloadNow,
	RELOAD_PROMPT_OPTIONS.defer,
	RELOAD_PROMPT_OPTIONS.reloadSilent
]);

/**
 * Default reload prompter. Shows a non-modal information notification with
 * exactly the three options from S16; dismissing the notification (no choice)
 * maps to `'defer'` per the brief's "no forced reload" guarantee.
 *
 * The list of reload-requiring changes is named in the prompt body so the
 * user understands what is making the reload necessary (S16).
 */
async function defaultReloadPrompter(
	reloadRequiringChanges: SettingChange[]
): Promise<ReloadPromptChoice> {
	const keys = Array.from(
		new Set(reloadRequiringChanges.map(c => c.key))
	).sort();
	// Some non-modal notification surfaces collapse `\n` in the rendered text,
	// so we lay the keys out inline with bullets and two-space gaps instead of
	// line breaks. This keeps the keys legible whether the notification wraps
	// or not.
	const list = keys.map(k => `• ${k}`).join('  ');
	const message = `Reset Sizes cleared settings that only take effect after a window reload: ${list}`;
	const choice = await vscode.window.showInformationMessage(
		message,
		...RELOAD_PROMPT_BUTTON_LABELS
	);
	if (choice === RELOAD_PROMPT_OPTIONS.reloadNow) {
		return 'reload';
	}
	if (choice === RELOAD_PROMPT_OPTIONS.reloadSilent) {
		return 'reload-silent';
	}
	// Dismissed, "Don't reload now", or any unexpected value all behave as
	// defer — the user must never be reloaded against their will.
	return 'defer';
}

/**
 * Default reloader. Invokes VS Code's documented reload command. Tests MUST
 * inject a stub via `RunResetOptions.reloader` — running this in the test
 * host would tear the window down mid-test.
 *
 * Note: in production, the awaited promise never resolves because the window
 * tears down before the command completes. That's fine — no caller depends
 * on a resolution beyond this point.
 */
async function defaultReloader(): Promise<void> {
	await vscode.commands.executeCommand('workbench.action.reloadWindow');
}

/**
 * Persist the silent-reload preference (S19). Writes to `ConfigurationTarget.Global`
 * — the choice is per-user, not per-workspace.
 *
 * Failures are swallowed: if the write rejects (e.g. read-only profile), the
 * user gets reloaded but the prompt will come back next time. That's a better
 * failure mode than refusing to reload after the user explicitly asked.
 */
async function persistReloadSilentlyPreference(): Promise<void> {
	try {
		await vscode.workspace
			.getConfiguration('resetSizes')
			.update('reloadSilently', true, vscode.ConfigurationTarget.Global);
	} catch {
		// Intentionally ignored — see doc above.
	}
}

/**
 * Command Palette entry point. Walks the user through the mode picker, then
 * the scope picker, then delegates to `runReset`. Returns silently when the
 * user dismisses either picker so no activity-log entry is recorded for an
 * abandoned invocation.
 */
export async function promptAndRunReset(outputChannel: vscode.OutputChannel): Promise<void> {
	const mode = await pickMode();
	if (!mode) {
		return;
	}
	const scope = await pickScope();
	if (!scope) {
		return;
	}
	await runReset(mode, scope, outputChannel);
}

async function pickMode(): Promise<ResetMode | undefined> {
	const items = MODE_OPTIONS.map(opt => ({
		label: opt.label,
		description: opt.description,
		value: opt.value
	}));
	const choice = await vscode.window.showQuickPick(items, {
		title: 'Reset Sizes — Pick a mode',
		placeHolder: 'What should be reset?'
	});
	return choice?.value;
}

async function pickScope(): Promise<ResetScope | undefined> {
	const remoteName = vscode.env.remoteName;
	const items = SCOPE_OPTIONS.map(opt => ({
		label: labelForScope(opt.value, remoteName),
		description: opt.description,
		value: opt.value
	}));
	const choice = await vscode.window.showQuickPick(items, {
		title: 'Reset Sizes — Pick a scope',
		placeHolder: 'The broader the scope you pick, the more places get cleaned.'
	});
	return choice?.value;
}

async function runZoomReset(): Promise<CommandStepResult[]> {
	const results: CommandStepResult[] = [];
	for (const commandId of ZOOM_RESET_COMMANDS) {
		results.push(await executeVSCodeCommand(commandId));
	}
	return results;
}

/**
 * Read `WorkspaceConfiguration.inspect` for an arbitrary key, optionally
 * folder-scoped. Wraps both the `getConfiguration()` and `inspect()` calls so
 * a malformed key does not throw out of the cascade planner.
 *
 * Exported so Slice 4's preview matrix can share the exact same read path —
 * see `src/preview/computePreviewMatrix.ts`. Slice 4 must use the same
 * inspect seam that `runReset` uses; otherwise the preview and the action
 * could disagree about what would change.
 */
export const inspectViaConfig: InspectFn = (key, folderUri) => {
	try {
		const config = folderUri
			? vscode.workspace.getConfiguration(undefined, folderUri)
			: vscode.workspace.getConfiguration();
		return config.inspect(key) ?? undefined;
	} catch {
		return undefined;
	}
};

/**
 * Default modal confirmation. Names every key and rung in the plan; returns
 * true only when the user explicitly accepts. Cancelling, dismissing, or
 * any other interaction returns false.
 *
 * The message composition is delegated to `buildConfirmationMessage` so the
 * production text is unit-testable without driving the dialog.
 */
async function defaultConfirmer(plan: SettingClearStep[], scope: ResetScope): Promise<boolean> {
	const message = buildConfirmationMessage(plan, scope, vscode.env.remoteName);
	const accepted = 'Reset';
	const choice = await vscode.window.showInformationMessage(
		message,
		{ modal: true },
		accepted
	);
	return choice === accepted;
}

function appendActivityLog(channel: vscode.OutputChannel, record: ResetInvocationRecord): void {
	const block = formatInvocationLog(record);
	for (const line of block.split('\n')) {
		channel.appendLine(line);
	}
}

async function showSummaryIfEnabled(
	record: ResetInvocationRecord,
	outputChannel: vscode.OutputChannel
): Promise<void> {
	const config = getExtensionConfig();
	if (!config.showSummaryNotification) {
		return;
	}
	const message = summariseInvocation(record, { remoteName: vscode.env.remoteName });
	const viewLog = 'View log';
	const choice = await vscode.window.showInformationMessage(message, viewLog);
	if (choice === viewLog) {
		outputChannel.show(true);
	}
}
