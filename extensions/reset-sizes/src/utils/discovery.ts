/**
 * Size-key discovery (ADR 0003).
 *
 * Discovery answers the question "which configuration keys belong to the size
 * family the extension owns?". The contract combines two strategies:
 *
 * 1. A curated, in-source list of well-known size keys that are always
 *    recognised regardless of where they live in the user's configuration.
 * 2. Suffix patterns. Any key whose lowercased form ends in a recognised
 *    suffix token (e.g. `fontsize`, `lineheight`, `zoomlevel`) is treated as
 *    in-family. This is what catches third-party extensions' size settings
 *    and VS Code keys like `editor.codeLensFontSize` that aren't on the list.
 *
 * The contract is closed: nothing else is touched. In particular, keys under
 * the extension's own namespace (`resetSizes.*`) are excluded from both paths
 * so a Global reset cannot remove the user's own preferences (S32).
 */

/**
 * Prefix the extension uses for its own preference keys. Any key under this
 * namespace is hard-excluded from discovery so resets never clear the
 * extension's own settings (S32).
 */
export const EXTENSION_NAMESPACE_PREFIX = 'resetSizes.';

/**
 * Curated list of well-known size-family keys. These are always considered
 * regardless of whether the user has set them. Keep entries focused on
 * size-family vocabulary VS Code itself ships; third-party keys are caught by
 * the suffix pattern below.
 */
export const CURATED_SIZE_KEYS: readonly string[] = Object.freeze([
	'editor.fontSize',
	'editor.lineHeight',
	'editor.codeLensFontSize',
	'editor.suggestFontSize',
	'editor.suggestLineHeight',
	'editor.inlayHints.fontSize',
	'terminal.integrated.fontSize',
	'terminal.integrated.lineHeight',
	'window.zoomLevel',
	'window.zoomPerWindow',
	'debug.console.fontSize',
	'debug.console.lineHeight',
	'markdown.preview.fontSize',
	'markdown.preview.lineHeight',
	'scm.inputFontSize',
	'chat.editor.fontSize',
	'chat.editor.lineHeight',
	'notebook.markup.fontSize',
	'notebook.output.fontSize',
	'notebook.output.lineHeight'
]);

/**
 * Size-family suffix tokens. A key whose lowercased form ends in one of these
 * tokens is treated as size-family. Suffixes are matched case-insensitively;
 * `editor.codeLensFontSize` (camel-cased) matches `fontSize` here.
 *
 * Adding or removing a suffix is a behavioural change (the suffix set is part
 * of ADR 0003's public contract). Do not extend casually.
 */
export const SIZE_KEY_SUFFIXES: readonly string[] = Object.freeze([
	'fontSize',
	'lineHeight',
	'zoomLevel'
]);

const SIZE_KEY_SUFFIXES_LOWER: readonly string[] = SIZE_KEY_SUFFIXES.map(s => s.toLowerCase());

/**
 * Return true if `key` is a member of the size family per ADR 0003.
 *
 * Curated keys always qualify. Otherwise, the lowercased key must end in one
 * of the recognised suffix tokens (`fontsize`, `lineheight`, `zoomlevel`).
 * Keys under the extension's own namespace are explicitly excluded so the
 * extension cannot reset its own preferences (S32).
 */
export function isSizeFamilyKey(key: string): boolean {
	if (key.startsWith(EXTENSION_NAMESPACE_PREFIX)) {
		return false;
	}
	if (CURATED_SIZE_KEYS.includes(key)) {
		return true;
	}
	const lower = key.toLowerCase();
	return SIZE_KEY_SUFFIXES_LOWER.some(suffix => lower.endsWith(suffix));
}

/**
 * Recursively flatten a nested configuration object into dotted-path keys.
 *
 * Used by discovery to enumerate every configuration key present in the
 * resolved configuration tree, so suffix-matching can find third-party size
 * keys. Arrays are treated as leaves (not recursed into).
 *
 * Pure function — does not touch VS Code APIs. Tests pass plain objects.
 */
export function flattenConfigKeys(obj: unknown, prefix = ''): string[] {
	if (obj === null || obj === undefined) {
		return [];
	}
	if (typeof obj !== 'object' || Array.isArray(obj)) {
		// Primitive leaf or array — treat the prefix as a key if there is one.
		return prefix ? [prefix] : [];
	}
	const result: string[] = [];
	for (const segment of Object.keys(obj as Record<string, unknown>)) {
		const value = (obj as Record<string, unknown>)[segment];
		const path = prefix ? `${prefix}.${segment}` : segment;
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			result.push(...flattenConfigKeys(value, path));
		} else {
			result.push(path);
		}
	}
	return result;
}

/**
 * Compute the set of "considered" keys for an invocation against a resolved
 * configuration tree (the value returned by `vscode.workspace.getConfiguration()`
 * with no section). The result is the union of:
 *
 * - Every curated key (always considered, even if absent from the tree).
 * - Every key found in the tree whose name passes `isSizeFamilyKey`.
 *
 * Order is deterministic: curated keys first (in their listed order), then
 * suffix-matched keys (sorted alphabetically) that aren't already on the
 * curated list. Duplicates are dropped.
 */
export function discoverCandidateKeys(rootConfig: unknown): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const key of CURATED_SIZE_KEYS) {
		if (!seen.has(key)) {
			seen.add(key);
			ordered.push(key);
		}
	}
	const flat = flattenConfigKeys(rootConfig);
	const matched = flat.filter(isSizeFamilyKey).sort();
	for (const key of matched) {
		if (!seen.has(key)) {
			seen.add(key);
			ordered.push(key);
		}
	}
	return ordered;
}
