# Common Issues and Troubleshooting

This guide covers the most common problems users encounter when setting up and using the Post-Tool Linter Hook, along with step-by-step solutions.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Hook Not Triggering](#hook-not-triggering)
3. [Linter Not Found](#linter-not-found)
4. [Project Not Detected](#project-not-detected)
5. [Permission Issues](#permission-issues)
6. [Performance Problems](#performance-problems)
7. [TODO.json Issues](#todojson-issues)
8. [Claude Code Integration](#claude-code-integration)

## Installation Issues

### Problem: Setup Script Fails

**Symptoms:**
```bash
$ node setup-post-tool-hook.js
Error: Cannot find module './post-tool-linter-hook.js'
```

**Solution:**
1. Ensure you're running the setup from the correct directory:
   ```bash
   cd /path/to/post-tool-linter-hook
   node setup-post-tool-hook.js
   ```

2. Verify all required files exist:
   ```bash
   ls -la post-tool-linter-hook.js setup-post-tool-hook.js
   ```

3. If files are missing, re-download or re-clone the repository.

### Problem: Settings File Not Found

**Symptoms:**
```bash
Error: Cannot find Claude Code settings file
```

**Solutions:**

**For macOS/Linux:**
```bash
# Check if Claude Code is installed
which claude

# Verify settings directory exists
ls -la ~/.claude/

# Create directory if missing
mkdir -p ~/.claude
touch ~/.claude/settings.json
echo '{}' > ~/.claude/settings.json
```

**For Windows:**
```cmd
# Check AppData directory
dir "%APPDATA%\claude"

# Create if missing
mkdir "%APPDATA%\claude"
echo {} > "%APPDATA%\claude\settings.json"
```

### Problem: Permission Denied

**Symptoms:**
```bash
$ node setup-post-tool-hook.js
Error: EACCES: permission denied, open '/Users/username/.claude/settings.json'
```

**Solution:**
```bash
# Fix permissions on Claude settings
chmod 644 ~/.claude/settings.json
chmod 755 ~/.claude/

# If still failing, check ownership
ls -la ~/.claude/
sudo chown -R $(whoami) ~/.claude/
```

## Hook Not Triggering

### Problem: Hook Never Runs

**Symptoms:**
- No linting feedback when editing files in Claude Code
- No error reports generated
- No TODO tasks created

**Debugging Steps:**

1. **Verify Hook Installation:**
   ```bash
   # Check settings.json content
   cat ~/.claude/settings.json
   
   # Should contain something like:
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

2. **Test Hook Manually:**
   ```bash
   # Create test input
   echo '{"tool_name":"Edit","tool_input":{"file_path":"./test.py"},"cwd":"."}' | node /path/to/post-tool-linter-hook.js
   ```

3. **Check Hook Logs:**
   ```bash
   # Look for log file in your project
   cat post-tool-linter-hook.log
   
   # Or check recent entries
   tail -f post-tool-linter-hook.log
   ```

**Common Fixes:**

- **Wrong Path**: Ensure the hook path in settings.json is absolute
- **Not Executable**: Run `chmod +x post-tool-linter-hook.js`
- **Wrong Matcher**: Verify matcher includes the tools you're using

### Problem: Hook Runs But No Output

**Symptoms:**
- Hook executes (appears in logs)
- But no linting feedback appears
- Claude Code doesn't receive prompts

**Solutions:**

1. **Check Project Detection:**
   ```bash
   # Verify project has required config files
   # For Python:
   ls -la pyproject.toml setup.py requirements.txt
   
   # For JavaScript:
   ls -la package.json .eslintrc.js tsconfig.json
   ```

2. **Test Linters Directly:**
   ```bash
   # Python
   ruff check your-file.py
   
   # JavaScript
   eslint your-file.js
   ```

3. **Enable Debug Mode:**
   ```bash
   # Add to beginning of post-tool-linter-hook.js
   const DEBUG = true;
   ```

## Linter Not Found

### Problem: Python - Ruff Not Found

**Symptoms:**
```
Error: Command 'ruff' not found
```

**Solutions:**

1. **Install Ruff:**
   ```bash
   # Using pip
   pip install ruff
   
   # Using pipx (recommended)
   pipx install ruff
   
   # Using conda
   conda install -c conda-forge ruff
   ```

2. **Verify Installation:**
   ```bash
   ruff --version
   which ruff
   ```

3. **Path Issues:**
   ```bash
   # Add to your shell profile (.bashrc, .zshrc, etc.)
   export PATH="$HOME/.local/bin:$PATH"
   
   # Or find where ruff is installed
   find /usr -name "ruff" 2>/dev/null
   find $HOME -name "ruff" 2>/dev/null
   ```

### Problem: JavaScript - ESLint Not Found

**Symptoms:**
```
Error: Command 'eslint' not found
```

**Solutions:**

1. **Install ESLint Locally:**
   ```bash
   # In your project directory
   npm install -D eslint
   
   # Verify local installation
   npx eslint --version
   ```

2. **Install ESLint Globally:**
   ```bash
   npm install -g eslint
   eslint --version
   ```

3. **Project-Specific ESLint:**
   ```bash
   # The hook automatically looks for:
   ls -la node_modules/.bin/eslint
   
   # If missing, reinstall dependencies
   npm install
   ```

## Project Not Detected

### Problem: Hook Says "No Project Type Detected"

**Symptoms:**
```
No valid project type detected, skipping linting
```

**Python Project Requirements:**

Your project needs **at least one** of these files:

```bash
# Check for Python project indicators
ls -la pyproject.toml setup.py requirements.txt .python-version Pipfile

# Create minimal pyproject.toml if missing
cat > pyproject.toml << 'EOF'
[project]
name = "my-project"
version = "0.1.0"

[tool.ruff]
select = ["E", "F"]
EOF
```

**JavaScript Project Requirements:**

Your project needs **at least one** of these files:

```bash
# Check for JavaScript project indicators  
ls -la package.json tsconfig.json .eslintrc.js .eslintrc.json

# Create minimal package.json if missing
npm init -y

# Create minimal .eslintrc.js if missing
cat > .eslintrc.js << 'EOF'
module.exports = {
  env: { node: true, es2022: true },
  rules: {
    'no-unused-vars': 'error',
    'no-undef': 'error'
  }
};
EOF
```

### Problem: Project Files Exist But Still Not Detected

**Debugging:**

1. **Check File Contents:**
   ```bash
   # For pyproject.toml, it needs specific sections
   grep -E '\[tool\.\|\[project\]\|\[build-system\]' pyproject.toml
   
   # For package.json, it needs specific fields
   jq '.scripts // .dependencies // .devDependencies // .type' package.json
   ```

2. **Validate Configuration Files:**
   ```bash
   # Python - validate pyproject.toml
   python -c "import tomllib; print(tomllib.load(open('pyproject.toml', 'rb')))"
   
   # JavaScript - validate package.json
   node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')))"
   ```

## Permission Issues

### Problem: Cannot Write Error Reports

**Symptoms:**
```
Error: EACCES: permission denied, mkdir 'development'
```

**Solution:**
```bash
# Fix project directory permissions
chmod 755 .
mkdir -p development
chmod 755 development

# Check current permissions
ls -la development/
```

### Problem: Cannot Update TODO.json

**Symptoms:**
```
Error: EACCES: permission denied, open 'TODO.json'
```

**Solution:**
```bash
# Fix TODO.json permissions
chmod 644 TODO.json

# If file doesn't exist, create it
cat > TODO.json << 'EOF'
{
  "project": "my-project",
  "tasks": []
}
EOF
```

## Performance Problems

### Problem: Hook Takes Too Long

**Symptoms:**
- Hook times out
- Claude Code becomes unresponsive
- Linting takes more than 15 seconds

**Solutions:**

1. **Increase Timeout:**
   ```json
   // In ~/.claude/settings.json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Edit|Write|MultiEdit",
           "hooks": [
             {
               "type": "command",
               "command": "/path/to/post-tool-linter-hook.js",
               "timeout": 30000  // Increase to 30 seconds
             }
           ]
         }
       ]
     }
   }
   ```

2. **Optimize Linter Configuration:**
   ```toml
   # In pyproject.toml - exclude unnecessary directories
   [tool.ruff]
   exclude = [
       ".git",
       ".venv",
       "node_modules",
       "build",
       "dist",
       "*.egg-info"
   ]
   ```

   ```javascript
   // In .eslintignore
   node_modules/
   dist/
   build/
   *.min.js
   coverage/
   ```

3. **Use Performance-Optimized Hook:**
   ```bash
   # Use the performance-optimized version
   node setup-post-tool-hook.js --command "/path/to/performance-tests/performance-optimized-hook.js"
   ```

## TODO.json Issues

### Problem: Invalid JSON Format

**Symptoms:**
```
Error: Unexpected token in JSON at position X
```

**Solution:**
```bash
# Validate JSON syntax
node -e "console.log(JSON.parse(require('fs').readFileSync('TODO.json')))"

# Fix common issues:
# 1. Remove trailing commas
# 2. Use double quotes for strings
# 3. Escape backslashes

# Create valid minimal TODO.json
cat > TODO.json << 'EOF'
{
  "project": "my-project",
  "tasks": [],
  "current_task_index": 0
}
EOF
```

### Problem: Tasks Not Being Created

**Symptoms:**
- Hook runs successfully
- Error report is generated
- But no task appears in TODO.json

**Debugging:**
```bash
# Check if TODO.json exists and is writable
ls -la TODO.json
cat TODO.json

# Check hook logs for task creation messages
grep -i "task" post-tool-linter-hook.log

# Test TODO.json modification manually
cp TODO.json TODO.json.test
echo 'Test modification' >> TODO.json.test
```

## Claude Code Integration

### Problem: Claude Code Doesn't See Hook Output

**Symptoms:**
- Hook runs and generates reports
- But Claude Code doesn't respond to linting errors

**Solutions:**

1. **Check Hook Exit Codes:**
   The hook should exit with code 2 when errors are found:
   ```bash
   # Test hook exit code
   echo '{"tool_name":"Edit","tool_input":{"file_path":"./buggy-file.py"},"cwd":"."}' | node post-tool-linter-hook.js
   echo "Exit code: $?"
   ```

2. **Verify Error Output Format:**
   Claude Code reads from stderr:
   ```bash
   # Check what's sent to stderr
   echo '{"tool_name":"Edit","tool_input":{"file_path":"./buggy-file.py"},"cwd":"."}' | node post-tool-linter-hook.js 2>error_output.txt
   cat error_output.txt
   ```

3. **Test with Simple Example:**
   ```bash
   # Create a file with obvious errors
   echo 'print("hello"' > test_error.py  # missing closing quote
   
   # Test hook on this file
   echo '{"tool_name":"Edit","tool_input":{"file_path":"./test_error.py"},"cwd":"."}' | node post-tool-linter-hook.js
   ```

## Getting Help

If you're still experiencing issues:

1. **Enable verbose logging** in the hook script
2. **Check the GitHub issues** for similar problems
3. **Run the test suite**: `node test-linter-hook.js`
4. **Provide debug information**:
   - Operating system and version
   - Node.js version: `node --version`
   - Claude Code version
   - Hook log file contents
   - Your project structure and config files

## Quick Diagnosis Script

Create this script to quickly diagnose common issues:

```bash
#!/bin/bash
# diagnose-hook.sh

echo "=== Post-Tool Linter Hook Diagnosis ==="
echo

echo "1. System Information:"
echo "OS: $(uname -s)"
echo "Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "Python: $(python --version 2>/dev/null || echo 'Not found')"
echo

echo "2. Claude Code Settings:"
if [ -f ~/.claude/settings.json ]; then
    echo "✅ Settings file exists"
    grep -q "post-tool-linter-hook" ~/.claude/settings.json && echo "✅ Hook configured" || echo "❌ Hook not found in settings"
else
    echo "❌ Settings file not found"
fi
echo

echo "3. Linters:"
echo "Ruff: $(ruff --version 2>/dev/null || echo 'Not found')"
echo "ESLint: $(eslint --version 2>/dev/null || echo 'Not found')"
echo

echo "4. Project Detection:"
echo "Python indicators:"
ls -la pyproject.toml setup.py requirements.txt .python-version Pipfile 2>/dev/null || echo "None found"
echo "JavaScript indicators:"
ls -la package.json tsconfig.json .eslintrc.js .eslintrc.json 2>/dev/null || echo "None found"
echo

echo "5. Hook Files:"
if [ -f post-tool-linter-hook.js ]; then
    echo "✅ Hook script exists"
    [ -x post-tool-linter-hook.js ] && echo "✅ Hook is executable" || echo "❌ Hook not executable"
else
    echo "❌ Hook script not found"
fi

echo
echo "=== Diagnosis Complete ==="
```

Run with: `bash diagnose-hook.sh`