# Claude Code Linter Hook - Quick Start Guide

Version: 1.0.0

## Overview

The Claude Code Linter Hook automatically runs appropriate linters (ruff for Python, ESLint for JavaScript/TypeScript) after file modifications and prompts Claude to fix any linting errors before continuing.

## Installation

### Prerequisites

1. **Claude Code** installed and configured
2. **Node.js** (for running the hook)
3. **Linters** installed in your projects:
   - Python: `pip install ruff`
   - JavaScript: `npm install -D eslint`

### Quick Installation

1. Extract this package to a directory of your choice
2. Run the appropriate installer for your platform:
   - **Unix/Linux/macOS**: `./install.sh`
   - **Windows**: `install.bat`
   - **Cross-platform**: `node install.js`

### Manual Installation

If the automated installers don't work, you can set up the hook manually:

1. Copy `bin/post-tool-linter-hook.js` to a permanent location
2. Run: `node bin/setup-post-tool-hook.js --global`
3. This will configure your `~/.claude/settings.json`

## Verification

Test the installation by creating a file with linting errors:

```python
# test.py
import   os    # Multiple spaces - will trigger ruff
print("hello world")
```

Then use Claude Code to edit the file. The hook should detect linting errors and prompt Claude to fix them.

## Configuration

The hook automatically detects project types by looking for configuration files:

**Python Projects**: `pyproject.toml`, `setup.py`, `requirements.txt`, etc.
**JavaScript Projects**: `package.json`, `tsconfig.json`, `.eslintrc.json`, etc.

## Troubleshooting

### Hook Not Triggering
1. Verify hook is in `~/.claude/settings.json`
2. Check hook script path is absolute and correct
3. Ensure script is executable (`chmod +x`)

### Linter Not Found
- Python: `pip install ruff`
- JavaScript: `npm install -D eslint`

### No Linting Feedback
1. Ensure project has required config files
2. Check that files being edited have appropriate extensions
3. Verify linters are installed and accessible

For detailed documentation, see the included `docs/` directory.

## Support

For issues and questions, refer to the main README.md or create an issue in the project repository.
