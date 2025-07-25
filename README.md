# Post-Tool Linter Hook for Claude Code

A Claude Code hook that automatically runs linters (ruff for Python, ESLint for JavaScript) after file modifications and prompts Claude to fix any linting errors before continuing other work.

## Features

- 🔍 **Automatic Linting**: Runs appropriate linters after Edit, Write, or MultiEdit tools
- 🐍 **Python Support**: Uses `ruff` for fast, comprehensive Python linting
- 📜 **JavaScript/TypeScript Support**: Uses `ESLint` for JavaScript/TypeScript files
- 🎯 **Smart Detection**: Automatically detects project type and chooses the right linter
- 🚨 **Immediate Feedback**: Prompts Claude to fix linting errors before proceeding
- ⚡ **Performance Optimized**: Timeouts and graceful error handling
- 🔧 **Easy Setup**: Simple installation script

## Installation

### Prerequisites

1. **Claude Code** installed and configured
2. **Node.js** (for running the hook)
3. **Linters** installed in your projects:
   - Python: `pip install ruff`
   - JavaScript: `npm install -D eslint`

### Setup Requirements

The hook automatically detects project types by looking for configuration files. **Your project must have at least one of these files for the hook to work:**

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

**If the hook isn't working on your codebase**, check that you have the appropriate config files. The hook will skip linting if it can't detect a valid project type.

### Quick Setup

1. Clone or download this repository
2. Run the setup script:
   ```bash
   node setup-linter-hook.js
   ```

This will automatically configure the hook in your `~/.claude/settings.json`.

### Manual Setup

Add the following to your `~/.claude/settings.json`:

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

## How It Works

1. **Tool Detection**: The hook activates after Claude uses Edit, Write, or MultiEdit tools
2. **File Analysis**: Determines the file type and appropriate linter to use
3. **Linter Execution**: Runs the linter with JSON output for easy parsing
4. **Error Collection**: Collects all linting violations (errors and warnings)
5. **Report Generation**: Creates detailed report in `development/linter-errors.md`
6. **Claude Prompt**: If violations exist, shows summary and directs Claude to read the detailed report
7. **Priority Enforcement**: Claude is instructed to fix linting errors before continuing

## Supported File Types

### Python
- Extensions: `.py`, `.pyi`
- Linter: `ruff`
- Config files: `pyproject.toml`, `.ruff.toml`, `ruff.toml`

### JavaScript/TypeScript
- Extensions: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- Linter: `eslint`
- Config files: `.eslintrc.json`, `.eslintrc.js`, `eslint.config.js`

## Testing

Run the test suite to verify the hook is working:

```bash
node test-linter-hook.js
```

This will:
- Create test files with known linting issues
- Simulate Claude Code tool usage
- Show how the hook responds to different scenarios
- Clean up test files afterward

## Configuration

The hook includes several configuration options in the script:

```javascript
const CONFIG = {
  timeout: 10000,          // Maximum time for linting (ms)
  enabledTools: ['Edit', 'Write', 'MultiEdit'],  // Tools that trigger linting
  linters: {
    python: { /* ... */ },
    javascript: { /* ... */ }
  }
};
```

## Example Output

When linting errors are detected, Claude receives a concise prompt like:

```
# 🚨 LINTING ERRORS DETECTED - FIX REQUIRED

Found 3 linting issues (2 errors, 1 warning) across 2 files.

📄 **Complete details:** `development/linter-errors.md`

**REQUIRED:** Fix all errors before proceeding. Use the Read tool to view the detailed report file.
```

The detailed error information is saved to `development/linter-errors.md` with complete file paths, line numbers, error descriptions, and fix suggestions. Claude can read this file to understand exactly what needs to be fixed.

## Troubleshooting

### Linter Not Found

If you see "command not found" errors:
- Python: Install ruff with `pip install ruff`
- JavaScript: Install ESLint with `npm install -D eslint`

### Hook Not Triggering

1. Verify the hook is in `~/.claude/settings.json`
2. Check the hook script path is absolute and correct
3. Ensure the hook script is executable (`chmod +x`)
4. Run the test script to debug

### Hook Not Working on Some Codebases

If the hook works on some projects but not others:

1. **Check project detection**: Ensure your project has the required config files (see Setup Requirements above)
2. **Verify linter installation**: Run `ruff --version` or `eslint --version` in the project directory
3. **Check project structure**: The hook looks for config files in the project root
4. **Review logs**: Check `post-tool-linter-hook.log` in the project directory for details

### No Linting Feedback

If you don't see any linting prompts:

1. **Config files missing**: Add `package.json`, `pyproject.toml`, or other required files
2. **Clean code**: The hook only prompts when violations are found
3. **Wrong file types**: Only `.py`, `.js`, `.ts`, `.tsx`, etc. files are linted
4. **Linter not installed**: Install `ruff` for Python or `eslint` for JavaScript

### Performance Issues

If linting is slow:
1. Check your linter configurations
2. Consider increasing the timeout in CONFIG
3. Use project-specific linter configs to limit scope

## Project Structure

```
post-tool-stop-hook/
├── post-tool-linter-hook.js    # Main hook script
├── setup-linter-hook.js        # Installation script
├── test-linter-hook.js         # Test suite
├── README.md                   # This file
└── development/                # Development guidelines & linter reports
    ├── linter-errors.md        # Detailed linting report (auto-generated)
    ├── general.md
    └── tasks/
        └── task-1-hook-research.md
```

## Contributing

Feel free to submit issues or pull requests to improve the hook!

## License

MIT License - Feel free to use and modify as needed.