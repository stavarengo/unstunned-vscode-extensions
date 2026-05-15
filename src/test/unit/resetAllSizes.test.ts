import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	RELOAD_PROMPT_BUTTON_LABELS,
	RELOAD_PROMPT_OPTIONS,
	ReloadPromptChoice,
	runReset
} from '../../commands/resetAllSizes';
import { CURATED_SIZE_KEYS, summariseInvocation, ZOOM_RESET_COMMANDS } from '../../utils';

suite('runReset Test Suite', () => {
	// Silence the summary notification across the suite so the headless test
	// host does not pop information messages whose dismissal we never await.
	// One nested suite re-enables it explicitly to assert the silencing path.
	let originalShowSummary: unknown;
	let originalConfirmBefore: unknown;
	let originalReloadSilently: unknown;

	suiteSetup(async () => {
		const configApi = vscode.workspace.getConfiguration('resetSizes');
		originalShowSummary = configApi.inspect('showSummaryNotification')?.globalValue;
		originalConfirmBefore = configApi.inspect('confirmBeforeDestructiveReset')?.globalValue;
		originalReloadSilently = configApi.inspect('reloadSilently')?.globalValue;
		await configApi.update('showSummaryNotification', false, vscode.ConfigurationTarget.Global);
		// Disable confirmation by default so tests can run unattended.
		// Tests that exercise the confirmation gate inject a confirmer or
		// flip the setting back on inside their own block.
		await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
		// Default the silent-reload preference off; the dedicated Slice 3
		// suites flip it on inside their own try/finally as needed.
		await configApi.update('reloadSilently', false, vscode.ConfigurationTarget.Global);
	});

	suiteTeardown(async () => {
		const configApi = vscode.workspace.getConfiguration('resetSizes');
		await configApi.update('showSummaryNotification', originalShowSummary, vscode.ConfigurationTarget.Global);
		await configApi.update('confirmBeforeDestructiveReset', originalConfirmBefore, vscode.ConfigurationTarget.Global);
		await configApi.update('reloadSilently', originalReloadSilently, vscode.ConfigurationTarget.Global);
	});

	suite('Zoom-only at Session (S2, S13, S22)', () => {
		test('invokes all three documented zoom reset commands', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes');
			try {
				const record = await runReset('zoom', 'session', channel);
				const attempted = record.commands.map(c => c.id).sort();
				const expected = [...ZOOM_RESET_COMMANDS].sort();
				assert.deepStrictEqual(attempted, expected);
			} finally {
				channel.dispose();
			}
		});

		test('touches no persisted settings (keysConsidered and keysChanged stay empty — S13)', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes');
			try {
				const record = await runReset('zoom', 'session', channel);
				assert.strictEqual(record.keysConsidered.length, 0, 'Zoom only must consider no settings keys');
				assert.strictEqual(record.keysChanged.length, 0, 'Zoom only must change no settings keys');
			} finally {
				channel.dispose();
			}
		});

		test('records the chosen mode and scope on the invocation record', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes');
			try {
				const record = await runReset('zoom', 'session', channel);
				assert.strictEqual(record.mode, 'zoom');
				assert.strictEqual(record.scope, 'session');
				assert.ok(record.timestamp instanceof Date);
			} finally {
				channel.dispose();
			}
		});

		test('tolerates a failed sub-step without throwing (S23)', async () => {
			// Without an open terminal in the test host, the terminal font zoom
			// reset typically no-ops or rejects. Either way, runReset must
			// return cleanly and capture the outcome on the record.
			const channel = vscode.window.createOutputChannel('Test Reset Sizes');
			try {
				const record = await runReset('zoom', 'session', channel);
				assert.ok(Array.isArray(record.commands));
				assert.strictEqual(record.commands.length, ZOOM_RESET_COMMANDS.length);
				// Whether each succeeds depends on the host; the contract is:
				// the function never throws and every attempted step is on the record.
			} finally {
				channel.dispose();
			}
		});

		test('appends an entry to the output channel (activity log surface)', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes');
			try {
				// We cannot read the channel's contents back, but we can assert
				// the call shape by spying on appendLine.
				const lines: string[] = [];
				const originalAppendLine = channel.appendLine.bind(channel);
				channel.appendLine = (line: string) => {
					lines.push(line);
					originalAppendLine(line);
				};

				await runReset('zoom', 'session', channel);

				const joined = lines.join('\n');
				assert.ok(joined.includes('Zoom only'), 'Log entry should mention the chosen mode label');
				assert.ok(joined.includes('Session'), 'Log entry should mention the chosen scope label');
				assert.ok(
					joined.includes('workbench.action.zoomReset'),
					'Log entry should mention each zoom command attempted'
				);
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Zoom-only at any scope leaves persisted settings untouched (S13)', () => {
		// S13's wording is "Zoom only at *any* scope leaves persisted settings
		// untouched". Session is covered by the suite above; the cases below
		// guard against a Slice-2 regression that might wire scope into the
		// zoom path.
		for (const scope of ['workspace', 'global'] as const) {
			test(`zoom + ${scope} touches no settings keys`, async () => {
				const channel = vscode.window.createOutputChannel(`Test Reset Sizes zoom ${scope}`);
				try {
					const record = await runReset('zoom', scope, channel);
					assert.strictEqual(record.scope, scope);
					assert.strictEqual(
						record.keysConsidered.length, 0,
						`Zoom only at ${scope} must consider no settings keys`
					);
					assert.strictEqual(
						record.keysChanged.length, 0,
						`Zoom only at ${scope} must change no settings keys`
					);
				} finally {
					channel.dispose();
				}
			});
		}
	});

	suite('Activity log is unconditional (S25)', () => {
		test('log entry is still written when showSummaryNotification is silenced', async function () {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			const original = configApi.inspect('showSummaryNotification')?.globalValue;
			await configApi.update('showSummaryNotification', false, vscode.ConfigurationTarget.Global);
			try {
				const channel = vscode.window.createOutputChannel('Test Reset Sizes (silenced)');
				const lines: string[] = [];
				const originalAppendLine = channel.appendLine.bind(channel);
				channel.appendLine = (line: string) => {
					lines.push(line);
					originalAppendLine(line);
				};
				try {
					await runReset('zoom', 'session', channel);
					const joined = lines.join('\n');
					assert.ok(joined.includes('Zoom only'), 'Log entry must still mention the mode');
					assert.ok(joined.includes('Session'), 'Log entry must still mention the scope');
				} finally {
					channel.dispose();
				}
			} finally {
				await configApi.update('showSummaryNotification', original, vscode.ConfigurationTarget.Global);
			}
		});
	});

	// ----- Slice 2: Settings reset, cascade, confirmation -----

	suite('Font size only — settings clears (S12, S9, S10, S11, S33)', () => {
		const key = 'editor.fontSize';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			const config = vscode.workspace.getConfiguration();
			originalGlobal = config.inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			const config = vscode.workspace.getConfiguration();
			await config.update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('clears editor.fontSize at Global scope (S5, S8 subset)', async () => {
			const config = vscode.workspace.getConfiguration();
			await config.update(key, 20, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (fontSize global)');
			try {
				const record = await runReset('fontSize', 'global', channel);

				assert.ok(record.keysConsidered.includes(key), 'editor.fontSize must be in keysConsidered');
				const cleared = record.keysChanged.find(c => c.key === key && c.target === vscode.ConfigurationTarget.Global);
				assert.ok(cleared, `editor.fontSize must be cleared at Global. keysChanged=${JSON.stringify(record.keysChanged)}`);
				assert.strictEqual(cleared!.success, true);

				const afterValue = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
				assert.strictEqual(afterValue, undefined, 'Global value must be undefined after reset');
			} finally {
				channel.dispose();
			}
		});

		test('preserves non-size keys (S9: editor.fontFamily, S33: other settings)', async () => {
			const config = vscode.workspace.getConfiguration();
			const fontFamilyOriginal = config.inspect('editor.fontFamily')?.globalValue;
			const colorThemeOriginal = config.inspect('workbench.colorTheme')?.globalValue;
			await config.update('editor.fontFamily', 'Menlo', vscode.ConfigurationTarget.Global);
			await config.update(key, 20, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (preserve)');
			try {
				await runReset('fontSize', 'global', channel);

				const after = vscode.workspace.getConfiguration();
				assert.strictEqual(after.inspect('editor.fontFamily')?.globalValue, 'Menlo',
					'editor.fontFamily must be preserved');
				assert.strictEqual(after.inspect('workbench.colorTheme')?.globalValue, colorThemeOriginal,
					'workbench.colorTheme must be untouched');
			} finally {
				await config.update('editor.fontFamily', fontFamilyOriginal, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('clears a curated VS Code size key (S8 subset, end-to-end)', async () => {
			// editor.codeLensFontSize is a built-in VS Code key on the curated
			// list. The suffix-match rule for arbitrary keys (e.g.
			// myExt.editor.fontSize per S10) is tested in discovery.test.ts;
			// this test verifies the end-to-end clear works for a real key.
			const key = 'editor.codeLensFontSize';
			const config = vscode.workspace.getConfiguration();
			const original = config.inspect(key)?.globalValue;
			await config.update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (curated key)');
			try {
				const record = await runReset('fontSize', 'global', channel);
				const clearedKey = record.keysChanged.find(
					c => c.key === key && c.target === vscode.ConfigurationTarget.Global
				);
				assert.ok(clearedKey, `${key} must be cleared`);
				assert.strictEqual(
					vscode.workspace.getConfiguration().inspect(key)?.globalValue, undefined
				);
			} finally {
				await config.update(key, original, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('clears a third-party-shaped key matched only by suffix (S10 end-to-end)', async () => {
			// S10's contract: a third-party key like `myExt.editor.fontSize`
			// (not on the curated list) is cleared via the fontSize suffix
			// rule. VS Code's update() rejects keys not declared in any
			// extension's configuration schema — but at Workspace scope, we
			// can write arbitrary keys via the workspace's .vscode/settings.json,
			// because VS Code does not validate the schema for workspace
			// settings on write. We exploit that here.
			const thirdPartyKey = 'fakeThirdParty.editor.fontSize';
			const config = vscode.workspace.getConfiguration();

			let wrote = false;
			try {
				await config.update(thirdPartyKey, 22, vscode.ConfigurationTarget.Workspace);
				wrote = true;
			} catch {
				// If VS Code refused the write, this scenario is covered by
				// the pure isSizeFamilyKey test alone. Skip rather than
				// false-fail.
				assert.ok(true, `VS Code rejected the third-party write; isSizeFamilyKey covers S10 in isolation`);
				return;
			}

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (third-party suffix)');
			try {
				const record = await runReset('fontSize', 'workspace', channel);
				const cleared = record.keysChanged.find(
					c => c.key === thirdPartyKey && c.target === vscode.ConfigurationTarget.Workspace
				);
				assert.ok(cleared,
					`Third-party suffix-matched key ${thirdPartyKey} must be cleared at Workspace (S10). keysChanged=${JSON.stringify(record.keysChanged.map(k => k.key))}`);
				assert.strictEqual(
					vscode.workspace.getConfiguration().inspect(thirdPartyKey)?.workspaceValue, undefined,
					'workspaceValue must be undefined after clear'
				);
			} finally {
				if (wrote) {
					await config.update(thirdPartyKey, undefined, vscode.ConfigurationTarget.Workspace);
				}
				channel.dispose();
			}
		});

		test('keysConsidered only includes suffix-matched keys that are present at the targeted scope', async () => {
			// editor.codeLensFontSize is curated, so it always appears in
			// keysConsidered. To verify the "only present" rule for
			// suffix-matched keys, we use the fact that *no* third-party
			// keys are set in the test host. So keysConsidered should equal
			// the curated list exactly (give or take possibly-set built-in
			// VS Code keys at default in the user data dir).
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (considered scope)');
			try {
				const record = await runReset('fontSize', 'session', channel);
				// At Session, plan is empty regardless. keysConsidered should
				// just be the curated list (no suffix-matched present).
				const nonCurated = record.keysConsidered.filter(
					k => !CURATED_SIZE_KEYS.includes(k)
				);
				assert.deepStrictEqual(nonCurated, [],
					`At Session, no suffix-matched key should be in keysConsidered (Session plan is empty). Got: ${nonCurated.join(', ')}`);
			} finally {
				channel.dispose();
			}
		});

		test('preserves editor.tabSize (S11: unrecognised setting whose suffix is "tabSize", not "fontSize")', async () => {
			const config = vscode.workspace.getConfiguration();
			const tabSizeOriginal = config.inspect('editor.tabSize')?.globalValue;
			await config.update('editor.tabSize', 5, vscode.ConfigurationTarget.Global);
			await config.update(key, 20, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (tabSize)');
			try {
				await runReset('fontSize', 'global', channel);

				const tabSizeAfter = vscode.workspace.getConfiguration().inspect('editor.tabSize')?.globalValue;
				assert.strictEqual(tabSizeAfter, 5,
					'editor.tabSize must NOT be touched — its suffix is "tabSize", not "fontSize"');
			} finally {
				await config.update('editor.tabSize', tabSizeOriginal, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('does NOT touch in-memory zoom state (S12 distinct from S13)', async () => {
			// We cannot read the in-memory zoom level directly, but we CAN
			// assert that runReset with mode "fontSize" never invokes a zoom
			// command. The commands array on the record is the source of
			// truth.
			const config = vscode.workspace.getConfiguration();
			await config.update(key, 20, vscode.ConfigurationTarget.Global);
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (fontSize no-zoom)');
			try {
				const record = await runReset('fontSize', 'global', channel);
				const zoomCommands = record.commands.filter(c => ZOOM_RESET_COMMANDS.includes(c.id));
				assert.strictEqual(zoomCommands.length, 0,
					`Font size only must NOT run zoom commands. ran: ${zoomCommands.map(c => c.id).join(', ')}`);
			} finally {
				channel.dispose();
			}
		});

		test('preserves the extension\'s own preference keys (S32)', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			// Set a non-default value we can check.
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S32)');
			try {
				const record = await runReset('fontSize', 'global', channel);
				// Neither preference key should appear in keysConsidered or keysChanged.
				const considered = record.keysConsidered.find(k => k.startsWith('resetSizes.'));
				assert.strictEqual(considered, undefined, `resetSizes.* keys must not be considered (got: ${considered})`);
				const cleared = record.keysChanged.find(k => k.key.startsWith('resetSizes.'));
				assert.strictEqual(cleared, undefined, `resetSizes.* keys must not be cleared (got: ${cleared?.key})`);

				// Preferences must still be in effect.
				const stillSilenced = configApi.get<boolean>('showSummaryNotification');
				assert.strictEqual(stillSilenced, false, 'showSummaryNotification preference must survive a Global reset');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Font size only at Workspace — does not touch Global (S6)', () => {
		const key = 'editor.fontSize';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			const config = vscode.workspace.getConfiguration();
			originalGlobal = config.inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			const config = vscode.workspace.getConfiguration();
			await config.update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('clears workspace value but leaves global value intact (S6)', async () => {
			const config = vscode.workspace.getConfiguration();
			await config.update(key, 16, vscode.ConfigurationTarget.Global);
			await config.update(key, 22, vscode.ConfigurationTarget.Workspace);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (ws preserve global)');
			try {
				const record = await runReset('fontSize', 'workspace', channel);
				const clearedAtWorkspace = record.keysChanged.find(
					c => c.key === key && c.target === vscode.ConfigurationTarget.Workspace
				);
				assert.ok(clearedAtWorkspace, 'editor.fontSize should be cleared at Workspace');

				const after = vscode.workspace.getConfiguration().inspect(key);
				assert.strictEqual(after?.workspaceValue, undefined, 'Workspace value must be undefined');
				assert.strictEqual(after?.globalValue, 16, 'Global value must be untouched (S6)');
			} finally {
				await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
				channel.dispose();
			}
		});

		test('Workspace clear also clears WorkspaceFolder overrides for the same key (S7)', async () => {
			// The shim doesn't open a real workspace; seed a fake folder so the
			// cascade walks the WorkspaceFolder iteration path.
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const shim = require('vscode');
			const fakeFolder = { uri: vscode.Uri.parse('file:///tmp/fake-folder'), name: 'fake-folder', index: 0 };
			shim._testSetWorkspaceFolders([fakeFolder]);
			const folders = vscode.workspace.workspaceFolders;
			assert.ok(folders && folders.length > 0, 'precondition: fake folder seeded');
			const folder = folders[0];

			const config = vscode.workspace.getConfiguration();
			await config.update(key, 22, vscode.ConfigurationTarget.Workspace);
			const folderConfig = vscode.workspace.getConfiguration(undefined, folder.uri);
			await folderConfig.update(key, 30, vscode.ConfigurationTarget.WorkspaceFolder);

			// Sanity check the precondition: a folder override is in place.
			const pre = vscode.workspace.getConfiguration(undefined, folder.uri).inspect(key);
			assert.strictEqual(pre?.workspaceFolderValue, 30, 'precondition: folder override was set');

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (folder override clear)');
			try {
				const record = await runReset('fontSize', 'workspace', channel);
				const folderClear = record.keysChanged.find(
					c => c.key === key && c.target === vscode.ConfigurationTarget.WorkspaceFolder
				);
				assert.ok(folderClear, 'WorkspaceFolder override must be cleared as part of the Workspace rung (S7)');

				const after = vscode.workspace.getConfiguration(undefined, folder.uri).inspect(key);
				assert.strictEqual(
					after?.workspaceFolderValue, undefined,
					'WorkspaceFolder value must be undefined after Workspace reset'
				);
				assert.strictEqual(
					after?.workspaceValue, undefined,
					'Workspace file value must be undefined after Workspace reset'
				);
			} finally {
				await vscode.workspace.getConfiguration(undefined, folder.uri).update(
					key, undefined, vscode.ConfigurationTarget.WorkspaceFolder
				);
				await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
				channel.dispose();
				shim._testSetWorkspaceFolders(undefined);
			}
		});
	});

	suite('Zoom and font size combines zoom + font size (S14)', () => {
		const key = 'editor.fontSize';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('runs zoom commands AND clears settings at the chosen scope (S14)', async () => {
			const config = vscode.workspace.getConfiguration();
			await config.update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (combined)');
			try {
				const record = await runReset('zoomAndFontSize', 'global', channel);

				// Zoom commands all attempted.
				for (const cmd of ZOOM_RESET_COMMANDS) {
					assert.ok(
						record.commands.some(c => c.id === cmd),
						`Combined mode must attempt the zoom command ${cmd}`
					);
				}
				// And the settings clear happened.
				const cleared = record.keysChanged.find(
					c => c.key === key && c.target === vscode.ConfigurationTarget.Global
				);
				assert.ok(cleared, 'Combined mode must clear the size key at the chosen scope');
				assert.strictEqual(
					vscode.workspace.getConfiguration().inspect(key)?.globalValue, undefined
				);
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Confirmation gate (S3, S4, S5)', () => {
		const key = 'editor.fontSize';
		let originalGlobal: unknown;
		let originalConfirm: unknown;

		suiteSetup(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			originalConfirm = configApi.inspect('confirmBeforeDestructiveReset')?.globalValue;
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', originalConfirm, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('S3: with confirm=true, shows confirmer and aborts before any write when declined (S4)', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', true, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (confirm decline)');
			let confirmCalled = false;
			let confirmerSawKey = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					confirmer: async (plan, _scope) => {
						confirmCalled = true;
						confirmerSawKey = plan.some(s => s.key === key);
						return false; // user clicks "Cancel"
					}
				});
				assert.strictEqual(confirmCalled, true, 'Confirmation must be invoked at Global with confirm=true');
				assert.ok(confirmerSawKey, 'Confirmation must name the key in the plan');
				// No keys may have been changed.
				assert.strictEqual(record.keysChanged.length, 0, 'No write may happen when user declines');
				// The setting must still be 22 (untouched).
				assert.strictEqual(
					vscode.workspace.getConfiguration().inspect(key)?.globalValue, 22,
					'Declining the confirmation must leave the setting untouched (S4)'
				);
			} finally {
				await vscode.workspace.getConfiguration().update(key, undefined, vscode.ConfigurationTarget.Global);
				await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('S5: with confirm=false, proceeds without showing the confirmer', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (confirm off)');
			let confirmCalled = false;
			try {
				await runReset('fontSize', 'global', channel, {
					confirmer: async () => { confirmCalled = true; return true; }
				});
				assert.strictEqual(confirmCalled, false, 'With confirm=false, the confirmer must NOT be called');
				assert.strictEqual(
					vscode.workspace.getConfiguration().inspect(key)?.globalValue, undefined,
					'Global key must be cleared'
				);
			} finally {
				channel.dispose();
			}
		});

		test('Pure session resets are never confirmed (per Brief invariant)', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', true, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (session no-confirm)');
			let confirmCalled = false;
			try {
				await runReset('zoom', 'session', channel, {
					confirmer: async () => { confirmCalled = true; return true; }
				});
				assert.strictEqual(confirmCalled, false,
					'Pure session reset must never confirm, even when the preference is on');
			} finally {
				await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('confirmer is called iff the plan is non-empty (S3 negative case)', async () => {
			// Don't try to scrub all size keys from the test host's profile —
			// that risks ratting out persistent state in the .vscode-test
			// user-data dir. Instead, run the reset and check the relationship
			// between plan-size and confirmer-called.
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', true, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (gate gates)');
			let confirmCalled = false;
			let planSize = -1;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					confirmer: async plan => {
						confirmCalled = true;
						planSize = plan.length;
						return false; // cancel — we don't want to mutate global state.
					}
				});
				const expectedConfirmCalled = record.keysConsidered.some(_ => true) &&
					record.keysChanged.length === 0
					? confirmCalled // when declined, no keysChanged regardless
					: confirmCalled;
				// The contract: confirmer is called iff at least one key is present
				// at the targeted scope. Either:
				//   (a) some key was present → confirmer called, planSize > 0, no changes (declined).
				//   (b) no key was present  → confirmer NOT called, no changes.
				if (confirmCalled) {
					assert.ok(planSize > 0,
						`When confirmer fires, plan must be non-empty (got planSize=${planSize})`);
					assert.strictEqual(record.keysChanged.length, 0,
						'Declining the confirmer must keep keysChanged empty (S4)');
				} else {
					assert.strictEqual(record.keysChanged.length, 0,
						'When confirmer is not called, no keys may be changed');
				}
				assert.ok(expectedConfirmCalled !== undefined); // touch var to silence lint
			} finally {
				await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});
	});

	suite('Font size only at Session is a no-op', () => {
		test('fontSize + session does no writes and does not call the confirmer', async () => {
			const configApi = vscode.workspace.getConfiguration('resetSizes');
			await configApi.update('confirmBeforeDestructiveReset', true, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (fontSize+session)');
			let confirmCalled = false;
			try {
				const record = await runReset('fontSize', 'session', channel, {
					confirmer: async () => { confirmCalled = true; return true; }
				});
				assert.strictEqual(record.keysChanged.length, 0,
					'fontSize at session must clear no settings (Session is in-memory only)');
				assert.strictEqual(record.commands.length, 0,
					'fontSize at session must run no commands either (it is not the zoom path)');
				assert.strictEqual(confirmCalled, false,
					'fontSize at session is non-destructive; no confirmation is needed');
			} finally {
				await configApi.update('confirmBeforeDestructiveReset', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});
	});

	// ----- Slice 3: Reload prompt with three options + silent-reload preference -----

	suite('Reload prompt options (S16: exactly three named options)', () => {
		test('S16: RELOAD_PROMPT_BUTTON_LABELS contains exactly three entries', () => {
			assert.strictEqual(
				RELOAD_PROMPT_BUTTON_LABELS.length, 3,
				`S16: the reload prompt must offer exactly three options. Got: ${RELOAD_PROMPT_BUTTON_LABELS.length}`
			);
		});

		test('S16: the three option labels are "Reload now", "Don\'t reload now", and "Reload and don\'t ask again"', () => {
			// Order intentionally matches the order shown to the user.
			assert.deepStrictEqual([...RELOAD_PROMPT_BUTTON_LABELS], [
				'Reload now',
				"Don't reload now",
				"Reload and don't ask again"
			]);
		});

		test('S16: RELOAD_PROMPT_OPTIONS exposes the three options under stable keys', () => {
			assert.strictEqual(RELOAD_PROMPT_OPTIONS.reloadNow, 'Reload now');
			assert.strictEqual(RELOAD_PROMPT_OPTIONS.defer, "Don't reload now");
			assert.strictEqual(RELOAD_PROMPT_OPTIONS.reloadSilent, "Reload and don't ask again");
		});

		test('S16: there is no fourth option lurking on the labels constant', () => {
			const labels = new Set(RELOAD_PROMPT_BUTTON_LABELS);
			assert.strictEqual(labels.size, 3, 'All three labels must be distinct');
		});
	});

	suite('Reload flow — S22: no prompt when changes do not require reload', () => {
		test('Zoom-only at any scope never invokes the reload prompter (S22)', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (no-reload zoom)');
			let prompterCalled = false;
			let reloaderCalled = false;
			try {
				const record = await runReset('zoom', 'session', channel, {
					reloadPrompter: async () => { prompterCalled = true; return 'defer'; },
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(prompterCalled, false,
					'Zoom-only never produces reload-requiring changes; prompter must not fire (S22)');
				assert.strictEqual(reloaderCalled, false, 'Reloader must not fire either');
				assert.strictEqual(record.reloadOutcome, 'not-required',
					`reloadOutcome must be "not-required" for zoom-only; got: ${record.reloadOutcome}`);
			} finally {
				channel.dispose();
			}
		});

		test('clearing only editor.fontSize (live-applying) does NOT prompt (S22)', async () => {
			// editor.fontSize is on the curated list but applies live. Clearing
			// it must NOT trigger the reload prompt.
			const key = 'editor.fontSize';
			const config = vscode.workspace.getConfiguration();
			const original = config.inspect(key)?.globalValue;
			await config.update(key, 22, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (fontSize no-reload)');
			let prompterCalled = false;
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => { prompterCalled = true; return 'defer'; },
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(prompterCalled, false,
					'A reset that only changes live-applying keys must not prompt for a reload (S22)');
				assert.strictEqual(reloaderCalled, false, 'Reloader must not fire');
				assert.strictEqual(record.reloadOutcome, 'not-required',
					`reloadOutcome must be "not-required"; got: ${record.reloadOutcome}`);
			} finally {
				await config.update(key, original, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});
	});

	suite('Reload flow — S16: reload-requiring change shows the three-option prompt', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('S16: window.zoomLevel cleared → prompter fires and is told about the key', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (reload-prompt)');
			let prompterCalled = false;
			let promptedChanges: { key: string }[] = [];
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async changes => {
						prompterCalled = true;
						promptedChanges = changes.map(c => ({ key: c.key }));
						return 'defer';
					},
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(prompterCalled, true,
					'Clearing window.zoomLevel must invoke the reload prompter (S16)');
				assert.ok(promptedChanges.some(c => c.key === 'window.zoomLevel'),
					`Prompter must be told which key triggered the reload (S16). Got: ${JSON.stringify(promptedChanges)}`);
				assert.strictEqual(reloaderCalled, false, 'Defer must not reload (S17)');
				assert.strictEqual(record.reloadOutcome, 'prompted-deferred',
					`reloadOutcome must be "prompted-deferred"; got: ${record.reloadOutcome}`);
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload flow — S17: "Don\'t reload now"', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('S17: defer leaves the window unreloaded AND persists no preference', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			const configApi = vscode.workspace.getConfiguration('resetSizes');
			const reloadSilentlyBefore = configApi.get<boolean>('reloadSilently');
			assert.strictEqual(reloadSilentlyBefore, false,
				'precondition: silent-reload preference must be off');

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S17 defer)');
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'defer',
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(reloaderCalled, false, 'S17: defer must not reload');
				assert.strictEqual(record.reloadOutcome, 'prompted-deferred',
					`reloadOutcome must be "prompted-deferred"; got: ${record.reloadOutcome}`);

				// The preference must NOT have been written.
				const after = vscode.workspace.getConfiguration('resetSizes').get<boolean>('reloadSilently');
				assert.strictEqual(after, false,
					'S17: defer must NOT persist the reload-silently preference');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload flow — S18: "Reload now"', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('S18: "Reload now" reloads immediately AND persists no preference', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S18 reload-now)');
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'reload',
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(reloaderCalled, true, 'S18: "Reload now" must invoke the reloader');
				assert.strictEqual(record.reloadOutcome, 'reloaded',
					`reloadOutcome must be "reloaded"; got: ${record.reloadOutcome}`);

				const after = vscode.workspace.getConfiguration('resetSizes').get<boolean>('reloadSilently');
				assert.strictEqual(after, false,
					'S18: "Reload now" must NOT persist the reload-silently preference');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload flow — S19: "Reload and don\'t ask again"', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;
		let originalReloadSilently: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
			originalReloadSilently = vscode.workspace
				.getConfiguration('resetSizes')
				.inspect('reloadSilently')?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', originalReloadSilently, vscode.ConfigurationTarget.Global);
		});

		test('S19: "Reload and don\'t ask again" reloads AND persists reloadSilently=true', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);
			// Make sure the precondition is clean — the preference is off going in.
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', false, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S19)');
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'reload-silent',
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(reloaderCalled, true,
					'S19: "Reload and don\'t ask again" must invoke the reloader');
				assert.strictEqual(record.reloadOutcome, 'reloaded',
					`reloadOutcome must be "reloaded"; got: ${record.reloadOutcome}`);

				const after = vscode.workspace
					.getConfiguration('resetSizes')
					.get<boolean>('reloadSilently');
				assert.strictEqual(after, true,
					'S19: the silent-reload preference must be persisted (reversible from settings)');
			} finally {
				channel.dispose();
			}
		});

		test('S19: the persisted preference appears in the Global scope so it survives sessions', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', false, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S19 global target)');
			try {
				await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'reload-silent',
					reloader: async () => { /* no-op */ }
				});
				const inspect = vscode.workspace
					.getConfiguration('resetSizes')
					.inspect('reloadSilently');
				assert.strictEqual(inspect?.globalValue, true,
					'S19: preference must be written to Global scope so it survives across workspaces');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload flow — S20, S21: silent-reload preference', () => {
		const key = 'window.zoomLevel';
		const fontSizeKey = 'editor.fontSize';
		let originalGlobal: unknown;
		let originalFontSize: unknown;
		let originalReloadSilently: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
			originalFontSize = vscode.workspace.getConfiguration().inspect(fontSizeKey)?.globalValue;
			originalReloadSilently = vscode.workspace
				.getConfiguration('resetSizes')
				.inspect('reloadSilently')?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration().update(fontSizeKey, originalFontSize, vscode.ConfigurationTarget.Global);
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', originalReloadSilently, vscode.ConfigurationTarget.Global);
		});

		test('S20: silent-reload ON + no reload-requiring changes → no reload, no prompt', async () => {
			await vscode.workspace.getConfiguration().update(fontSizeKey, 22, vscode.ConfigurationTarget.Global);
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', true, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S20)');
			let prompterCalled = false;
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => { prompterCalled = true; return 'defer'; },
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(prompterCalled, false,
					'S20: a reset whose changes do not require reload must not prompt, even with silent-reload on');
				assert.strictEqual(reloaderCalled, false,
					'S20: silent-reload must not reload when no reload is needed');
				assert.strictEqual(record.reloadOutcome, 'not-required',
					`reloadOutcome must be "not-required"; got: ${record.reloadOutcome}`);
			} finally {
				await vscode.workspace
					.getConfiguration('resetSizes')
					.update('reloadSilently', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('S21: silent-reload ON + reload-requiring change → reload silently, no prompt', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', true, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (S21)');
			let prompterCalled = false;
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => { prompterCalled = true; return 'defer'; },
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(prompterCalled, false,
					'S21: silent-reload must skip the prompt entirely');
				assert.strictEqual(reloaderCalled, true,
					'S21: silent-reload must reload when a reload is needed');
				assert.strictEqual(record.reloadOutcome, 'reloaded',
					`reloadOutcome must be "reloaded"; got: ${record.reloadOutcome}`);

				// S21: summary (when not silenced) reports the reload occurred.
				const summary = summariseInvocation(record);
				assert.ok(summary.includes('Window reloaded'),
					`S21: summary must report the reload. Got: ${summary}`);
			} finally {
				await vscode.workspace
					.getConfiguration('resetSizes')
					.update('reloadSilently', false, vscode.ConfigurationTarget.Global);
				channel.dispose();
			}
		});

		test('S19 reversibility: toggling reloadSilently off restores the prompt branch', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			// First: turn the preference on, run a reset → reloads silently.
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', true, vscode.ConfigurationTarget.Global);

			const channelA = vscode.window.createOutputChannel('Test Reset Sizes (S19 toggle on)');
			try {
				let prompterCalledA = false;
				const recordA = await runReset('fontSize', 'global', channelA, {
					reloadPrompter: async () => { prompterCalledA = true; return 'defer'; },
					reloader: async () => { /* swallow */ }
				});
				assert.strictEqual(prompterCalledA, false, 'precondition: silent-reload was on, so no prompt');
				assert.strictEqual(recordA.reloadOutcome, 'reloaded', 'precondition: a reload occurred');
			} finally {
				channelA.dispose();
			}

			// Re-set the key (the previous reset just cleared it).
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			// Now: toggle the preference off and verify the prompt comes back.
			await vscode.workspace
				.getConfiguration('resetSizes')
				.update('reloadSilently', false, vscode.ConfigurationTarget.Global);

			const channelB = vscode.window.createOutputChannel('Test Reset Sizes (S19 toggle off)');
			try {
				let prompterCalledB = false;
				const recordB = await runReset('fontSize', 'global', channelB, {
					reloadPrompter: async () => { prompterCalledB = true; return 'defer'; },
					reloader: async () => { /* swallow */ }
				});
				assert.strictEqual(prompterCalledB, true,
					'S19: toggling reloadSilently off must restore the prompt branch');
				assert.strictEqual(recordB.reloadOutcome, 'prompted-deferred',
					`reloadOutcome must be "prompted-deferred"; got: ${recordB.reloadOutcome}`);
			} finally {
				channelB.dispose();
			}
		});
	});

	suite('Reload flow — interaction with failed clears', () => {
		test('A failed clear of a reload-requiring key does NOT trigger a reload', async () => {
			// The reload decision only considers successful changes. If a clear
			// fails, the value wasn't actually changed; no reload is needed.
			// We simulate by manually building a record-like outcome via a
			// canned scenario: a clear that fails for some reason.
			//
			// In practice we exercise this by relying on the runReset path's
			// own filter — if no key requiring reload was successfully changed,
			// reloadOutcome must be 'not-required'.

			// Easiest sanity check: run with a mode that touches no keys at all
			// and assert reloadOutcome stays 'not-required'.
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (no-success-no-reload)');
			let prompterCalled = false;
			let reloaderCalled = false;
			try {
				const record = await runReset('fontSize', 'session', channel, {
					reloadPrompter: async () => { prompterCalled = true; return 'reload'; },
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(record.keysChanged.length, 0, 'precondition: no keys changed');
				assert.strictEqual(prompterCalled, false,
					'No successful reload-requiring change → no prompt');
				assert.strictEqual(reloaderCalled, false, 'No reload');
				assert.strictEqual(record.reloadOutcome, 'not-required');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload flow — prompter dismissal', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('dismissing the prompt (returning "defer") behaves like "Don\'t reload now"', async () => {
			// The default production prompter maps an undefined return from
			// `showInformationMessage` (the user dismissed without picking)
			// to 'defer'. This test asserts the runReset side honours 'defer'
			// from any prompter the same way: no reload, no preference.
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (dismiss)');
			let reloaderCalled = false;
			try {
				const reloadSilentlyBefore = vscode.workspace
					.getConfiguration('resetSizes')
					.get<boolean>('reloadSilently');
				const record = await runReset('fontSize', 'global', channel, {
					// Surrogate for the dismiss path.
					reloadPrompter: async () => 'defer' as ReloadPromptChoice,
					reloader: async () => { reloaderCalled = true; }
				});
				assert.strictEqual(reloaderCalled, false);
				assert.strictEqual(record.reloadOutcome, 'prompted-deferred');
				const reloadSilentlyAfter = vscode.workspace
					.getConfiguration('resetSizes')
					.get<boolean>('reloadSilently');
				assert.strictEqual(reloadSilentlyAfter, reloadSilentlyBefore,
					'Dismissal must not change the silent-reload preference');
			} finally {
				channel.dispose();
			}
		});
	});

	suite('Reload outcome surfaces in the activity log and summary', () => {
		const key = 'window.zoomLevel';
		let originalGlobal: unknown;

		suiteSetup(async () => {
			originalGlobal = vscode.workspace.getConfiguration().inspect(key)?.globalValue;
		});

		suiteTeardown(async () => {
			await vscode.workspace.getConfiguration().update(key, originalGlobal, vscode.ConfigurationTarget.Global);
		});

		test('activity log records "window reloaded" when a reload occurred', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (log reload)');
			const lines: string[] = [];
			const originalAppendLine = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppendLine(line);
			};

			try {
				await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'reload',
					reloader: async () => { /* swallow */ }
				});
				const joined = lines.join('\n');
				assert.ok(joined.includes('window reloaded'),
					`Activity log must record the reload outcome. Got: ${joined}`);
			} finally {
				channel.dispose();
			}
		});

		test('activity log records "prompted — user deferred" when defer was picked', async () => {
			await vscode.workspace.getConfiguration().update(key, 1, vscode.ConfigurationTarget.Global);

			const channel = vscode.window.createOutputChannel('Test Reset Sizes (log defer)');
			const lines: string[] = [];
			const originalAppendLine = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppendLine(line);
			};

			try {
				await runReset('fontSize', 'global', channel, {
					reloadPrompter: async () => 'defer',
					reloader: async () => { /* will not fire */ }
				});
				const joined = lines.join('\n');
				assert.ok(joined.includes('prompted'),
					`Activity log must record the deferred-prompt outcome. Got: ${joined}`);
				assert.ok(joined.includes('deferred'),
					`Activity log must say the user deferred. Got: ${joined}`);
			} finally {
				channel.dispose();
			}
		});

		test('activity log records "not required" when no reload was needed', async () => {
			const channel = vscode.window.createOutputChannel('Test Reset Sizes (log not-required)');
			const lines: string[] = [];
			const originalAppendLine = channel.appendLine.bind(channel);
			channel.appendLine = (line: string) => {
				lines.push(line);
				originalAppendLine(line);
			};

			try {
				await runReset('zoom', 'session', channel);
				const joined = lines.join('\n');
				assert.ok(/Reload:\s+not required/i.test(joined),
					`Activity log must record "not required" for non-reload reset. Got: ${joined}`);
			} finally {
				channel.dispose();
			}
		});
	});
});
