import * as assert from 'assert';
import { labelForScope } from '../../utils';

suite('labelForScope (S15: remote-aware Global label)', () => {

	test('returns "Session" for the session scope, regardless of remoteName', () => {
		assert.strictEqual(labelForScope('session', undefined), 'Session');
		assert.strictEqual(labelForScope('session', 'ssh-remote+myhost'), 'Session');
		assert.strictEqual(labelForScope('session', ''), 'Session');
	});

	test('returns "Workspace" for the workspace scope, regardless of remoteName', () => {
		assert.strictEqual(labelForScope('workspace', undefined), 'Workspace');
		assert.strictEqual(labelForScope('workspace', 'wsl'), 'Workspace');
	});

	test('returns "Global" for the global scope when there is no remote', () => {
		assert.strictEqual(labelForScope('global', undefined), 'Global');
		assert.strictEqual(labelForScope('global', ''), 'Global');
	});

	test('returns "User settings (remote)" for the global scope when remoteName is set (S15)', () => {
		assert.strictEqual(labelForScope('global', 'ssh-remote+myhost'), 'User settings (remote)');
		assert.strictEqual(labelForScope('global', 'wsl'), 'User settings (remote)');
		assert.strictEqual(labelForScope('global', 'attached-container+abc'), 'User settings (remote)');
	});
});
