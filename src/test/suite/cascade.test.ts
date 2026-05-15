import * as assert from 'assert';
import * as vscode from 'vscode';
import { planCascade, SettingClearStep } from '../../utils';

interface FakeInspect {
	globalValue?: unknown;
	workspaceValue?: unknown;
	workspaceFolderValue?: unknown;
}

function makeInspect(map: Record<string, FakeInspect | undefined>) {
	return (key: string, _folderUri?: vscode.Uri): FakeInspect | undefined => map[key];
}

function makeInspectByFolder(perFolder: Record<string, Record<string, FakeInspect | undefined>>) {
	return (key: string, folderUri?: vscode.Uri): FakeInspect | undefined => {
		const folderKey = folderUri ? folderUri.toString() : '__no_folder__';
		return perFolder[folderKey]?.[key];
	};
}

suite('planCascade (ADR 0002 cascade)', () => {

	suite('scope = global', () => {
		test('plans Global + Workspace + WorkspaceFolder clears for keys present at each rung', () => {
			const considered = ['editor.fontSize', 'window.zoomLevel'];
			const folder = vscode.Uri.parse('file:///folder1');
			const inspect = makeInspectByFolder({
				__no_folder__: {
					'editor.fontSize': { globalValue: 14, workspaceValue: 16 },
					'window.zoomLevel': { globalValue: 1 }
				},
				[folder.toString()]: {
					'editor.fontSize': { workspaceFolderValue: 18, workspaceValue: 16, globalValue: 14 },
					'window.zoomLevel': { globalValue: 1 }
				}
			});
			const plan = planCascade('global', considered, inspect, [{ uri: folder }]);

			// Global is touched for any key that has a globalValue.
			assert.ok(
				hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Global),
				'plan should clear editor.fontSize at Global'
			);
			assert.ok(
				hasStep(plan, 'window.zoomLevel', vscode.ConfigurationTarget.Global),
				'plan should clear window.zoomLevel at Global'
			);

			// Workspace is touched for any key that has a workspaceValue.
			assert.ok(
				hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Workspace),
				'plan should clear editor.fontSize at Workspace (global cascade includes workspace)'
			);

			// WorkspaceFolder is touched for any key that has a workspaceFolderValue at that folder.
			assert.ok(
				hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.WorkspaceFolder, folder),
				'plan should clear editor.fontSize at the folder override'
			);
		});

		test('does not plan a clear at a rung where the key is unset', () => {
			const considered = ['editor.fontSize'];
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 14 } // not set at workspace
			});
			const plan = planCascade('global', considered, inspect, []);
			assert.ok(hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Global));
			assert.ok(
				!hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Workspace),
				'must not clear a key that is not set at workspace'
			);
		});

		test('returns an empty plan when no considered key is set at any rung', () => {
			const considered = ['editor.fontSize', 'window.zoomLevel'];
			const inspect = makeInspect({}); // nothing is set anywhere
			const plan = planCascade('global', considered, inspect, []);
			assert.strictEqual(plan.length, 0);
		});
	});

	suite('scope = workspace', () => {
		test('plans Workspace + WorkspaceFolder clears but NOT Global (S6)', () => {
			const considered = ['editor.fontSize'];
			const folder = vscode.Uri.parse('file:///folder1');
			const inspect = makeInspectByFolder({
				__no_folder__: {
					'editor.fontSize': { globalValue: 14, workspaceValue: 16 }
				},
				[folder.toString()]: {
					'editor.fontSize': { workspaceFolderValue: 18, workspaceValue: 16, globalValue: 14 }
				}
			});
			const plan = planCascade('workspace', considered, inspect, [{ uri: folder }]);

			assert.ok(
				hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Workspace),
				'plan should clear at Workspace'
			);
			assert.ok(
				hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.WorkspaceFolder, folder),
				'plan should clear at the folder override (S7)'
			);
			assert.ok(
				!hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Global),
				'plan must NOT clear at Global when scope = workspace (S6)'
			);
		});

		test('clears every folder override under a single Workspace heading (S7: multi-root)', () => {
			const considered = ['editor.fontSize'];
			const folderA = vscode.Uri.parse('file:///folder-a');
			const folderB = vscode.Uri.parse('file:///folder-b');
			const inspect = makeInspectByFolder({
				__no_folder__: {
					'editor.fontSize': { workspaceValue: 16 }
				},
				[folderA.toString()]: {
					'editor.fontSize': { workspaceFolderValue: 18, workspaceValue: 16 }
				},
				[folderB.toString()]: {
					'editor.fontSize': { workspaceFolderValue: 20, workspaceValue: 16 }
				}
			});
			const plan = planCascade('workspace', considered, inspect, [
				{ uri: folderA },
				{ uri: folderB }
			]);

			assert.ok(hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.WorkspaceFolder, folderA));
			assert.ok(hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.WorkspaceFolder, folderB));
			assert.ok(hasStep(plan, 'editor.fontSize', vscode.ConfigurationTarget.Workspace));
		});
	});

	suite('scope = session', () => {
		test('plans no settings clears at all (Session is in-memory only)', () => {
			const considered = ['editor.fontSize', 'window.zoomLevel'];
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 14, workspaceValue: 16 },
				'window.zoomLevel': { globalValue: 1 }
			});
			const plan = planCascade('session', considered, inspect, []);
			assert.strictEqual(plan.length, 0, 'Session must not touch any settings');
		});
	});

	suite('considered keys with no presence anywhere', () => {
		test('curated key never set yields no clears but is fine to consider (verifiability)', () => {
			const considered = ['editor.fontSize', 'window.zoomLevel'];
			const inspect = makeInspect({
				'editor.fontSize': undefined,
				'window.zoomLevel': undefined
			});
			const plan = planCascade('global', considered, inspect, []);
			assert.strictEqual(plan.length, 0);
		});
	});
});

function hasStep(
	plan: SettingClearStep[],
	key: string,
	target: vscode.ConfigurationTarget,
	folderUri?: vscode.Uri
): boolean {
	return plan.some(s =>
		s.key === key &&
		s.target === target &&
		(folderUri ? s.folderUri?.toString() === folderUri.toString() : !s.folderUri)
	);
}
