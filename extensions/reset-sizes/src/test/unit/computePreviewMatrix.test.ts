import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	computePreviewMatrix,
	PREVIEW_MODES,
	PREVIEW_SCOPES
} from '../../preview/computePreviewMatrix';
import { InspectFn, InspectResult, ZOOM_RESET_COMMANDS } from '../../utils';

/**
 * Build a fake `InspectFn` from a per-folder + base lookup map. Mirrors the
 * pattern used in cascade.test.ts so the planner contract is exercised the
 * same way here.
 */
function makeInspect(
	base: Record<string, InspectResult | undefined> = {},
	perFolder: Record<string, Record<string, InspectResult | undefined>> = {}
): InspectFn {
	return (key: string, folderUri?: vscode.Uri): InspectResult | undefined => {
		if (folderUri) {
			return perFolder[folderUri.toString()]?.[key];
		}
		return base[key];
	};
}

suite('computePreviewMatrix (S27 — preview matrix is pure)', () => {

	suite('shape', () => {
		test('iteration orders mirror MODE_OPTIONS / SCOPE_OPTIONS', () => {
			assert.deepStrictEqual([...PREVIEW_MODES], ['zoom', 'fontSize', 'zoomAndFontSize']);
			assert.deepStrictEqual([...PREVIEW_SCOPES], ['session', 'workspace', 'global']);
		});

		test('produces a 3 × 3 matrix indexable by (mode, scope)', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			for (const mode of PREVIEW_MODES) {
				for (const scope of PREVIEW_SCOPES) {
					const cell = matrix.cells[mode][scope];
					assert.strictEqual(cell.mode, mode);
					assert.strictEqual(cell.scope, scope);
				}
			}
		});
	});

	suite('Zoom-only mode (settings untouched, S13 mirrored)', () => {
		test('plan is empty at every scope', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22, workspaceValue: 18 },
				'window.zoomLevel': { globalValue: 1 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				const cell = matrix.cells.zoom[scope];
				assert.strictEqual(cell.plan.length, 0,
					`Zoom only at ${scope} must plan no settings clears`);
			}
		});

		test('zoom commands listed at every scope', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				const cell = matrix.cells.zoom[scope];
				assert.deepStrictEqual(
					[...cell.zoomCommands].sort(),
					[...ZOOM_RESET_COMMANDS].sort(),
					`Zoom only at ${scope} must list every zoom command`
				);
			}
		});

		test('never requires reload', () => {
			const inspect = makeInspect({
				'window.zoomLevel': { globalValue: 1 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				assert.strictEqual(matrix.cells.zoom[scope].requiresReload, false,
					`Zoom only at ${scope} touches no settings → never reload-requiring`);
			}
		});
	});

	suite('Font-size-only mode', () => {
		test('plan empty at Session even when keys are present (Session is in-memory only)', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22, workspaceValue: 18 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			assert.strictEqual(matrix.cells.fontSize.session.plan.length, 0);
			assert.deepStrictEqual(matrix.cells.fontSize.session.zoomCommands, []);
		});

		test('plan includes Workspace value at Workspace scope, NOT Global (S6 mirrored)', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 14, workspaceValue: 18 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const cell = matrix.cells.fontSize.workspace;
			const workspaceStep = cell.plan.find(
				s => s.key === 'editor.fontSize' && s.target === vscode.ConfigurationTarget.Workspace
			);
			assert.ok(workspaceStep, 'Workspace step must be planned');
			const globalStep = cell.plan.find(
				s => s.key === 'editor.fontSize' && s.target === vscode.ConfigurationTarget.Global
			);
			assert.strictEqual(globalStep, undefined,
				'Workspace scope must NOT plan a Global clear (S6)');
		});

		test('plan includes Global + Workspace at Global scope (S8 mirrored)', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 14, workspaceValue: 18 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			const cell = matrix.cells.fontSize.global;
			assert.ok(
				cell.plan.find(s => s.key === 'editor.fontSize' && s.target === vscode.ConfigurationTarget.Global),
				'Global scope must plan a Global clear'
			);
			assert.ok(
				cell.plan.find(s => s.key === 'editor.fontSize' && s.target === vscode.ConfigurationTarget.Workspace),
				'Global scope cascade must include Workspace (S8)'
			);
		});

		test('plan includes WorkspaceFolder overrides under Workspace scope (S7 mirrored)', () => {
			const folder = vscode.Uri.parse('file:///folder1');
			const inspect = makeInspect(
				{ 'editor.fontSize': { workspaceValue: 18 } },
				{
					[folder.toString()]: {
						'editor.fontSize': { workspaceValue: 18, workspaceFolderValue: 20 }
					}
				}
			);
			const matrix = computePreviewMatrix({}, inspect, [{ uri: folder }], undefined);
			const cell = matrix.cells.fontSize.workspace;
			const folderStep = cell.plan.find(
				s => s.key === 'editor.fontSize'
					&& s.target === vscode.ConfigurationTarget.WorkspaceFolder
					&& s.folderUri?.toString() === folder.toString()
			);
			assert.ok(folderStep, 'Workspace scope must plan folder overrides (S7)');
		});

		test('zoom commands are NOT listed (S12 mirrored)', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				assert.deepStrictEqual(
					matrix.cells.fontSize[scope].zoomCommands,
					[],
					`Font size only at ${scope} must list no zoom commands`
				);
			}
		});
	});

	suite('Zoom-and-font-size mode (combination)', () => {
		test('plan is the same as fontSize at the same scope', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22, workspaceValue: 18 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				assert.deepStrictEqual(
					matrix.cells.zoomAndFontSize[scope].plan,
					matrix.cells.fontSize[scope].plan,
					`zoomAndFontSize at ${scope} must plan exactly the same as fontSize at ${scope}`
				);
			}
		});

		test('zoom commands are the same as zoom-only', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			for (const scope of PREVIEW_SCOPES) {
				assert.deepStrictEqual(
					[...matrix.cells.zoomAndFontSize[scope].zoomCommands].sort(),
					[...matrix.cells.zoom[scope].zoomCommands].sort(),
					`zoomAndFontSize at ${scope} must list the same zoom commands as zoom-only`
				);
			}
		});
	});

	suite('requiresReload flag', () => {
		test('true when window.zoomLevel is in the plan', () => {
			const inspect = makeInspect({
				'window.zoomLevel': { globalValue: 1 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			assert.strictEqual(matrix.cells.fontSize.global.requiresReload, true);
			assert.strictEqual(matrix.cells.zoomAndFontSize.global.requiresReload, true);
		});

		test('false when only live-applying keys are present', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22 }
			});
			const matrix = computePreviewMatrix({}, inspect, [], undefined);
			assert.strictEqual(matrix.cells.fontSize.global.requiresReload, false);
		});

		test('false when nothing is in the plan (Session, empty inspect, etc.)', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			for (const mode of PREVIEW_MODES) {
				for (const scope of PREVIEW_SCOPES) {
					assert.strictEqual(
						matrix.cells[mode][scope].requiresReload, false,
						`empty plan must yield requiresReload=false (mode=${mode}, scope=${scope})`
					);
				}
			}
		});
	});

	suite('scopeLabel uses labelForScope (S15)', () => {
		test('local labels are "Session" / "Workspace" / "Global"', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], undefined);
			assert.strictEqual(matrix.cells.zoom.session.scopeLabel, 'Session');
			assert.strictEqual(matrix.cells.zoom.workspace.scopeLabel, 'Workspace');
			assert.strictEqual(matrix.cells.zoom.global.scopeLabel, 'Global');
		});

		test('remote swaps Global for "User settings (remote)"', () => {
			const matrix = computePreviewMatrix({}, makeInspect(), [], 'ssh-remote+host');
			assert.strictEqual(matrix.cells.fontSize.global.scopeLabel, 'User settings (remote)');
			// Session and Workspace are untouched.
			assert.strictEqual(matrix.cells.fontSize.session.scopeLabel, 'Session');
			assert.strictEqual(matrix.cells.fontSize.workspace.scopeLabel, 'Workspace');
		});
	});

	suite('purity', () => {
		test('does not call inspect with mutating arguments — inspect is the only seam', () => {
			let calls = 0;
			const inspect: InspectFn = (key) => {
				calls += 1;
				if (key === 'editor.fontSize') {
					return { globalValue: 18 };
				}
				return undefined;
			};
			computePreviewMatrix({}, inspect, [], undefined);
			// The function called inspect some bounded number of times — we
			// don't assert an exact count (that would couple to internal
			// iteration), only that the function does not crash and that
			// inspect *is* the read seam (no writes are possible because
			// InspectFn is read-only).
			assert.ok(calls > 0, 'inspect must be the read seam (compute must call it at least once)');
		});

		test('repeated calls with the same inputs produce equivalent outputs', () => {
			const inspect = makeInspect({
				'editor.fontSize': { globalValue: 22, workspaceValue: 18 }
			});
			const a = computePreviewMatrix({}, inspect, [], undefined);
			const b = computePreviewMatrix({}, inspect, [], undefined);
			for (const mode of PREVIEW_MODES) {
				for (const scope of PREVIEW_SCOPES) {
					assert.deepStrictEqual(
						a.cells[mode][scope].plan,
						b.cells[mode][scope].plan,
						`plan must be deterministic for ${mode} × ${scope}`
					);
					assert.deepStrictEqual(
						a.cells[mode][scope].zoomCommands,
						b.cells[mode][scope].zoomCommands,
						`zoomCommands must be deterministic for ${mode} × ${scope}`
					);
				}
			}
		});
	});
});
