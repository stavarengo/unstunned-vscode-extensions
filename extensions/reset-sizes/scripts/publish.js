const { spawnSync } = require('node:child_process');

function getCommand(base) {
	return process.platform === 'win32' ? `${base}.cmd` : base;
}

const pnpmCmd = getCommand('pnpm');
const vsceCmd = getCommand('vsce');

const [maybeBump] = process.argv.slice(2);
const bumpArg = (maybeBump ?? 'patch').toLowerCase();

const build = spawnSync(pnpmCmd, ['run', 'build'], { stdio: 'inherit' });
if ((build.status ?? 1) !== 0) {
	process.exit(build.status ?? 1);
}

// Bump version first (without requiring a clean git working tree), unless the
// user asked to keep the current version.
if (!['current', 'none', 'keep'].includes(bumpArg)) {
	const bumped = spawnSync(pnpmCmd, ['run', 'bump', bumpArg], { stdio: 'inherit' });
	if ((bumped.status ?? 1) !== 0) {
		process.exit(bumped.status ?? 1);
	}
}

// Publish the current version (already bumped if requested).
const published = spawnSync(vsceCmd, ['publish'], { stdio: 'inherit' });
process.exit(published.status ?? 1);
