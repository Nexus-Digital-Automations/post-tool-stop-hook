# Configuration Guide

This guide covers configuration options for the Post-Tool Linter Hook, including the smart task placement system.

## Basic Configuration

The hook is configured in your `~/.claude/settings.json` file:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/post-tool-linter-hook.js",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

### Configuration Parameters

- **`matcher`**: Tool names that trigger the hook (Edit, Write, MultiEdit)
- **`command`**: Absolute path to the hook script
- **`timeout`**: Maximum execution time in milliseconds (default: 15000)

## Hook Internal Configuration

The hook script includes several configurable constants:

```javascript
const CONFIG = {
  timeout: 10000,          // Maximum time for linting (ms)
  enabledTools: ['Edit', 'Write', 'MultiEdit'],  // Tools that trigger linting
  linters: {
    python: {
      command: 'ruff',
      args: ['check', '--format', 'json'],
      extensions: ['.py', '.pyi']
    },
    javascript: {
      command: 'eslint',
      args: ['--format', 'json'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
    }
  }
};
```

## Smart Task Placement Configuration

### TODO.json Schema

The smart task placement system expects a TODO.json file with this structure:

```json
{
  "project": "project-name",
  "tasks": [
    {
      "id": "unique-task-id",
      "title": "Task Title",
      "description": "Task description",
      "mode": "DEVELOPMENT|TESTING|REVIEWER|RESEARCH",
      "priority": "high|medium|low",
      "status": "pending|in_progress|completed",
      "important_files": ["file1.js", "file2.py"],
      "success_criteria": ["Criterion 1", "Criterion 2"],
      "created_at": "2025-07-25T07:51:14.819Z"
    }
  ],
  "current_task_index": 0,
  "last_mode": "DEVELOPMENT",
  "execution_count": 1,
  "last_hook_activation": 1753429874819
}
```

### Required Fields

**Minimal TODO.json:**
```json
{
  "project": "my-project",
  "tasks": []
}
```

**Recommended TODO.json:**
```json
{
  "project": "my-project", 
  "tasks": [],
  "current_task_index": 0
}
```

### Task Object Schema

**Required Task Fields:**
- `id`: Unique identifier
- `title`: Human-readable title
- `description`: Detailed description
- `status`: One of "pending", "in_progress", "completed"

**Optional Task Fields:**
- `mode`: Task type/category
- `priority`: Task priority level
- `important_files`: Array of relevant file paths
- `success_criteria`: Array of completion requirements
- `created_at`: ISO timestamp
- `subtasks`: Array of nested subtasks
- `dependencies`: Array of dependency task IDs

## Linter Configuration

### Python (Ruff)

**Project-level configuration** in `pyproject.toml`:

```toml
[tool.ruff]
# Enable pycodestyle (`E`) and Pyflakes (`F`) codes by default.
select = ["E", "F"]
ignore = []

# Allow fix for all enabled rules (when `--fix`) is provided.
fixable = ["ALL"]
unfixable = []

# Exclude a variety of commonly ignored directories.
exclude = [
    ".bzr",
    ".direnv", 
    ".eggs",
    ".git",
    ".git-rewrite",
    ".hg",
    ".mypy_cache",
    ".nox",
    ".pants.d",
    ".pytype",
    ".ruff_cache",
    ".svn",
    ".tox",
    ".venv",
    "__pypackages__",
    "_build",
    "buck-out",
    "build",
    "dist",
    "node_modules",
    "venv",
]

# Same as Black.
line-length = 88
indent-width = 4

target-version = "py38"
```

### JavaScript/TypeScript (ESLint)

**Project-level configuration** in `.eslintrc.js`:

```javascript
module.exports = {
  files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      ...globals.node,
      ...globals.browser
    }
  },
  rules: {
    // Error prevention rules
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    
    // Code quality rules
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    
    // Style rules
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { 'allowTemplateLiterals': true }],
    'indent': ['warn', 2]
  }
};
```

## Environment Configuration

### Project Detection

The hook detects project types by looking for these files:

**Python Projects:**
- `pyproject.toml` (with `[tool.*]`, `[build-system]`, or `[project]` sections)
- `setup.py` (with `setup()` call)
- `requirements.txt`
- `.python-version`
- `Pipfile`

**JavaScript/TypeScript Projects:**
- `package.json` (with `scripts`, `dependencies`, `devDependencies`, or `type`)
- `tsconfig.json`
- `.eslintrc.json` or `.eslintrc.js`

### File Type Detection

The hook processes files based on extensions:

**Python:** `.py`, `.pyi`
**JavaScript/TypeScript:** `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`

## Advanced Configuration

### Custom Linter Integration

To add support for additional linters, modify the CONFIG object:

```javascript
const CONFIG = {
  linters: {
    python: { /* existing config */ },
    javascript: { /* existing config */ },
    // Add new linter
    golang: {
      command: 'golangci-lint',
      args: ['run', '--out-format', 'json'],
      extensions: ['.go'],
      projectDetection: ['go.mod', 'go.sum']
    }
  }
};
```

### Task Placement Strategies

The current placement strategy positions linter tasks immediately after the current task. To customize this behavior, modify `determineInsertionPoint()`:

```javascript
function determineInsertionPoint(analysis) {
  // Current strategy: Insert after current task
  const insertionIndex = analysis.currentTaskIndex + 1;
  
  // Alternative strategies:
  
  // Strategy 1: Insert at the beginning (highest priority)
  // return 0;
  
  // Strategy 2: Insert after all high-priority tasks
  // const highPriorityCount = analysis.highPriorityTasks.length;
  // return Math.min(highPriorityCount, analysis.totalTasks);
  
  // Strategy 3: Insert at the end (lowest priority)
  // return analysis.totalTasks;
  
  return insertionIndex;
}
```

### Backup Configuration

Backup files are created automatically. To customize backup behavior:

```javascript
// Current backup naming: TODO.json.backup.${timestamp}
const backupPath = path.join(projectPath, `TODO.json.backup.${Date.now()}`);

// Alternative backup strategies:
// 1. Dated backups: TODO.json.backup.2025-07-25
// 2. Numbered backups: TODO.json.backup.001
// 3. No backups: Comment out backup creation
```

## Performance Tuning

### Timeout Configuration

Adjust timeouts based on your project size:

```javascript
const CONFIG = {
  // For large projects
  timeout: 30000,  // 30 seconds
  
  // For small projects  
  timeout: 5000,   // 5 seconds
};
```

### File Filtering

Exclude unnecessary files from linting:

**ESLint `.eslintignore`:**
```
node_modules/
dist/
build/
*.min.js
```

**Ruff in `pyproject.toml`:**
```toml
[tool.ruff]
exclude = [
    "migrations/",
    "venv/",
    "*.pyi",
]
```

## Troubleshooting Configuration

### Common Configuration Issues

1. **Hook not triggering**: Check the `matcher` pattern in settings.json
2. **Wrong linter used**: Verify project detection files exist
3. **Timeout errors**: Increase timeout value for large projects
4. **Permission errors**: Ensure hook script is executable
5. **Task placement fails**: Verify TODO.json is valid JSON

### Debug Configuration

Enable verbose logging by setting environment variables:

```bash
export LINTER_HOOK_DEBUG=1
export LINTER_HOOK_VERBOSE=1
```

Or modify the hook script:

```javascript
const DEBUG = process.env.LINTER_HOOK_DEBUG === '1';
const VERBOSE = process.env.LINTER_HOOK_VERBOSE === '1';

function log(message) {
  if (DEBUG || VERBOSE) {
    console.error(`[HOOK] ${new Date().toISOString()}: ${message}`);
  }
}
```

### Validation Scripts

Create validation scripts to test your configuration:

```bash
# Test linter availability
ruff --version
eslint --version

# Test TODO.json validity
node -e "console.log(JSON.parse(require('fs').readFileSync('TODO.json', 'utf8')))"

# Test hook execution
node post-tool-linter-hook.js < test-input.json
```

This configuration guide provides comprehensive coverage of all configurable aspects of the Post-Tool Linter Hook system.