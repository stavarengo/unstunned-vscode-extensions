import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const manifest = require('../../../package.json');

// Schema constraints enforced by VS Code at extension-load time. These
// rules are documented obliquely in https://code.visualstudio.com/api/references/contribution-points
// but VS Code's manifest validator is the actual authority. Each rule below
// captures one constraint that, if violated, prints a runtime warning on the
// Extensions page and causes the affected contribution to be ignored.

suite('Manifest schema constraints', () => {

	test('viewsContainers[*].id matches [A-Za-z0-9_-]+', () => {
		const containers = (manifest.contributes?.viewsContainers ?? {});
		const locations = Object.keys(containers);
		for (const location of locations) {
			const entries: Array<{ id: string }> = containers[location] ?? [];
			for (const c of entries) {
				assert.match(c.id, /^[A-Za-z0-9_-]+$/,
					`Container id "${c.id}" in viewsContainers.${location} must match [A-Za-z0-9_-]+ (no dots/colons) — VS Code rejects ids with other characters at runtime.`);
			}
		}
	});

	test('views[<container>][*].id matches [A-Za-z0-9_-]+', () => {
		const views = (manifest.contributes?.views ?? {}) as Record<string, Array<{ id: string }>>;
		for (const containerId of Object.keys(views)) {
			for (const v of views[containerId] ?? []) {
				assert.match(v.id, /^[A-Za-z0-9_-]+$/,
					`View id "${v.id}" in views["${containerId}"] must match [A-Za-z0-9_-]+ — VS Code rejects ids with other characters at runtime.`);
			}
		}
	});

	test('views[<container>] references a declared viewsContainer', () => {
		const containers = (manifest.contributes?.viewsContainers ?? {}) as Record<string, Array<{ id: string }>>;
		const declaredContainerIds = new Set<string>();
		for (const location of Object.keys(containers)) {
			for (const c of containers[location] ?? []) {
				declaredContainerIds.add(c.id);
			}
		}
		const views = (manifest.contributes?.views ?? {}) as Record<string, unknown>;
		for (const containerId of Object.keys(views)) {
			// VS Code's built-in containers ("explorer", "scm", "debug", "test")
			// are valid attachment points without being declared by an
			// extension. Allow any container we declared ourselves OR a
			// well-known built-in.
			const builtinContainers = new Set(['explorer', 'scm', 'debug', 'test', 'remote']);
			assert.ok(
				declaredContainerIds.has(containerId) || builtinContainers.has(containerId),
				`views["${containerId}"] references a container that is neither declared in viewsContainers nor a built-in. VS Code reports: "View container '${containerId}' does not exist".`
			);
		}
	});

	test('commands[*].command is a non-empty string', () => {
		const commands = manifest.contributes?.commands ?? [];
		for (const c of commands as Array<{ command: string; title: string }>) {
			assert.ok(typeof c.command === 'string' && c.command.length > 0,
				`Command entry must declare a non-empty "command" id; got: ${JSON.stringify(c)}`);
			assert.ok(typeof c.title === 'string' && c.title.length > 0,
				`Command "${c.command}" must declare a non-empty "title".`);
		}
	});

	test('configuration.properties keys use the dotted namespace pattern', () => {
		const props = manifest.contributes?.configuration?.properties ?? {};
		for (const key of Object.keys(props)) {
			// VS Code accepts a wider character set for property keys than for
			// view/container ids. Dots ARE allowed here (and idiomatic). Reject
			// only obviously malformed keys (empty, leading/trailing dot,
			// whitespace).
			assert.match(key, /^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/,
				`Configuration property key "${key}" must look like "namespace.identifier" (alphanumeric + dots).`);
		}
	});

	test('activationEvents that reference commands point at declared commands', () => {
		const events: string[] = manifest.activationEvents ?? [];
		const declaredCommands = new Set(
			(manifest.contributes?.commands ?? []).map((c: { command: string }) => c.command)
		);
		for (const event of events) {
			if (event.startsWith('onCommand:')) {
				const referenced = event.slice('onCommand:'.length);
				assert.ok(declaredCommands.has(referenced),
					`activationEvent "${event}" references command "${referenced}" which is not declared in contributes.commands. The activation would never fire from the Command Palette.`);
			}
		}
	});

	test('activationEvents that reference views point at declared views', () => {
		const events: string[] = manifest.activationEvents ?? [];
		const views = (manifest.contributes?.views ?? {}) as Record<string, Array<{ id: string }>>;
		const declaredViewIds = new Set<string>();
		for (const containerId of Object.keys(views)) {
			for (const v of views[containerId] ?? []) {
				declaredViewIds.add(v.id);
			}
		}
		for (const event of events) {
			if (event.startsWith('onView:')) {
				const referenced = event.slice('onView:'.length);
				assert.ok(declaredViewIds.has(referenced),
					`activationEvent "${event}" references view "${referenced}" which is not declared in contributes.views. VS Code logs a warning and the activation never fires.`);
			}
		}
	});
});
