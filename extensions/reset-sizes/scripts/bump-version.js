const { spawnSync } = require('node:child_process');

function getCommand(base) {
	return process.platform === 'win32' ? `${base}.cmd` : base;
}

const pnpmCmd = getCommand('pnpm');

const args = process.argv.slice(2).filter(Boolean);
const bump = args[0] ?? 'patch';
const extraArgs = args.slice(1);

// `--no-git-tag-version` keeps this a pure package.json edit (no commit/tag),
// so it also works on a dirty working tree.
const result = spawnSync(pnpmCmd, ['version', bump, '--no-git-tag-version', '--allow-same-version', ...extraArgs], {
	stdio: 'inherit',
});

process.exit(result.status ?? 1);
