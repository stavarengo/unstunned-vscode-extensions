# PRD: Codebase Quality Fixes

## Introduction

Address all bugs, code quality issues, and missing items identified in the codebase analysis report. The Reset Sizes VS Code extension has 15 identified issues ranging from critical functionality bugs (broken preset system, non-functional workspaceFolder scoping) to missing tooling configuration and documentation gaps. This PRD covers fixes for all issues to bring the codebase to production quality.

## Goals

- Fix all 4 critical bugs that break core functionality
- Resolve all 5 moderate bugs that cause confusion or minor failures
- Address 2 code quality issues for maintainability
- Add 4 missing items required for a complete extension
- Ensure all tests pass and are safe to run
- Ensure lint script works with proper configuration

## User Stories

### US-001: Add ESLint Configuration
**Description:** As a developer, I want ESLint configured so that code quality checks run successfully.

**Acceptance Criteria:**
- [ ] Create `.eslintrc.json` or `eslint.config.js` in project root
- [ ] Configure for TypeScript with VS Code extension best practices
- [ ] `npm run lint` executes without configuration errors
- [ ] All existing code passes lint (or issues are documented)
- [ ] Typecheck passes

---

### US-002: Remove Dangerous Window Reload Test
**Description:** As a developer, I want tests that are safe to run so they don't crash the test environment.

**Acceptance Criteria:**
- [ ] Remove or mock the `workbench.action.reloadWindow` test at `src/test/suite/utils.test.ts:32`
- [ ] Replace with a safe command test (e.g., `workbench.action.showCommands`)
- [ ] All tests pass without attempting window reload
- [ ] Typecheck passes

---

### US-003: Fix Preset System Configuration Loading
**Description:** As a user, I want changing presets to automatically use the preset's default commands and settings so the feature works as documented.

**Acceptance Criteria:**
- [ ] When preset is `zoomAndSettings`, the `settingsToReset` array uses preset defaults (not empty array from package.json)
- [ ] Implement logic to detect when user hasn't explicitly customized commands/settings vs. using package.json defaults
- [ ] Option A: Remove default values from package.json and handle defaults in code
- [ ] Option B: Add migration/detection logic to apply preset defaults when preset changes
- [ ] Update README if behavior description changes
- [ ] Add test verifying preset change applies correct defaults
- [ ] Typecheck passes

---

### US-004: Fix WorkspaceFolder Parameter Usage
**Description:** As a user, I want workspace folder-scoped settings reset to work correctly in multi-root workspaces.

**Acceptance Criteria:**
- [ ] Modify `updateSetting()` in `src/utils/index.ts:59-82` to use `workspaceFolder` parameter
- [ ] Use `vscode.workspace.getConfiguration('', workspaceFolder)` when workspaceFolder is provided
- [ ] Add test for workspace folder scoped setting updates
- [ ] Typecheck passes

---

### US-005: Fix Step Number Comments
**Description:** As a developer, I want accurate code comments so the codebase is easy to understand.

**Acceptance Criteria:**
- [ ] Fix comment at `src/commands/resetAllSizes.ts:106` - renumber steps sequentially (1-6 or add missing steps 6-7)
- [ ] Verify all step comments are sequential and accurate
- [ ] Typecheck passes

---

### US-006: Fix Documentation - Remove hardReset Reference
**Description:** As a user, I want accurate documentation so I understand how to configure the extension.

**Acceptance Criteria:**
- [ ] Update `README.md:64` to use correct mode name (`zoomAndSettings` or appropriate preset)
- [ ] Search for any other "hardReset" references and fix them
- [ ] Verify all preset names in documentation match code

---

### US-007: Remove Redundant OutputChannel Dispose
**Description:** As a developer, I want clean resource management without redundant disposal calls.

**Acceptance Criteria:**
- [ ] Remove manual `outputChannel.dispose()` call in `deactivate()` at `src/extension.ts:28-30`
- [ ] Keep `context.subscriptions.push(outputChannel)` for automatic disposal
- [ ] Alternatively, remove from subscriptions and keep manual dispose (pick one approach)
- [ ] Typecheck passes

---

### US-008: Preserve Error Details in Command Execution
**Description:** As a developer, I want meaningful error messages so I can debug command failures.

**Acceptance Criteria:**
- [ ] Modify `executeVSCodeCommand()` in `src/utils/index.ts:41-48` to capture error details
- [ ] Return error message or log it to output channel
- [ ] Update `src/commands/resetAllSizes.ts:50` to include actual error message instead of generic 'Command execution failed'
- [ ] Typecheck passes

---

### US-009: Add Warning for WorkspaceFolder Scope Without Folders
**Description:** As a user, I want feedback when my configuration can't be applied so I understand why nothing happened.

**Acceptance Criteria:**
- [ ] Add logging/warning in `src/utils/index.ts:108-119` when `workspaceFolder` scope is selected but no workspace folders exist
- [ ] Log message to output channel explaining the issue
- [ ] Optionally show user notification
- [ ] Typecheck passes

---

### US-010: Remove Unused Context Parameter
**Description:** As a developer, I want clean function signatures without unused parameters.

**Acceptance Criteria:**
- [ ] Remove `context` parameter from `resetAllSizes()` in `src/commands/resetAllSizes.ts:17-18`
- [ ] Update all call sites in `src/extension.ts`
- [ ] Typecheck passes

---

### US-011: Strengthen Test Assertions
**Description:** As a developer, I want meaningful test assertions so tests actually verify behavior.

**Acceptance Criteria:**
- [ ] Fix `src/test/suite/resetAllSizes.test.ts:86` - verify specific expected commands were executed
- [ ] Fix `src/test/suite/resetAllSizes.test.ts:90` - change `>= 0` to meaningful assertion (either expect specific count or check array contents)
- [ ] Review other assertions in test files for similar issues
- [ ] All tests pass
- [ ] Typecheck passes

---

### US-012: Add CHANGELOG.md
**Description:** As a user, I want a changelog so I can see what changed between versions.

**Acceptance Criteria:**
- [ ] Create `CHANGELOG.md` in project root
- [ ] Follow [Keep a Changelog](https://keepachangelog.com/) format
- [ ] Document current version features
- [ ] Include placeholder for future releases

---

### US-013: Add Extension Icon
**Description:** As a user, I want the extension to have an icon so it's visually identifiable in the marketplace.

**Acceptance Criteria:**
- [ ] Create or obtain a 128x128 PNG icon
- [ ] Add icon file to project (e.g., `images/icon.png`)
- [ ] Update `package.json` with `"icon": "images/icon.png"`
- [ ] Icon is visible in Extension Development Host

---

### US-014: Add Marketplace Keywords
**Description:** As a user, I want to find this extension when searching relevant terms in the marketplace.

**Acceptance Criteria:**
- [ ] Add `"keywords"` array to `package.json`
- [ ] Include relevant terms: "reset", "zoom", "font size", "ui", "layout", "settings"
- [ ] Limit to 5 keywords (marketplace recommendation)

---

## Functional Requirements

- FR-1: ESLint must be configured and `npm run lint` must execute successfully
- FR-2: All tests must be safe to run without side effects like window reload
- FR-3: Changing `resetSizes.preset` setting must apply the preset's default commands and settingsToReset
- FR-4: `updateSetting()` must correctly scope configuration to the provided workspaceFolder
- FR-5: All code comments must be accurate and sequential
- FR-6: All documentation must reference only existing features and modes
- FR-7: Resource disposal must happen exactly once per resource
- FR-8: Command execution failures must include the actual error message
- FR-9: Invalid configuration scenarios must provide user feedback
- FR-10: Function signatures must not include unused parameters
- FR-11: Test assertions must verify specific expected behavior
- FR-12: CHANGELOG.md must exist and document version history
- FR-13: Extension must have a marketplace icon
- FR-14: Extension must have searchable keywords

## Non-Goals

- No new features beyond fixing existing functionality
- No major architectural refactoring
- No performance optimizations unless required for a fix
- No UI redesign
- No additional presets beyond fixing existing ones
- No breaking changes to existing user configuration

## Technical Considerations

- **Preset fix options:**
  - Option A: Remove defaults from package.json, handle all defaults in TypeScript code
  - Option B: Track "user-modified" state and only apply preset defaults when unchanged
  - Recommendation: Option A is simpler and more maintainable

- **ESLint configuration:**
  - Use flat config format (`eslint.config.js`) for modern ESLint
  - Or use `.eslintrc.json` for broader compatibility
  - Include TypeScript parser and VS Code extension rules

- **Error preservation:**
  - Consider returning `{ success: boolean, error?: string }` instead of just `boolean`
  - Or add error logging to output channel

## Success Metrics

- `npm run lint` executes without errors
- `npm test` passes with no window reload attempts
- Changing preset from `zoom` to `zoomAndSettings` resets the documented settings
- All 14 issues from the analysis report are resolved
- No TypeScript compilation errors
- No regression in existing functionality

## Open Questions

1. **Preset fix approach:** Should we go with Option A (remove package.json defaults) or Option B (track user modifications)? Option A is recommended for simplicity.

2. **Error reporting level:** Should command execution errors be shown to users via notifications, or only logged to the output channel?

3. **Icon design:** Should the icon be created from scratch or based on VS Code's existing zoom/reset iconography?

4. **Improvement opportunities:** The analysis mentioned "9 improvement opportunities" not detailed in the report. Should these be identified and added as separate stories?

---

## Priority Order

Based on the analysis report's recommended fix order:

| Priority | Story | Issue |
|----------|-------|-------|
| 1 | US-003 | Preset system bug (core feature broken) |
| 2 | US-001 | ESLint config (dev tooling broken) |
| 3 | US-004 | WorkspaceFolder parameter (feature broken) |
| 4 | US-002 | Dangerous test case (CI risk) |
| 5 | US-006 | Documentation errors (user confusion) |
| 6-14 | US-005, US-007-014 | Remaining moderate/quality/missing items |
