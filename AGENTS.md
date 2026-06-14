# AGENTS.md - Sub-Agent Definitions

This file defines specialized sub-agents for working in this VS Code extension repository.

## Agent Types

### 1. Explorer Agent

**Purpose**: Understand codebase structure, find relevant files, answer questions about the code.

**When to use**:
- "Where is X implemented?"
- "How does Y work?"
- "What files handle Z?"

**Capabilities**:
- Read files across the codebase
- Search for patterns with grep/glob
- Trace code flow through modules

**Handoff**: Provide findings to Implementation or Review agents.

---

### 2. Implementation Agent

**Purpose**: Write code changes, add features, fix bugs.

**When to use**:
- Adding new configuration options
- Implementing new commands
- Fixing bugs in existing functionality
- Refactoring code

**Key files to know**:
- `extensions/reset-sizes/src/extension.ts` - Entry point
- `extensions/reset-sizes/src/commands/resetAllSizes.ts` - Main logic
- `extensions/reset-sizes/src/utils/index.ts` - Utilities
- `extensions/reset-sizes/src/types/index.ts` - Type definitions
- `extensions/reset-sizes/package.json` - Extension manifest

**Workflow**:
1. Read relevant files first
2. Understand existing patterns
3. Make minimal, focused changes
4. Update tests if needed
5. Run `pnpm run build` and `pnpm test`

**Handoff**: Pass completed work to Review agent.

---

### 3. Test Agent

**Purpose**: Write and run tests, verify functionality.

**When to use**:
- After implementing new features
- When fixing bugs (add regression test)
- Validating existing functionality

**Test locations**:
- `extensions/reset-sizes/src/test/unit/*.test.ts` - Automated tests
- `TESTING.md` - Manual test scenarios

**Commands**:
```bash
pnpm test          # Run all tests
pnpm run build     # Must compile before testing
```

**Handoff**: Report test results to Implementation agent for fixes.

---

### 4. Review Agent

**Purpose**: Code review, quality checks, documentation updates.

**When to use**:
- After implementation is complete
- Before committing changes
- When updating documentation

**Checklist**:
- [ ] Code compiles without errors
- [ ] Tests pass
- [ ] ESLint passes (`pnpm run lint`)
- [ ] Types are correct
- [ ] Error handling is appropriate
- [ ] Documentation updated if needed

**Handoff**: Approve for commit or return to Implementation agent.

---

### 5. Documentation Agent

**Purpose**: Update documentation files, keep AI docs in sync.

**When to use**:
- After significant code changes
- When adding new features
- When updating configuration options

**Files to update**:
- `README.md` - User-facing documentation
- `CLAUDE.md` - AI context
- `docs/ai/*.md` - Detailed AI documentation
- `TESTING.md` - If test scenarios change

**Handoff**: None (final step).

---

## Handoff Rules

```
User Request
    │
    ▼
┌─────────────┐
│  Explorer   │ ──► Understand the codebase
└─────────────┘
    │
    ▼
┌─────────────┐
│Implementation│ ──► Make code changes
└─────────────┘
    │
    ▼
┌─────────────┐
│    Test     │ ──► Verify changes work
└─────────────┘
    │
    ▼
┌─────────────┐
│   Review    │ ──► Quality check
└─────────────┘
    │
    ▼
┌─────────────┐
│Documentation│ ──► Update docs if needed
└─────────────┘
    │
    ▼
  Complete
```

## Context Sharing

When handing off between agents, include:

1. **What was done**: Summary of changes/findings
2. **Key files**: List of relevant files touched or discovered
3. **Open questions**: Any unresolved issues
4. **Next steps**: What the receiving agent should do

## Example Handoffs

### Explorer → Implementation
```
Found that configuration is loaded in extensions/reset-sizes/src/utils/index.ts:getExtensionConfig().
The preset system is defined in PRESET_CONFIGS constant.
To add a new config option, modify ExtensionConfig type and update getExtensionConfig().
```

### Implementation → Test
```
Added new `resetSizes.verbose` configuration option.
Files changed: extensions/reset-sizes/package.json, extensions/reset-sizes/src/types/index.ts, extensions/reset-sizes/src/utils/index.ts
Need tests for: reading config, using verbose flag in output
```

### Test → Review
```
All tests pass. Added 2 new test cases in utils.test.ts.
Coverage looks good for the new feature.
Ready for code review.
```
