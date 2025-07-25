# Post-Tool Linter Hook - User Guide

A comprehensive guide for users of the Post-Tool Linter Hook system, covering installation, configuration, usage, and troubleshooting.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation Guide](#installation-guide)
3. [Project Setup](#project-setup)
4. [Usage Examples](#usage-examples)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Features](#advanced-features)
8. [Best Practices](#best-practices)

## Quick Start

Get up and running in 5 minutes:

### 1. Prerequisites Check

```bash
# Verify you have the required tools
node --version    # Should be 16+ 
python --version  # Should be 3.8+
claude --version  # Ensure Claude Code is installed

# Install linters
pip install ruff        # For Python
npm install -g eslint   # For JavaScript
```

### 2. Basic Installation

```bash
# Clone the hook repository
git clone https://github.com/your-org/post-tool-linter-hook.git
cd post-tool-linter-hook

# Install for your current project
node setup-post-tool-hook.js --local

# Verify installation
node setup-post-tool-hook.js --validate
```

### 3. Test It Works

Create a test file with a simple error:

```python
# test.py
print("hello world"  # Missing closing parenthesis
```

Use Claude Code to edit this file and watch the hook detect the error automatically!

## Installation Guide

### System Requirements

- **Node.js**: Version 16 or higher
- **Python**: Version 3.8 or higher (for Python projects)
- **Claude Code**: Latest version
- **Linters**: 
  - `ruff` for Python projects (`pip install ruff`)
  - `eslint` for JavaScript projects (`npm install -g eslint`)

### Installation Options

#### Option 1: Global Installation (Recommended)

Installs the hook for all your Claude Code projects:

```bash
node setup-post-tool-hook.js --global
```

#### Option 2: Project-Specific Installation

Installs the hook only for the current project:

```bash
node setup-post-tool-hook.js --local
```

#### Option 3: Custom Installation

Install with specific settings:

```bash
# Custom timeout (default: 15000ms)
node setup-post-tool-hook.js --timeout 30000

# Force overwrite existing configuration
node setup-post-tool-hook.js --force

# Install for specific project
node setup-post-tool-hook.js --local --project /path/to/project
```

### Verification

After installation, verify everything works:

```bash
# Check configuration
node setup-post-tool-hook.js --validate

# Run test suite
node test-linter-hook.js

# Check Claude settings
cat ~/.claude/settings.json
```

## Project Setup

The hook automatically detects project types, but your project needs specific configuration files.

### Python Projects

Your project must have **at least one** of these files:

```bash
# Required: Create pyproject.toml (recommended)
cat > pyproject.toml << 'EOF'
[project]
name = "my-project"
version = "0.1.0"

[tool.ruff]
select = ["E", "F"]  # pycodestyle errors and Pyflakes
line-length = 88
EOF

# Alternative: Other Python indicators
touch setup.py           # or
touch requirements.txt   # or  
touch .python-version    # or
touch Pipfile
```

### JavaScript/TypeScript Projects

Your project must have **at least one** of these files:

```bash
# Required: Create package.json
npm init -y

# Recommended: Create ESLint config
cat > .eslintrc.js << 'EOF'
module.exports = {
  env: { node: true, es2022: true },
  rules: {
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    'semi': ['warn', 'always']
  }
};
EOF

# Alternative: TypeScript config
touch tsconfig.json
```

### Mixed Projects (Python + JavaScript)

For full-stack projects, create configuration files for both languages in the project root.

## Usage Examples

### Basic Usage

1. **Edit a file** in Claude Code using Edit, Write, or MultiEdit tools
2. **Hook runs automatically** after the tool completes
3. **Receive feedback** if linting issues are found
4. **Fix issues** as prompted by Claude Code

### Example Workflow

```python
# 1. Create a Python file with issues
# src/example.py
import os  # unused import
def hello_world( ):  # extra space before )
    name="World"   # missing space around =
    print(f"Hello, {name}!")
```

When you edit this file in Claude Code:

1. **Hook detects issues**: Unused import, spacing problems
2. **Creates detailed report**: `development/linter-errors.md`
3. **Adds TODO task**: High-priority task in your `TODO.json`
4. **Prompts Claude**: To fix the issues immediately

### Real-World Examples

See the [`examples/`](../examples/) directory for detailed scenarios:

- [Python Project Setup](../examples/basic-setup/python-project.md)
- [JavaScript Project Setup](../examples/basic-setup/javascript-project.md)
- [Team Integration Workflows](../examples/workflows/team-integration.md)
- [Common Issues & Solutions](../examples/troubleshooting/common-issues.md)

## Configuration

### Hook Configuration

The hook behavior can be customized by editing the script directly:

```javascript
// In post-tool-linter-hook.js
const CONFIG = {
  timeout: 10000,          // Maximum linting time (ms)
  enabledTools: ['Edit', 'Write', 'MultiEdit'],  // Triggering tools
  lintingMode: 'smart',    // 'files-only', 'project-wide', 'smart'
  maxFilesForProjectMode: 5,  // Threshold for project-wide linting
};
```

### Claude Code Settings

Hook configuration in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/post-tool-linter-hook.js",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

### Linter Configuration

#### Python (Ruff)

Configure in `pyproject.toml`:

```toml
[tool.ruff]
# Rule selection
select = [
    "E",   # pycodestyle errors
    "F",   # Pyflakes  
    "W",   # pycodestyle warnings
    "I",   # isort
    "N",   # pep8-naming
]

# Exclusions
ignore = ["E501"]  # Line too long

# Settings
line-length = 88
target-version = "py38"

# Exclude directories
exclude = [".git", ".venv", "build", "dist"]
```

#### JavaScript (ESLint)

Configure in `.eslintrc.js`:

```javascript
module.exports = {
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Errors (must fix)
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    
    // Warnings (should fix)
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single'],
    
    // Style (optional)
    'indent': ['warn', 2]
  }
};
```

## Troubleshooting

### Common Issues

#### Hook Not Running

**Problem**: No linting feedback when editing files

**Solutions**:
1. Check Claude Code settings: `cat ~/.claude/settings.json`
2. Verify hook path is absolute and correct
3. Ensure hook script is executable: `chmod +x post-tool-linter-hook.js`
4. Test manually: `node test-linter-hook.js`

#### Linter Not Found

**Problem**: "Command not found" errors

**Solutions**:
```bash
# Python - Install Ruff
pip install ruff
ruff --version

# JavaScript - Install ESLint
npm install -g eslint
eslint --version

# Check PATH
echo $PATH
which ruff
which eslint
```

#### Project Not Detected

**Problem**: "No project type detected"

**Solutions**:
1. Verify required config files exist (see [Project Setup](#project-setup))
2. Check file contents are valid:
   ```bash
   # Validate pyproject.toml
   python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb')))"
   
   # Validate package.json
   node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')))"
   ```

#### Performance Issues

**Problem**: Hook takes too long or times out

**Solutions**:
1. Increase timeout in Claude settings (see [Configuration](#configuration))
2. Exclude unnecessary directories in linter configs
3. Use the performance-optimized hook version:
   ```bash
   node setup-post-tool-hook.js --command "/path/to/performance-tests/performance-optimized-hook.js"
   ```

### Getting Help

1. **Enable debug logging**: Set `DEBUG = true` in the hook script
2. **Check log files**: Review `post-tool-linter-hook.log` in your project
3. **Run diagnostics**: Use the [diagnosis script](../examples/troubleshooting/common-issues.md#quick-diagnosis-script)
4. **Check examples**: Review [common issues guide](../examples/troubleshooting/common-issues.md)

## Advanced Features

### Smart Task Placement

The hook automatically creates tasks in your `TODO.json` file when linting issues are found:

- **Strategic positioning**: Places tasks as next highest priority
- **Comprehensive metadata**: Includes file references and success criteria
- **Atomic operations**: Safe updates with automatic backups

Learn more: [Smart Task Placement Documentation](smart-task-placement.md)

### Performance Optimization

For large codebases, use the performance-optimized version:

```bash
# Switch to optimized hook
node setup-post-tool-hook.js --command "/path/to/performance-tests/performance-optimized-hook.js"
```

Features:
- **60-70% faster** execution on large projects
- **In-memory caching** for project/file type detection
- **Smart strategy selection** (file-based vs project-wide)
- **Concurrent processing** with resource limits

Learn more: [Performance Tests Documentation](../performance-tests/README.md)

### Integration with CI/CD

The hook can be integrated into continuous integration pipelines:

```yaml
# GitHub Actions example
- name: Run Linter Hook
  run: |
    echo '{"tool_name":"Edit","tool_input":{"file_path":"./src/"},"cwd":"."}' | \
    node post-tool-linter-hook.js
```

Learn more: [Team Integration Guide](../examples/workflows/team-integration.md)

## Best Practices

### Development Workflow

1. **Start with minimal config**: Begin with basic linting rules and gradually increase strictness
2. **Fix issues immediately**: Address linting errors as soon as they're reported
3. **Use auto-fix when available**: Many issues can be automatically resolved
4. **Customize for your team**: Adapt linting rules to match team standards

### Team Collaboration

1. **Standardize configurations**: Use shared linting configs across team projects
2. **Document exceptions**: Clearly document when and why certain rules are disabled
3. **Regular reviews**: Periodically review and update linting configurations
4. **Training**: Ensure all team members understand the linting rules and workflow

### Project Maintenance

1. **Keep linters updated**: Regularly update ruff, eslint, and other tools
2. **Monitor performance**: Watch for hook timeouts and optimize as needed
3. **Review reports**: Regularly check `development/linter-errors.md` for patterns
4. **Clean up tasks**: Mark completed linting tasks as done in `TODO.json`

### Configuration Management

1. **Version control configs**: Include linting configurations in git
2. **Environment-specific rules**: Use different rule sets for development vs production
3. **Gradual tightening**: Progressively make linting rules stricter as code quality improves
4. **Document decisions**: Keep notes on why specific rules are chosen or ignored

## Getting Started Checklist

Use this checklist to ensure proper setup:

- [ ] **Prerequisites installed**: Node.js, Python, Claude Code
- [ ] **Linters installed**: `ruff --version` and `eslint --version` work
- [ ] **Hook installed**: `node setup-post-tool-hook.js --validate` passes
- [ ] **Project configured**: Required config files exist and are valid
- [ ] **Test successful**: `node test-linter-hook.js` runs without errors
- [ ] **First edit works**: Hook detects and reports issues when editing files
- [ ] **TODO integration**: Tasks are created in `TODO.json` when issues found
- [ ] **Team aligned**: Shared linting configurations in place (if applicable)

## Next Steps

After getting the basic setup working:

1. **Explore examples**: Review the [`examples/`](../examples/) directory for advanced use cases
2. **Customize configuration**: Adapt linting rules to your project's needs  
3. **Team integration**: Set up shared configurations and workflows
4. **Performance optimization**: Consider the optimized hook for large projects
5. **CI/CD integration**: Add linting checks to your build pipeline

For detailed guidance on any of these topics, see the specific documentation files in the [`docs/`](.) directory.

---

**Need more help?** Check out:
- [Configuration Guide](config.md) - Detailed configuration options
- [Smart Task Placement](smart-task-placement.md) - How automatic task creation works
- [Examples Directory](../examples/) - Real-world usage examples
- [Performance Tests](../performance-tests/) - Optimization options