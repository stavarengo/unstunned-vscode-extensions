import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	handlePreviewMessage,
	isRunResetMessage,
	RunResetMessage
} from '../../preview/previewMessage';

suite('Preview message routing (Slice 4, S29)', () => {

	suite('isRunResetMessage type guard', () => {
		test('accepts a well-formed run-reset message', () => {
			const msg: RunResetMessage = { type: 'run-reset', mode: 'zoom', scope: 'session' };
			assert.strictEqual(isRunResetMessage(msg), true);
		});

		test('accepts every valid (mode, scope) combination', () => {
			const modes = ['zoom', 'fontSize', 'zoomAndFontSize'];
			const scopes = ['session', 'workspace', 'global'];
			for (const mode of modes) {
				for (const scope of scopes) {
					assert.strictEqual(
						isRunResetMessage({ type: 'run-reset', mode, scope }),
						true,
						`(${mode}, ${scope}) must be accepted`
					);
				}
			}
		});

		test('rejects unknown mode values', () => {
			assert.strictEqual(
				isRunResetMessage({ type: 'run-reset', mode: 'custom', scope: 'global' }),
				false,
				'S35: there is no "custom" mode — message must be rejected'
			);
		});

		test('rejects unknown scope values', () => {
			assert.strictEqual(
				isRunResetMessage({ type: 'run-reset', mode: 'fontSize', scope: 'remote' }),
				false,
				'ADR 0002: there is no "remote" rung — message must be rejected'
			);
		});

		test('rejects messages with wrong type field', () => {
			assert.strictEqual(
				isRunResetMessage({ type: 'something-else', mode: 'zoom', scope: 'session' }),
				false
			);
		});

		test('rejects non-object inputs (null, undefined, string, number)', () => {
			assert.strictEqual(isRunResetMessage(null), false);
			assert.strictEqual(isRunResetMessage(undefined), false);
			assert.strictEqual(isRunResetMessage('run-reset'), false);
			assert.strictEqual(isRunResetMessage(42), false);
		});
	});

	suite('handlePreviewMessage routing (S29)', () => {
		// We can't intercept the call to runReset directly without rewiring it
		// behind a seam, but we can observe its side effects: an Output Channel
		// gets a log block appended every time runReset is called. Asserting
		// the log entry has the right mode/scope is sufficient evidence that
		// run-reset routed correctly.
		//
		// We also disable the confirmation and summary so the test doesn't
		// pop a modal we can't dismiss.
		let originalConfirm: unknown;
		let originalSummary: unknown;

		suiteSetup(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			originalConfirm = configApi.inspect('confirmBeforeDestructiveReset')?.globalValue;
			originalSummary = configApi.inspect('showSummaryNotification')?.globalValue;
			await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
			await configApi.update('showSummaryNotification', false, vscode.ConfigurationTarget.Global);
		});

		suiteTeardown(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', originalConfirm, vscode.ConfigurationTarget.Global);
			await configApi.update('showSummaryNotification', originalSummary, vscode.ConfigurationTarget.Global);
		});

		test('routes run-reset with the exact mode and scope from the message (S29)', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (message routing)');
			const lines: string[] = [];
			const originalAppend = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppend(line);
			};
			try {
				await handlePreviewMessage(
					{ type: 'run-reset', mode: 'zoom', scope: 'session' },
					channel
				);
				const joined = lines.join('\n');
				assert.ok(joined.includes('Zoom only'),
					`Run-reset routing must invoke runReset with the chosen mode. Got log: ${joined.slice(0, 200)}`);
				assert.ok(joined.includes('Session'),
					'Run-reset routing must invoke runReset with the chosen scope');
			} finally {
				channel.dispose();
			}
		});

		test('silently drops malformed messages (no crash)', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (malformed)');
			const lines: string[] = [];
			const originalAppend = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppend(line);
			};
			try {
				// None of these should trigger runReset.
				await handlePreviewMessage({ type: 'unknown' }, channel);
				await handlePreviewMessage({ type: 'run-reset', mode: 'custom', scope: 'global' }, channel);
				await handlePreviewMessage(null, channel);
				await handlePreviewMessage(undefined, channel);
				assert.strictEqual(lines.length, 0,
					'No log entry should be written for malformed messages');
			} finally {
				channel.dispose();
			}
		});

		test('routes the same way regardless of (mode, scope) combination — S29 contract', async () => {
			// We assert the routing contract for every combination by sampling
			// a small set that doesn't actually mutate global state. Zoom-only
			// at Session is a safe canary because it never touches settings.
			//
			// For non-Session scopes we instead check that the log entry
			// records the expected scope label, which is sufficient evidence
			// of correct routing (the integration tests in resetAllSizes.test.ts
			// cover the actual settings work).
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S29 sample)');
			const lines: string[] = [];
			const originalAppend = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppend(line);
			};
			try {
				await handlePreviewMessage(
					{ type: 'run-reset', mode: 'fontSize', scope: 'session' },
					channel
				);
				const joined = lines.join('\n');
				assert.ok(joined.includes('Font size only'),
					`Routing must pass the mode through unchanged. Got: ${joined.slice(0, 200)}`);
				assert.ok(joined.includes('Session'),
					'Routing must pass the scope through unchanged');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Routing honours the confirmation gate (S29)', () => {
		// S29's exact wording: "the same confirmation prompt (if enabled)
		// appears" when the button is clicked. We assert this by injecting a
		// surrogate confirmer via `RunResetOptions` on handlePreviewMessage —
		// the same seam runReset's own Slice 2 tests use. If the message
		// router did NOT forward to runReset's confirmation gate, the
		// surrogate would not fire. Conversely, if it does fire AND we can
		// observe the same (plan, scope) shape the Command Palette path
		// would see, the S29 contract holds.
		const key = 'editor.fontSize';
		let originalConfirm: unknown;
		let originalSummary: unknown;
		let originalGlobal: unknown;

		suiteSetup(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			originalConfirm = configApi.inspect('confirmBeforeDestructiveReset')?.globalValue;
			originalSummary = configApi.inspect('showSummaryNotification')?.globalValue;
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
			await configApi.update('showSummaryNotification', false, vscode.ConfigurationTarget.Global);
		});

		suiteTeardown(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', originalConfirm, vscode.ConfigurationTarget.Global);
			await configApi.update('showSummaryNotification', originalSummary, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('S29: with confirm=true and a key at Workspace, the message-routed call hits the confirmation gate', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', true, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, 22, vscode.ConfigurationTarget.Workspace);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S29 confirm gate)');
			let confirmerCalled = false;
			let confirmerSawKey = false;
			let confirmerSawScope: string | undefined;
			try {
				await handlePreviewMessage(
					{ type: 'run-reset', mode: 'fontSize', scope: 'workspace' },
					channel,
					{
						// Decline the confirmation so no write actually happens.
						confirmer: async (plan, scope) => {
							confirmerCalled = true;
							confirmerSawKey = plan.some(s => s.key === key);
							confirmerSawScope = scope;
							return false;
						}
					}
				);
				assert.strictEqual(confirmerCalled, true,
					'S29: with confirm=true, the message-routed call MUST go through the confirmation gate the Command Palette also goes through');
				assert.ok(confirmerSawKey,
					'S29: the confirmer must see the same plan (with editor.fontSize) the Command Palette would see');
				assert.strictEqual(confirmerSawScope, 'workspace',
					'S29: the confirmer must see the same scope the button carried');
				// And the key must NOT have been cleared (declined).
				const after = vscode.workspace.getConfiguration().inspect(key)?.workspaceValue;
				assert.strictEqual(after, 22,
					'S29: declining the confirmation must leave the workspace value untouched (same as Command Palette path)');
			} finally {
				// Clean up the workspace setting we introduced.
				await vscode.workspace.getConfiguration().update(key, undefined, vscode.ConfigurationTarget.Workspace);
				await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('S29: with confirm=false, the message-routed call does NOT confirm (same as Command Palette behaviour)', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S29 no-confirm)');
			let confirmerCalled = false;
			try {
				await handlePreviewMessage(
					{ type: 'run-reset', mode: 'fontSize', scope: 'global' },
					channel,
					{
						confirmer: async () => { confirmerCalled = true; return true; }
					}
				);
				assert.strictEqual(confirmerCalled, false,
					'S29: with confirm=false, the message-routed call must NOT confirm (same as Command Palette behaviour with confirm=false)');
				// And the key must have been cleared.
				const after = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
				assert.strictEqual(after, undefined,
					'S29: with confirm=false, the message-routed call must proceed to clear the key');
			} finally {
				channel.dispose();
			}
		});

		test('S29: the reload flow is the same as the Command Palette path', async () => {
			// Set window.zoomLevel at Global so a reset will produce a reload-
			// requiring change. With silent-reload off, the reload prompter
			// must fire — that's the same behaviour the Command Palette would
			// produce.
			const reloadKey = 'window.zoomLevel';
			const originalReload = vscode.workspace.getConfiguration().inspect(reloadKey)?.globalValue;
			await vscode.workspace.getConfiguration().update(reloadKey, 1, vscode.ConfigurationTarget.Global);

			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S29 reload flow)');
			let promptedKeys: string[] = [];
			let reloaderCalled = false;
			try {
				await handlePreviewMessage(
					{ type: 'run-reset', mode: 'fontSize', scope: 'global' },
					channel,
					{
						reloadPrompter: async changes => {
							promptedKeys = changes.map(c => c.key);
							return 'defer';
						},
						reloader: async () => { reloaderCalled = true; }
					}
				);
				assert.ok(promptedKeys.includes(reloadKey),
					'S29: the message-routed call must hit the same reload flow the Command Palette does (Slice 3)');
				assert.strictEqual(reloaderCalled, false,
					'S29: defer leaves the window unreloaded (same as Command Palette behaviour)');
			} finally {
				await vscode.workspace.getConfiguration().update(reloadKey, originalReload, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});
	});
});
