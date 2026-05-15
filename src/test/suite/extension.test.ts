import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

async function activateExtension(): Promise<void> {
	const ext = vscode.extensions.all.find(
		e => e.packageJSON?.name === 'reset-sizes-extension'
	);
	if (ext && !ext.isActive) {
		await ext.activate();
	}
}

suite('Extension Activation Test Suite', () => {

	suiteSetup(async () => {
		await activateExtension();
	});

	test('S26: resetSizes.openActivityLog is registered (one of three log entry points)', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('resetSizes.openActivityLog'),
			'Activity log Command Palette entry must be contributed'
		);
	});

	test('S34: resetSizes.resetAll is registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('resetSizes.resetAll'),
			'Reset command must be contributed so users can bind their own shortcut'
		);
	});

	test('S26: resetSizes.openActivityLog executes without throwing', async () => {
		// Smoke: invoking the command should reveal the channel without error.
		await vscode.commands.executeCommand('resetSizes.openActivityLog');
		assert.ok(true);
	});

	test('S34: extension manifest does NOT contribute a default keybinding', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension, 'Extension should be discoverable in the host');
		const keybindings = extension.packageJSON?.contributes?.keybindings;
		assert.ok(
			!keybindings || (Array.isArray(keybindings) && keybindings.length === 0),
			'No default keybinding may be shipped (S34)'
		);
	});

	test('S35: manifest contributes no "preset" enum with a "custom" value', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension, 'Extension should be discoverable in the host');
		const props = extension.packageJSON?.contributes?.configuration?.properties ?? {};
		// The old preset surface is gone — modes are picked interactively.
		assert.ok(
			!('resetSizes.preset' in props),
			'resetSizes.preset must not appear in the manifest (modes are picker-driven now)'
		);
		assert.ok(
			!('resetSizes.commands' in props),
			'resetSizes.commands must not appear in the manifest'
		);
		assert.ok(
			!('resetSizes.settingsToReset' in props),
			'resetSizes.settingsToReset must not appear in the manifest'
		);
		assert.ok(
			!('resetSizes.scopes' in props),
			'resetSizes.scopes must not appear in the manifest'
		);
		assert.ok(
			!('resetSizes.reloadAfter' in props),
			'resetSizes.reloadAfter must not appear in the manifest'
		);
	});

	test('Manifest contributes resetSizes.confirmBeforeDestructiveReset (default true)', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const props = extension.packageJSON?.contributes?.configuration?.properties ?? {};
		assert.ok(
			'resetSizes.confirmBeforeDestructiveReset' in props,
			'New preference must be declared'
		);
		assert.strictEqual(
			props['resetSizes.confirmBeforeDestructiveReset'].default,
			true,
			'Default must be true (safe-by-default)'
		);
	});

	test('S19: manifest contributes resetSizes.reloadSilently (default false, reversible from settings)', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const props = extension.packageJSON?.contributes?.configuration?.properties ?? {};
		assert.ok(
			'resetSizes.reloadSilently' in props,
			'S19: silent-reload preference must be declared as a settings-page toggle'
		);
		assert.strictEqual(
			props['resetSizes.reloadSilently'].type,
			'boolean',
			'reloadSilently must be a boolean'
		);
		assert.strictEqual(
			props['resetSizes.reloadSilently'].default,
			false,
			'S19 default off: the prompt is shown until the user opts in'
		);
	});

	test('S26: showSummaryNotification description carries a command link to the activity log', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const prop = extension.packageJSON
			?.contributes?.configuration?.properties?.['resetSizes.showSummaryNotification'];
		assert.ok(prop, 'showSummaryNotification must be declared');
		const md: string = prop.markdownDescription ?? '';
		assert.ok(
			md.includes('command:resetSizes.openActivityLog'),
			'Settings-page markdown must link to the activity log command'
		);
	});

	test('S27: resetSizes.openPreview is registered (Command Palette entry point)', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('resetSizes.openPreview'),
			'S27: Preview command must be contributed for the Command Palette entry point'
		);
	});

	test('S27: settings page markdown links to the preview command (second entry point)', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const props = extension.packageJSON
			?.contributes?.configuration?.properties ?? {};
		// The link can live on any settings-page property; we assert at least
		// one configuration property's markdownDescription carries the link.
		// (Current implementation: on showSummaryNotification, alongside the
		// activity-log link.)
		const allMarkdown = Object.values(props)
			.map((p: unknown) => (p as { markdownDescription?: string }).markdownDescription ?? '')
			.join('\n');
		assert.ok(
			allMarkdown.includes('command:resetSizes.openPreview'),
			'S27: at least one settings-page markdown description must link to the preview command'
		);
	});

	test('Manifest activation events include the new preview command', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const events: string[] = extension.packageJSON?.activationEvents ?? [];
		assert.ok(
			events.includes('onCommand:resetSizes.openPreview'),
			'Activation events must fire on the preview command so the panel registers on demand'
		);
	});

	test('S30: manifest contributes resetSizes.showInActivityBar (default false)', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const props = extension.packageJSON?.contributes?.configuration?.properties ?? {};
		assert.ok(
			'resetSizes.showInActivityBar' in props,
			'S30: showInActivityBar must be declared so the user can opt in via the settings page'
		);
		assert.strictEqual(
			props['resetSizes.showInActivityBar'].type,
			'boolean',
			'showInActivityBar must be a boolean'
		);
		assert.strictEqual(
			props['resetSizes.showInActivityBar'].default,
			false,
			'S30: default off — a fresh install shows no icon'
		);
	});

	test('S30/S31: manifest contributes the Activity Bar view container', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const containers = extension.packageJSON?.contributes?.viewsContainers?.activitybar ?? [];
		assert.ok(
			Array.isArray(containers) && containers.length > 0,
			'S31: at least one activitybar view container must be contributed'
		);
		const ours = containers.find((c: { id: string }) => c.id === 'resetSizes.activityBarContainer');
		assert.ok(ours, 'View container resetSizes.activityBarContainer must be declared');
		assert.strictEqual(ours.title, 'Reset Sizes', 'Container title must be "Reset Sizes"');
		assert.ok(typeof ours.icon === 'string' && ours.icon.length > 0,
			'Container must declare an icon path');
	});

	test('S30/S31: container icon file exists in the extension', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const containers = extension.packageJSON?.contributes?.viewsContainers?.activitybar ?? [];
		const ours = containers.find((c: { id: string }) => c.id === 'resetSizes.activityBarContainer');
		assert.ok(ours);
		const iconPath = path.resolve(extension.extensionPath, ours.icon);
		assert.ok(fs.existsSync(iconPath),
			`Activity Bar icon file must exist at the path declared in the manifest (${iconPath})`);
	});

	test('S30/S31: manifest contributes a view inside the Reset Sizes container, gated by the setting', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const viewsMap = extension.packageJSON?.contributes?.views ?? {};
		const views = viewsMap['resetSizes.activityBarContainer'] ?? [];
		assert.ok(Array.isArray(views) && views.length > 0,
			'S31: at least one view must be contributed inside the Activity Bar container');
		const ours = views.find((v: { id: string }) => v.id === 'resetSizes.activityBarView');
		assert.ok(ours, 'View resetSizes.activityBarView must be declared');
		assert.strictEqual(
			ours.when,
			'config.resetSizes.showInActivityBar',
			'S30/S31: the view\'s when-clause must reference the setting directly so the workbench gates visibility without activating the extension'
		);
	});

	test('S31: activation events include onView for the activity bar view', () => {
		const extension = vscode.extensions.all.find(
			e => e.packageJSON?.name === 'reset-sizes-extension'
		);
		assert.ok(extension);
		const events: string[] = extension.packageJSON?.activationEvents ?? [];
		assert.ok(
			events.includes('onView:resetSizes.activityBarView'),
			'S31: extension must activate when the user opens the Activity Bar view so the provider is registered in time'
		);
	});
});
