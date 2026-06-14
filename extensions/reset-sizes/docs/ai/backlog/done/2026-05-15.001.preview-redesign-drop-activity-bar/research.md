# Research — Preview view redesign

External references and design primitives the brief agent should weigh when framing the Preview redesign. Not a recommendation — a survey.

The Preview shows a closed 3-mode × 3-scope grid of "what would change if you ran the reset right now." Each of the 9 cells has: keys that would be cleared (often empty), zoom commands that would run (a fixed list or empty), a reload-required hint (sometimes), a "Run reset" action. The webview is read-only and postMessage-only; nothing here may change that.

## 1. Pattern library inside VS Code

Two native surfaces are well-documented and worth studying:

- **Settings editor.** Settings are grouped into expandable categories, with a search box and operators like `@modified` to filter to what differs from default — i.e. it treats "nothing here is interesting" as a first-class filter, not a layout problem. ([learn](https://stevekinney.com/courses/visual-studio-code/editing-settings-through-the-vs-code-ui), [extension hint](https://www.eliostruyf.com/splitting-vscode-extension-settings-multiple-categories/)) Take-away for Preview: grouping + filter > rendering every option at equal weight.
- **Source Control view.** Two stacked, labelled sections (Staged / Changes), per-row hover-revealed actions, file-status letters (M/U/D) carrying meta. ([docs](https://code.visualstudio.com/docs/sourcecontrol/staging-commits)) Take-away: stacked named sections with light per-row metadata read faster than a uniform grid.

Author observation of VS Code (no fetched citation): the **Extensions view** uses card-style rows with title + short description + a single primary install button; the **Run & Debug** view has a stacked layout with the primary "Run" action large and one-line variant labels underneath. Both reserve a single strong primary action per row instead of repeating it. Treat these as design references for the redesign, not as authoritative citations.

## 2. VS Code webview design guidelines

- **Use theme variables, not literal colors.** Inherit `--vscode-foreground`, `--vscode-editor-background`, `--vscode-editor-font-family`, `--vscode-descriptionForeground`, `--vscode-panel-border`, `--vscode-button-background/-foreground/-hoverBackground`, `--vscode-button-secondaryBackground/-secondaryForeground`, `--vscode-list-hoverBackground`, `--vscode-badge-background/-foreground`, `--vscode-editorWarning-foreground`. The current renderer already uses several of these — the redesign should not regress to hardcoded values. ([theming](https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content), [color reference](https://code.visualstudio.com/api/references/theme-color))
- **Accessibility classes are first-class.** The body gets `vscode-light` / `vscode-dark` / `vscode-high-contrast`, plus `vscode-using-screen-reader` and `vscode-reduce-motion` on user preference. High-contrast testing is required. ([webview guide](https://code.visualstudio.com/api/extension-guides/webview#accessibility))
- **Feel native, not foreign.** Official guidance: webviews are a last resort, must be themeable, accessible (ARIA, keyboard, contrast), and shouldn't duplicate native surfaces like Settings or Welcome. ([UX guidelines](https://code.visualstudio.com/api/ux-guidelines/webviews))
- **No external assets** is already a hard constraint of our CSP — nothing in the redesign may pull external fonts, icons, or styles.

## 3. Matrix vs list vs cards for a 3×3 of decisions

Tables/grids are right when *column-wise comparison is the user's job* — sorting, filtering, scanning many fields across many items. Cards are right when *each item is self-contained* and visuals carry decision weight. ([Primer DataTable](https://primer.style/components/data-table/), [Atlassian Dynamic Table](https://atlassian.design/components/dynamic-table), [UX Patterns](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards))

For this Preview the closed 3×3 is small enough that all three primitives are viable:

- **Matrix** is honest about the relationship — mode × scope is intrinsically two-dimensional, and that structure is meaningful (the "cascade" runs along the scope axis).
- **Stacked list grouped by mode** drops the column-as-structure in favor of a vertical reading order — users almost always pick a mode first.
- **Master–detail** (a picker on the left, one detail pane on the right) is a strong fit when each cell has substantial content and the user only inspects one at a time. ([Oracle Alta pattern](https://www.oracle.com/webfolder/ux/middleware/alta/patterns/masterdetail.html), [webapphuddle](https://webapphuddle.com/master-detail-ui-pattern-design/)) Trade-off: it removes at-a-glance comparison across cells.

A decision matrix is by definition rows-as-options × columns-as-criteria — the labels must be visually distinct from the cell body, or the matrix collapses into nine unrelated paragraphs. ([NN/G prioritization matrices](https://www.nngroup.com/articles/prioritization-matrices/))

## 4. Density and scanability

Users **don't read** a wall of text — they scan in F-shape, layer-cake, or spotted patterns depending on how the page is structured. The most reliable lifters:

- **Meaningful subheadings** so a layer-cake scan works. ([NN/G F-shaped](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/), [text scanning](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/))
- **Bulleted lists** for short parallel items (each cell's "keys that would be cleared" is exactly this).
- **Visual styling for keywords** — type, weight, color.
- **Hierarchy by weight/size/color**, not gray-on-gray. Primary actions should be visually obvious (solid, high contrast); secondary actions clearly less prominent (outline or low-contrast). Every page has one true primary action. ([Refactoring UI summary](https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886))
- **Consistent alignment** — left-align text, right-align numbers; row/column labels styled distinctly from body. ([Magnimind table UX](https://magnimindacademy.com/blog/designing-data-tables-essential-ux-principles-for-analysts/))

The current Preview violates most of these: row/column labels are not visually distinguished, every cell uses the same paragraph rhythm, and the "Run reset" button repeats verbose label text nine times.

## 5. Empty state / "no change" treatment

An empty cell here means "running this combination right now would change nothing." It must look different from a busy cell, but should not look broken. Industry guidance:

- Empty states are placeholders that *inform*, not just blank space; they step in to guide rather than leave the user lost. ([Basis design system](https://design.basis.com/components/empty-state), [Pearson, Rareview](https://medium.com/rareview/ui-design-for-empty-states-zero-data-and-on-boarding-264cdb92826e))
- Subtle, low-contrast styling using `--vscode-descriptionForeground` (the same token used for the existing "none" placeholder) is already idiomatic for VS Code.
- A no-op cell should still convey *why* it's empty (e.g. "Session zoom is at default" or "No matching keys set at this scope") — silence is more confusing than a one-line caption.
- Action affordance should follow: a cell with nothing to do should not surface an active primary button, or should disable/demote it.

## 6. Three concrete design directions

Three orthogonal primitives — not three flavors of the same idea. Each preserves all 9 outcomes, the read-only contract, the postMessage-only action path, and the remote-adaptive Global label. The brief agent picks one or hybridizes.

### A. Matrix, rebuilt with hierarchy

Keep the 3×3 table; fix what makes it unreadable. Strong column headers and row labels (weight + tinted background), per-cell condensed summary line ("3 keys, reload required") above the detail lists, empty cells rendered as a single muted line with no button, primary button per cell uses `--vscode-button-background` so it actually stands out, and one shared legend at the top explains the icons/badges.

```
            Session     Workspace    User settings (remote)
Zoom        [3 cmds]    -- empty --  -- empty --
Font size   -- empty -- [2 keys *]   [4 keys *]
Both        [3 cmds]    [2 keys *]   [4 keys * ⟳]
                                     * = setting cleared, ⟳ = reload
```

**Strongest tradeoff:** stays closest to today's structure (low risk, low surprise), but a 3-column table in a narrow webview still risks horizontal cramping; cell content has a hard ceiling.

### B. Stacked sections by mode, scope as sub-rows

Drop the matrix as a layout. Three collapsible sections (Zoom / Font size / Both); inside each, three scope rows in a list style modelled on the Source Control view: row label, status badge, optional expandable detail, single right-aligned primary action.

```
Zoom only                                       [collapse ⌃]
  Session         3 zoom commands               [Run]
  Workspace       nothing to clear              (no action)
  User settings   nothing to clear              (no action)

Font size only                                  [collapse ⌃]
  Session         nothing to clear              (no action)
  Workspace       2 keys                        [Run]
  User settings   4 keys, reload required ⟳     [Run]
```

**Strongest tradeoff:** scans top-to-bottom and matches the way users actually pick (mode first, scope second), but loses the side-by-side comparison across scopes within a mode.

### C. Master–detail picker + single detail pane

A compact picker on the left (3 modes × 3 scopes as a tight 3×3 of small tiles, each showing a one-glance badge: "3", "—", "⟳"); a single detail pane on the right showing the currently selected cell in full — keys list, zoom commands list, reload hint, primary "Run reset" button (no verbose label needed, the pane heading carries the context).

```
+-----------------+ +------------------------------------+
|  S    W    U    | | Font size — User settings (remote) |
| Z [3] [—] [—]   | |                                    |
| F [—] [2] [4⟳]  | | Keys that would be cleared (4):    |
| B [3] [2] [4⟳]  | |   editor.fontSize  (Global)        |
|                 | |   terminal.integrated.fontSize…    |
|                 | | Reload required.                   |
|                 | |                                    |
|                 | | [ Run reset ]                      |
+-----------------+ +------------------------------------+
```

**Strongest tradeoff:** the densest, calmest reading experience and lets the detail breathe, but adds client-side selection state to a webview whose script today is a single click dispatcher; need to keep all selection state in-DOM so the read-only contract holds.

---

**Open questions for the brief agent** (don't decide here):
- Does Preview need to support a "show only cells that would do something" toggle (echoing Settings' `@modified`)?
- Does the reload-required hint deserve a global banner if any cell needs reload, or stay per-cell?
- How small can the webview get before the chosen layout breaks? (Side panel placement in particular.)
