/**
 * Cascade planner (ADR 0002).
 *
 * Given a chosen scope and the set of considered keys, decide which writes to
 * perform against `WorkspaceConfiguration.update`. The planner is pure: it
 * returns a list of (key, target, folderUri?) steps without invoking VS Code.
 * The orchestrator wraps each step in `updateSettingTarget` so a single
 * rejected step does not abort the run (S23).
 *
 * The cascade is destructiveness-shaped, never precedence-shaped:
 *   - Session: clears no settings (in-memory only).
 *   - Workspace: clears Workspace + every WorkspaceFolder override.
 *   - Global: clears Global + Workspace + every WorkspaceFolder override.
 */

import * as vscode from 'vscode';
import { ResetScope } from '../types';

/**
 * One planned write. Targets are the documented `ConfigurationTarget` values;
 * `folderUri` is set only for `ConfigurationTarget.WorkspaceFolder` clears.
 */
export interface SettingClearStep {
	key: string;
	target: vscode.ConfigurationTarget;
	folderUri?: vscode.Uri;
}

/**
 * Shape returned by `WorkspaceConfiguration.inspect`. We declare a structural
 * type so the planner can be unit-tested with plain objects.
 */
export interface InspectResult {
	globalValue?: unknown;
	workspaceValue?: unknown;
	workspaceFolderValue?: unknown;
}

/**
 * Inject the read side as a callback so the planner is testable in isolation.
 * The folderUri argument is supplied when checking a folder-level value;
 * production code calls `vscode.workspace.getConfiguration(undefined, folder).inspect(key)`.
 */
export type InspectFn = (key: string, folderUri?: vscode.Uri) => InspectResult | undefined;

/**
 * Plan the writes required to clear `considered` keys at the cascade rungs
 * implied by `scope`.
 */
export function planCascade(
	scope: ResetScope,
	considered: readonly string[],
	inspect: InspectFn,
	folders: ReadonlyArray<{ uri: vscode.Uri }> = []
): SettingClearStep[] {
	if (scope === 'session') {
		// Session is in-memory only; the cascade does not touch settings.
		return [];
	}

	const steps: SettingClearStep[] = [];
	for (const key of considered) {
		// At Global, clear Global if a Global value is set.
		if (scope === 'global') {
			const top = inspect(key);
			if (top && top.globalValue !== undefined) {
				steps.push({ key, target: vscode.ConfigurationTarget.Global });
			}
		}

		// At Workspace and Global, clear Workspace if a workspace value is set.
		// The workspace value is the same regardless of folderUri, so we ask
		// for the non-folder inspect.
		const wsTop = inspect(key);
		if (wsTop && wsTop.workspaceValue !== undefined) {
			steps.push({ key, target: vscode.ConfigurationTarget.Workspace });
		}

		// At Workspace and Global, clear every folder override.
		for (const folder of folders) {
			const folderInspect = inspect(key, folder.uri);
			if (folderInspect && folderInspect.workspaceFolderValue !== undefined) {
				steps.push({
					key,
					target: vscode.ConfigurationTarget.WorkspaceFolder,
					folderUri: folder.uri
				});
			}
		}
	}
	return steps;
}
