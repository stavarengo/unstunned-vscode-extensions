// Pure-Node shim for the `vscode` module. Used at test time only — the real
// `vscode` module is injected by the VS Code extension host at runtime in
// production. This shim is exposed to Node via a `file:` devDependency that
// places it at `node_modules/vscode/`; production type-checking comes from
// `@types/vscode`.
//
// Only the symbols our production code and tests reach for are exposed. If a
// new `vscode.*` symbol appears in production or tests, add a fixture-shaped
// implementation here. We do not try to be a complete VS Code emulator.

'use strict';

const ConfigurationTarget = Object.freeze({
	Global: 1,
	Workspace: 2,
	WorkspaceFolder: 3,
});

const ViewColumn = Object.freeze({
	Active: -1,
	Beside: -2,
	One: 1,
	Two: 2,
	Three: 3,
	Four: 4,
	Five: 5,
	Six: 6,
	Seven: 7,
	Eight: 8,
	Nine: 9,
});

class Uri {
	constructor(scheme, authority, pathPart, query, fragment, fsPath) {
		this.scheme = scheme;
		this.authority = authority;
		this.path = pathPart;
		this.query = query;
		this.fragment = fragment;
		this.fsPath = fsPath;
	}

	static parse(value) {
		const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(value);
		if (!match) {
			return new Uri('file', '', value, '', '', value);
		}
		const [, scheme, authority = '', pathPart = '', query = '', fragment = ''] = match;
		return new Uri(scheme, authority, pathPart, query, fragment, pathPart);
	}

	static file(p) {
		return new Uri('file', '', p, '', '', p);
	}

	toString() {
		const auth = this.authority ? `//${this.authority}` : '';
		const query = this.query ? `?${this.query}` : '';
		const fragment = this.fragment ? `#${this.fragment}` : '';
		return `${this.scheme}:${auth}${this.path}${query}${fragment}`;
	}
}

function noopDisposable() {
	return { dispose: () => undefined };
}

function makeOutputChannel(name) {
	const lines = [];
	return {
		name,
		append(value) {
			lines.push(value);
		},
		appendLine(value) {
			lines.push(value);
		},
		clear() {
			lines.length = 0;
		},
		show() {
			// no-op
		},
		hide() {
			// no-op
		},
		dispose() {
			// no-op
		},
		_lines: lines,
	};
}

// Backed by a shared in-memory store keyed by (section + key) so multiple
// `getConfiguration()` calls see the same state during a test.
const _configStore = new Map();

function _storeKey(section, key) {
	return section ? `${section}.${key}` : key;
}

// Builds the nested tree view of the in-memory store that mirrors how real VS
// Code exposes a `WorkspaceConfiguration` — keys become enumerable own
// properties so `flattenConfigKeys(rootConfig)` (production discovery) finds
// suffix-matched third-party keys.
function _buildConfigTree(section) {
	const tree = {};
	const prefix = section ? `${section}.` : '';
	for (const [k, entry] of _configStore.entries()) {
		if (section && !k.startsWith(prefix) && k !== section) continue;
		const relKey = section ? (k === section ? '' : k.slice(prefix.length)) : k;
		if (!relKey) continue;
		const effective = entry.workspaceFolder !== undefined ? entry.workspaceFolder
			: entry.workspace !== undefined ? entry.workspace
				: entry.global !== undefined ? entry.global : undefined;
		if (effective === undefined) continue;
		const parts = relKey.split('.');
		let cur = tree;
		for (let i = 0; i < parts.length - 1; i++) {
			if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null || Array.isArray(cur[parts[i]])) {
				cur[parts[i]] = {};
			}
			cur = cur[parts[i]];
		}
		cur[parts[parts.length - 1]] = effective;
	}
	return tree;
}

function makeConfiguration(section = '', resource = undefined) {
	const tree = _buildConfigTree(section);
	const api = {
		_resource: resource,
		get(s, defaultValue) {
			const k = _storeKey(section, s);
			const entry = _configStore.get(k);
			if (!entry) return defaultValue;
			const value = entry.workspaceFolder ?? entry.workspace ?? entry.global;
			return value === undefined ? defaultValue : value;
		},
		has(s) {
			return _configStore.has(_storeKey(section, s));
		},
		inspect(s) {
			const k = _storeKey(section, s);
			const entry = _configStore.get(k);
			return {
				key: k,
				globalValue: entry?.global,
				workspaceValue: entry?.workspace,
				workspaceFolderValue: entry?.workspaceFolder,
			};
		},
		async update(s, value, target) {
			const k = _storeKey(section, s);
			const entry = _configStore.get(k) ?? {};
			const t = target === true ? ConfigurationTarget.Global
				: target === false ? ConfigurationTarget.Workspace
					: target ?? ConfigurationTarget.Workspace;
			// Mirror VS Code: a WorkspaceFolder update requires the config to be
			// obtained with a resource URI; otherwise the API rejects with an
			// error. Production code uses this rejection as a partial-failure
			// signal (captured via try/catch and surfaced as data).
			if (t === ConfigurationTarget.WorkspaceFolder && !resource) {
				throw new Error('Unable to write to WorkspaceFolder Settings because no resource is provided.');
			}
			if (t === ConfigurationTarget.Global) {
				if (value === undefined) delete entry.global;
				else entry.global = value;
			} else if (t === ConfigurationTarget.Workspace) {
				if (value === undefined) delete entry.workspace;
				else entry.workspace = value;
			} else {
				if (value === undefined) delete entry.workspaceFolder;
				else entry.workspaceFolder = value;
			}
			_configStore.set(k, entry);
		},
	};
	// Make the API methods non-enumerable so `flattenConfigKeys(rootConfig)`
	// (which walks `Object.keys`) sees only the actual configuration tree, not
	// our shim's plumbing.
	const result = {};
	for (const propName of Object.keys(api)) {
		Object.defineProperty(result, propName, {
			value: api[propName],
			enumerable: false,
			configurable: true,
			writable: true,
		});
	}
	// Layer the configuration tree on top as enumerable own properties.
	for (const k of Object.keys(tree)) {
		result[k] = tree[k];
	}
	return result;
}

function _testResetConfigStore() {
	_configStore.clear();
}

const workspace = {
	getConfiguration(section, resource) {
		return makeConfiguration(section, resource);
	},
	workspaceFolders: undefined,
	onDidChangeConfiguration() {
		return noopDisposable();
	},
	onDidChangeWorkspaceFolders() {
		return noopDisposable();
	},
};

const window = {
	createOutputChannel(name) {
		return makeOutputChannel(name);
	},
	showErrorMessage() {
		return Promise.resolve(undefined);
	},
	showInformationMessage() {
		return Promise.resolve(undefined);
	},
	showWarningMessage() {
		return Promise.resolve(undefined);
	},
	showQuickPick() {
		return Promise.resolve(undefined);
	},
};

// Built-in command prefixes the shim accepts as "registered" — anything
// outside this set rejects with `command '<id>' not found`, mirroring real
// VS Code's behaviour when an extension calls a command that isn't loaded.
// This lets `executeVSCodeCommand`'s capture-failure-as-data path be tested.
const _KNOWN_COMMAND_PREFIXES = ['workbench.action.', 'editor.action.', 'terminal.action.', 'notebook.action.'];

const commands = {
	registerCommand() {
		return noopDisposable();
	},
	executeCommand(id) {
		if (typeof id === 'string' && _KNOWN_COMMAND_PREFIXES.some(p => id.startsWith(p))) {
			return Promise.resolve(undefined);
		}
		return Promise.reject(new Error(`command '${id}' not found`));
	},
	getCommands() {
		return Promise.resolve([]);
	},
};

const env = {
	remoteName: undefined,
};

const extensions = {
	all: [],
};

function _testSetRemoteName(value) {
	env.remoteName = value;
}

function _testSetExtensions(list) {
	extensions.all = list;
}

function _testSetWorkspaceFolders(folders) {
	workspace.workspaceFolders = folders;
}

module.exports = {
	ConfigurationTarget,
	ViewColumn,
	Uri,
	workspace,
	window,
	commands,
	env,
	extensions,
	_testResetConfigStore,
	_testSetRemoteName,
	_testSetExtensions,
	_testSetWorkspaceFolders,
};
