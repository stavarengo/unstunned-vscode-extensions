/**
 * Reload-required classification (Slice 3).
 *
 * Some size-family keys only take effect after the VS Code window has been
 * reloaded — VS Code reads them at startup, not on every change. The classic
 * example is `window.zoomLevel`. Most size keys (every font size, line height,
 * code-lens, suggest, terminal, notebook, etc.) apply live and need no reload.
 *
 * The classification is conservative: only keys we can confirm require a reload
 * are listed. Adding or removing an entry is a behavioural change visible to
 * users (whether or not they get prompted), so do not extend casually.
 *
 * Third-party suffix-matched keys default to "no reload required". Even when a
 * particular extension's setting *would* need a reload, we have no way to know,
 * and a spurious reload prompt is more disruptive than a missed one (the user
 * can manually reload from the Command Palette if a change appears not to have
 * taken effect).
 */

/**
 * Keys whose clearing requires a window reload to fully take effect. The set
 * is closed and curated — no suffix matching is applied to the reload
 * decision.
 */
export const RELOAD_REQUIRED_KEYS: ReadonlySet<string> = new Set<string>([
	'window.zoomLevel'
]);

/**
 * Return true if changing `key` requires a window reload to fully take effect.
 *
 * Pure function so the rule is unit-testable without VS Code.
 */
export function requiresReload(key: string): boolean {
	return RELOAD_REQUIRED_KEYS.has(key);
}
