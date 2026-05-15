import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	buildConfirmationMessage,
	executeVSCodeCommand,
	formatInvocationLog,
	getExtensionConfig,
	MODE_OPTIONS,
	SCOPE_OPTIONS,
	SettingClearStep,
	summariseInvocation,
	updateSettingTarget,
	ZOOM_RESET_COMMANDS
} from '../../utils';
import { ResetInvocationRecord } from '../../types';

suite('Utility Functions Test Suite', () => {

	suite('MODE_OPTIONS (S35: exactly three modes)', () => {
		test('contains exactly three options', () => {
			assert.strictEqual(MODE_OPTIONS.length, 3);
		});

		test('contains zoom, fontSize, and zoomAndFontSize — and nothing else', () => {
			const values = MODE_OPTIONS.map(o => o.value).sort();
			assert.deepStrictEqual(values, ['fontSize', 'zoom', 'zoomAndFontSize']);
		});

		test('does NOT expose a "custom" mode', () => {
			const labels = MODE_OPTIONS.map(o => o.label.toLowerCase());
			const values = MODE_OPTIONS.map(o => o.value.toLowerCase());
			assert.ok(!labels.some(l => l.includes('custom')), 'No mode label should mention "custom"');
			assert.ok(!values.some(v => v.includes('custom')), 'No mode value should be "custom"');
		});

		test('every option has a non-empty label and description', () => {
			for (const option of MODE_OPTIONS) {
				assert.ok(option.label.length > 0, `Empty label for ${option.value}`);
				assert.ok(option.description.length > 0, `Empty description for ${option.value}`);
			}
		});
	});

	suite('SCOPE_OPTIONS (three rungs in destructiveness order)', () => {
		test('contains exactly three rungs', () => {
			assert.strictEqual(SCOPE_OPTIONS.length, 3);
		});

		test('rungs are session, workspace, global', () => {
			const values = SCOPE_OPTIONS.map(o => o.value);
			assert.deepStrictEqual(values, ['session', 'workspace', 'global']);
		});

		test('copy uses destructiveness vocabulary, not precedence vocabulary', () => {
			for (const option of SCOPE_OPTIONS) {
				const text = `${option.label} ${option.description}`.toLowerCase();
				assert.ok(
					!text.includes('precedence'),
					`Scope copy must not use "precedence" vocabulary (found in: ${option.value})`
				);
				assert.ok(
					!text.includes('override wins'),
					`Scope copy must not describe override-winning (found in: ${option.value})`
				);
			}
		});
	});

	suite('ZOOM_RESET_COMMANDS', () => {
		test('targets UI zoom, editor font zoom, and terminal font zoom', () => {
			assert.deepStrictEqual([...ZOOM_RESET_COMMANDS], [
				'workbench.action.zoomReset',
				'editor.action.fontZoomReset',
				'workbench.action.terminal.fontZoomReset'
			]);
		});
	});

	suite('getExtensionConfig', () => {
		test('returns the two slice 1 preferences with their defaults', () => {
			const config = getExtensionConfig();
			assert.strictEqual(typeof config.confirmBeforeDestructiveReset, 'boolean');
			assert.strictEqual(typeof config.showSummaryNotification, 'boolean');
		});

		test('default for confirmBeforeDestructiveReset is true (safe-by-default)', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			const inspect = configApi.inspect('confirmBeforeDestructiveReset');
			assert.strictEqual(inspect?.defaultValue, true, 'Manifest must default to true');
		});

		test('default for showSummaryNotification is true', () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			const inspect = configApi.inspect('showSummaryNotification');
			assert.strictEqual(inspect?.defaultValue, true, 'Manifest must default to true');
		});
	});

	suite('executeVSCodeCommand', () => {
		test('returns success for a built-in command', async () => {
			const result = await executeVSCodeCommand('workbench.action.zoomReset');
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.id, 'workbench.action.zoomReset');
		});

		test('captures failure as data (does not throw)', async () => {
			const result = await executeVSCodeCommand('definitely.not.a.real.command.xyz');
			assert.strictEqual(result.success, false);
			assert.ok(result.error, 'A failed command must include an error message');
		});
	});

	suite('updateSettingTarget (S23 partial-failure tolerance for settings)', () => {
		test('returns success when clearing a real setting at Global', async () => {
			const key = 'editor.fontSize';
			const original = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
			await vscode.workspace.getConfiguration().update(key, 17, vscode.ConfigurationTarget.Global);
			try {
				const result = await updateSettingTarget(key, vscode.ConfigurationTarget.Global);
				assert.strictEqual(result.success, true);
				assert.strictEqual(result.key, key);
				assert.strictEqual(result.target, vscode.ConfigurationTarget.Global);
			} finally {
				await vscode.workspace.getConfiguration().update(key, original, vscode.ConfigurationTarget.Global);
			}
		});

		test('captures failure as data when WorkspaceFolder is requested without folderUri', async () => {
			// WorkspaceFolder writes require a folderUri context; without one,
			// VS Code rejects. updateSettingTarget must capture that as data
			// rather than throw.
			const result = await updateSettingTarget(
				'editor.fontSize',
				vscode.ConfigurationTarget.WorkspaceFolder,
				undefined
			);
			assert.strictEqual(result.success, false);
			assert.ok(result.error, 'A failed update must include an error message');
		});
	});

	suite('formatInvocationLog', () => {
		test('includes mode, scope, and the executed commands', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date('2026-05-15T12:00:00.000Z'),
				mode: 'zoom',
				scope: 'session',
				keysConsidered: [],
				keysChanged: [],
				commands: [
					{ id: 'workbench.action.zoomReset', success: true },
					{ id: 'workbench.action.terminal.fontZoomReset', success: false, error: 'no terminal' }
				],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const text = formatInvocationLog(record);
			assert.ok(text.includes('Zoom only'), 'Should describe mode by label');
			assert.ok(text.includes('Session'), 'Should describe scope by label');
			assert.ok(text.includes('workbench.action.zoomReset'), 'Should name each command');
			assert.ok(text.includes('workbench.action.terminal.fontZoomReset'), 'Should name failed command');
			assert.ok(text.includes('no terminal'), 'Should include the failure message');
			assert.ok(text.includes('2026-05-15T12:00:00'), 'Should include a timestamp');
		});

		test('shows "(none)" when there are no considered keys', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'zoom',
				scope: 'session',
				keysConsidered: [],
				keysChanged: [],
				commands: [],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const text = formatInvocationLog(record);
			assert.ok(text.includes('Keys considered: (none)'));
			assert.ok(text.includes('Keys changed: (none)'));
		});
	});

	suite('summariseInvocation (S24)', () => {
		test('names the zoom changes when zoom-only succeeded', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'zoom',
				scope: 'session',
				keysConsidered: [],
				keysChanged: [],
				commands: [
					{ id: 'workbench.action.zoomReset', success: true },
					{ id: 'editor.action.fontZoomReset', success: true },
					{ id: 'workbench.action.terminal.fontZoomReset', success: true }
				],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record);
			assert.ok(summary.includes('Zoom reset'), `Summary should name zoom reset, got: ${summary}`);
			assert.ok(summary.includes('3'), 'Summary should count the steps');
		});

		test('reports failed steps alongside the successes (partial-failure tolerance, S23)', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'zoom',
				scope: 'session',
				keysConsidered: [],
				keysChanged: [],
				commands: [
					{ id: 'workbench.action.zoomReset', success: true },
					{ id: 'workbench.action.terminal.fontZoomReset', success: false, error: 'no terminal' }
				],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record);
			assert.ok(summary.includes('Failed: 1 step'), `Summary should name the failure count, got: ${summary}`);
			assert.ok(summary.includes('Zoom reset'), 'Summary should still name the successful work');
		});

		test('says "Nothing changed." when nothing was applied', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'fontSize',
				scope: 'session',
				keysConsidered: [],
				keysChanged: [],
				commands: [],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record);
			assert.ok(summary.includes('Nothing changed'), `Summary should report no changes, got: ${summary}`);
		});

		test('groups Workspace + WorkspaceFolder clears under a single "Workspace" heading (S6, S7)', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'fontSize',
				scope: 'workspace',
				keysConsidered: ['editor.fontSize'],
				keysChanged: [
					{
						key: 'editor.fontSize',
						target: vscode.ConfigurationTarget.Workspace,
						success: true
					},
					{
						key: 'editor.fontSize',
						target: vscode.ConfigurationTarget.WorkspaceFolder,
						success: true
					}
				],
				commands: [],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record);
			assert.ok(
				/Workspace/.test(summary),
				`Summary must mention the Workspace heading, got: ${summary}`
			);
			assert.ok(
				!/WorkspaceFolder/.test(summary),
				`Summary must NOT expose a separate WorkspaceFolder bucket, got: ${summary}`
			);
		});

		test('uses "User settings (remote)" label when remoteName is set (S15)', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'fontSize',
				scope: 'global',
				keysConsidered: ['editor.fontSize'],
				keysChanged: [
					{
						key: 'editor.fontSize',
						target: vscode.ConfigurationTarget.Global,
						success: true
					}
				],
				commands: [],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record, { remoteName: 'ssh-remote+host' });
			assert.ok(
				summary.includes('User settings (remote)'),
				`Summary must show remote label when remoteName is set, got: ${summary}`
			);
			assert.ok(
				!/\bGlobal\b/.test(summary),
				`Summary must NOT show the "Global" label when remoteName is set, got: ${summary}`
			);
		});

		test('names the key cleared in the activity-log summary (S24)', () => {
			const record: ResetInvocationRecord = {
				timestamp: new Date(),
				mode: 'fontSize',
				scope: 'global',
				keysConsidered: ['editor.fontSize'],
				keysChanged: [
					{
						key: 'editor.fontSize',
						target: vscode.ConfigurationTarget.Global,
						success: true
					}
				],
				commands: [],
				failures: [],
				reloadOutcome: 'not-required'
			};
			const summary = summariseInvocation(record);
			assert.ok(
				summary.includes('editor.fontSize'),
				`S24: summary should name the changed key, got: ${summary}`
			);
		});
	});

	suite('buildConfirmationMessage (S3 modal text)', () => {
		test('names every key under its bucket heading', () => {
			const plan: SettingClearStep[] = [
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Global },
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Workspace },
				{ key: 'window.zoomLevel', target: vscode.ConfigurationTarget.Global }
			];
			const message = buildConfirmationMessage(plan, 'global', undefined);
			assert.ok(message.includes('Global:'), `Message must have a Global heading. Got: ${message}`);
			assert.ok(message.includes('Workspace:'), `Message must have a Workspace heading. Got: ${message}`);
			assert.ok(message.includes('editor.fontSize'), 'Message must name the cleared key');
			assert.ok(message.includes('window.zoomLevel'), 'Message must name every cleared key');
		});

		test('shows the chosen scope label at the top (S3)', () => {
			const plan: SettingClearStep[] = [
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Workspace }
			];
			const message = buildConfirmationMessage(plan, 'workspace', undefined);
			assert.ok(/scope: Workspace/i.test(message), `Header must name the chosen scope. Got: ${message}`);
		});

		test('folds WorkspaceFolder under "Workspace" — not a separate bucket (S6, S7)', () => {
			const plan: SettingClearStep[] = [
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Workspace },
				{
					key: 'editor.fontSize',
					target: vscode.ConfigurationTarget.WorkspaceFolder,
					folderUri: vscode.Uri.parse('file:///folder1')
				}
			];
			const message = buildConfirmationMessage(plan, 'workspace', undefined);
			assert.ok(
				!/WorkspaceFolder/.test(message),
				`Message must NOT expose a WorkspaceFolder bucket. Got: ${message}`
			);
		});

		test('uses "User settings (remote)" label when a remote is connected (S15)', () => {
			const plan: SettingClearStep[] = [
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Global }
			];
			const message = buildConfirmationMessage(plan, 'global', 'ssh-remote+host');
			assert.ok(
				message.includes('User settings (remote)'),
				`Remote scope must show the remote label. Got: ${message}`
			);
			assert.ok(
				!/\bGlobal\b/.test(message),
				`Message must not show "Global" when on a remote. Got: ${message}`
			);
		});

		test('warns that the action is destructive ("back to built-in defaults")', () => {
			const plan: SettingClearStep[] = [
				{ key: 'editor.fontSize', target: vscode.ConfigurationTarget.Global }
			];
			const message = buildConfirmationMessage(plan, 'global', undefined);
			assert.ok(
				/built-in default/.test(message),
				`Message must clarify that reset means "built-in defaults" (no undo). Got: ${message}`
			);
		});
	});
});
