# Coding Conventions

## TypeScript

### Compiler Configuration

Shared options live in the root `tsconfig.base.json`; each package's `tsconfig.json` extends it and adds `rootDir`/`outDir`.

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

### Type Safety

- **Strict mode enabled** - All strict checks are on
- **Explicit return types** - Functions should declare return types
- **No `any`** - Avoid `any` type; use `unknown` if needed
- **Interfaces over types** - Prefer `interface` for object shapes

```typescript
// Good
function getConfig(): ExtensionConfig {
  // ...
}

// Avoid
function getConfig() {  // Missing return type
  // ...
}
```

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | camelCase | `resetAllSizes.ts` |
| Interfaces | PascalCase | `ExtensionConfig` |
| Types | PascalCase | `PresetType` |
| Functions | camelCase | `getExtensionConfig` |
| Variables | camelCase | `outputChannel` |
| Constants | UPPER_SNAKE_CASE | `PRESET_CONFIGS` |
| Commands | dot.separated | `resetSizes.resetAll` |

## Code Organization

### File Structure

```typescript
// 1. Imports (VS Code first, then local)
import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';

// 2. Constants
const PRESET_CONFIGS = { ... };

// 3. Exported functions
export function mainFunction() { ... }

// 4. Helper functions (private)
function helperFunction() { ... }
```

### Function Organization

- Export public functions first
- Keep helper functions private (no export)
- One primary purpose per function
- < 50 lines per function when possible

## Error Handling

### Command Execution

```typescript
// Wrap VS Code command calls
async function executeVSCodeCommand(commandId: string): Promise<boolean> {
  try {
    await vscode.commands.executeCommand(commandId);
    return true;
  } catch (error) {
    // Log but don't throw - graceful degradation
    outputChannel.appendLine(`Failed: ${commandId}`);
    return false;
  }
}
```

### Settings Updates

```typescript
// Check scope availability before updating
if (scope === 'workspaceFolder' && !vscode.workspace.workspaceFolders) {
  return { success: 0, failed: 0 };
}
```

### User-Facing Errors

- Use `vscode.window.showErrorMessage()` for critical errors
- Use output channel for detailed logging
- Never throw unhandled exceptions

## Async/Await

- **Always use async/await** - No raw promises or callbacks
- **Handle all promises** - Never fire-and-forget

```typescript
// Good
async function doWork(): Promise<void> {
  const result = await someAsyncOp();
  await anotherAsyncOp(result);
}

// Avoid
function doWork() {
  someAsyncOp().then(result => {
    anotherAsyncOp(result);  // Unhandled promise
  });
}
```

## Logging

### Output Channel

```typescript
// Standard log format
outputChannel.appendLine(`[Reset Sizes] Starting reset...`);
outputChannel.appendLine(`  Preset: ${config.preset}`);
outputChannel.appendLine(`  Commands: ${config.commands.length}`);
```

### Log Levels

- **Info**: Normal operation flow
- **Warning**: Recoverable issues (e.g., terminal not open)
- **Error**: Failures that need attention

## Comments

### When to Comment

- Complex business logic
- Non-obvious workarounds
- VS Code API quirks

### When NOT to Comment

- Self-explanatory code
- Every function (use good names instead)
- Commented-out code (delete it)

```typescript
// Good - explains WHY
// Terminal font zoom may fail if no terminal exists - this is expected
const terminalResult = await executeVSCodeCommand('workbench.action.terminal.fontZoomReset');

// Avoid - states the obvious
// Execute the zoom reset command
await executeVSCodeCommand('workbench.action.zoomReset');
```

## Testing Style

### Test Organization

```typescript
describe('Module Name', () => {
  describe('functionName', () => {
    it('should do X when Y', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionName(input);

      // Assert
      assert.strictEqual(result, expected);
    });
  });
});
```

### Test Naming

- Use `should ... when ...` format
- Be specific about inputs and outputs
- One assertion per test when possible

### Mocking

```typescript
// Mock VS Code APIs
const mockConfig = {
  get: (key: string) => mockValues[key],
  update: async () => {}
};
```

## Import Style

```typescript
// VS Code imports first
import * as vscode from 'vscode';

// Then local imports, grouped by type
import { ExtensionConfig, ResetResult } from '../types';
import { getConfig, executeCommand } from '../utils';
```

## VS Code API Usage

### Configuration

```typescript
// Always specify default values
const config = vscode.workspace.getConfiguration('resetSizes');
const preset = config.get<string>('preset', 'zoom');
```

### Commands

```typescript
// Use command IDs as constants when possible
const ZOOM_RESET_COMMAND = 'workbench.action.zoomReset';
```

### Notifications

```typescript
// Information for success
vscode.window.showInformationMessage('Reset complete');

// Warning for partial success
vscode.window.showWarningMessage('Some settings could not be reset');

// Error for failures
vscode.window.showErrorMessage('Reset failed');
```
