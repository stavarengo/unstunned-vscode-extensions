import * as vscode from 'vscode';

/**
 * Reset mode — what gets reset.
 * - 'zoom': in-memory zoom state only (UI, editor font, terminal font).
 * - 'fontSize': size-family settings only (not implemented in Slice 1).
 * - 'zoomAndFontSize': both of the above (not implemented in Slice 1).
 */
export type ResetMode = 'zoom' | 'fontSize' | 'zoomAndFontSize';

/**
 * Reset scope — how far the reset reaches.
 * The three rungs form a cascade: broader rungs include narrower ones.
 * - 'session': in-memory state only (no settings touched).
 * - 'workspace': workspace + folder overrides + session (Slice 2+).
 * - 'global': global + workspace + folder overrides + session (Slice 2+).
 */
export type ResetScope = 'session' | 'workspace' | 'global';

/**
 * Extension preferences read from VS Code's configuration.
 */
export interface ExtensionConfig {
	/** Show a modal confirmation before clearing persisted settings (Slice 2+). */
	confirmBeforeDestructiveReset: boolean;
	/** Show a summary notification after each reset invocation. */
	showSummaryNotification: boolean;
	/**
	 * When true, a reset whose changes require a window reload reloads
	 * immediately without prompting (Slice 3, S19/S21). Set by the user picking
	 * "Reload and don't ask again" on the post-reset prompt; reversible from
	 * the extension's settings page (S19).
	 */
	reloadSilently: boolean;
}

/**
 * One picker option in the mode or scope quick pick.
 * Exported so the option lists are inspectable from tests (S35).
 */
export interface PickerOption<T extends string> {
	value: T;
	label: string;
	description: string;
}

/**
 * Outcome of executing a single VS Code command during a reset.
 */
export interface CommandStepResult {
	/** Command ID that was executed. */
	id: string;
	/** Whether the command succeeded. */
	success: boolean;
	/** Error message captured when the command failed. */
	error?: string;
}

/**
 * Result of a setting clear operation. Slice 1 never produces these (Zoom-only
 * never touches settings), but the shape is reserved so Slice 2's expansion
 * does not break the activity-log contract.
 */
export interface SettingChange {
	/** Setting key (e.g. 'editor.fontSize'). */
	key: string;
	/** Configuration target where the change was applied. */
	target: vscode.ConfigurationTarget;
	/** Whether the change succeeded. */
	success: boolean;
	/** Error message captured when the update rejected. */
	error?: string;
}

/**
 * Outcome of the reload flow for a single invocation (Slice 3).
 *
 * - `'not-required'`: the reset produced no reload-requiring changes; no
 *   prompt was shown, no reload happened.
 * - `'prompted-deferred'`: the user was prompted and picked "Don't reload now",
 *   or dismissed the prompt; the window was not reloaded and no preference was
 *   persisted (S17).
 * - `'reloaded'`: the window was reloaded — either because the user picked
 *   "Reload now" / "Reload and don't ask again" on the prompt (S18, S19) or
 *   because silent-reload was on and the changes required it (S21).
 */
export type ReloadOutcome = 'not-required' | 'prompted-deferred' | 'reloaded';

/**
 * Full record of a reset invocation, appended to the activity log
 * and used to build the summary notification.
 */
export interface ResetInvocationRecord {
	/** When the reset was invoked. */
	timestamp: Date;
	/** Mode picked by the user. */
	mode: ResetMode;
	/** Scope picked by the user. */
	scope: ResetScope;
	/** Keys discovered as candidates for clearing. Empty for Zoom-only. */
	keysConsidered: string[];
	/** Keys actually cleared. Empty for Zoom-only. */
	keysChanged: SettingChange[];
	/** Commands invoked (zoom resets, etc.). */
	commands: CommandStepResult[];
	/** Top-level failures that were not tied to a single step. */
	failures: string[];
	/** Outcome of the reload-flow branch for this invocation (Slice 3). */
	reloadOutcome: ReloadOutcome;
}
