import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	ResetMode,
	ResetScope,
	ExtensionConfig,
	SettingChange,
	ResetInvocationRecord
} from '../../types';

suite('Type Definitions Test Suite', () => {
	test('ResetMode accepts exactly the three documented modes', () => {
		const zoom: ResetMode = 'zoom';
		const fontSize: ResetMode = 'fontSize';
		const zoomAndFontSize: ResetMode = 'zoomAndFontSize';
		assert.strictEqual(zoom, 'zoom');
		assert.strictEqual(fontSize, 'fontSize');
		assert.strictEqual(zoomAndFontSize, 'zoomAndFontSize');
	});

	test('ResetScope accepts exactly the three documented rungs', () => {
		const session: ResetScope = 'session';
		const workspace: ResetScope = 'workspace';
		const global: ResetScope = 'global';
		assert.strictEqual(session, 'session');
		assert.strictEqual(workspace, 'workspace');
		assert.strictEqual(global, 'global');
	});

	test('ExtensionConfig carries the three preferences (Slice 1 + Slice 3)', () => {
		const config: ExtensionConfig = {
			confirmBeforeDestructiveReset: true,
			showSummaryNotification: true,
			reloadSilently: false
		};
		assert.strictEqual(config.confirmBeforeDestructiveReset, true);
		assert.strictEqual(config.showSummaryNotification, true);
		assert.strictEqual(config.reloadSilently, false);
	});

	test('SettingChange tracks success and failure shape', () => {
		const ok: SettingChange = {
			key: 'editor.fontSize',
			target: vscode.ConfigurationTarget.Workspace,
			success: true
		};
		assert.strictEqual(ok.success, true);
		assert.strictEqual(ok.error, undefined);

		const failed: SettingChange = {
			key: 'editor.fontSize',
			target: vscode.ConfigurationTarget.Global,
			success: false,
			error: 'denied'
		};
		assert.strictEqual(failed.success, false);
		assert.strictEqual(failed.error, 'denied');
	});

	test('ResetInvocationRecord captures everything needed for the activity log', () => {
		const record: ResetInvocationRecord = {
			timestamp: new Date(),
			mode: 'zoom',
			scope: 'session',
			keysConsidered: [],
			keysChanged: [],
			commands: [
				{ id: 'workbench.action.zoomReset', success: true }
			],
			failures: [],
			reloadOutcome: 'not-required'
		};
		assert.ok(record.timestamp instanceof Date);
		assert.strictEqual(record.mode, 'zoom');
		assert.strictEqual(record.scope, 'session');
		assert.strictEqual(record.keysConsidered.length, 0);
		assert.strictEqual(record.keysChanged.length, 0);
		assert.strictEqual(record.commands.length, 1);
		assert.strictEqual(record.reloadOutcome, 'not-required');
	});
});
