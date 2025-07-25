# Basic Python Project Setup

This guide shows how to set up the Post-Tool Linter Hook for a Python project from scratch.

## Prerequisites

- Claude Code installed and configured
- Python 3.8+ installed
- Node.js installed (for the hook)

## Step-by-Step Setup

### 1. Create Project Structure

```bash
mkdir my-python-project
cd my-python-project

# Create basic Python files
mkdir src tests
touch src/__init__.py
touch src/main.py
touch tests/__init__.py
touch tests/test_main.py
```

### 2. Install Python Dependencies

```bash
# Install ruff linter
pip install ruff

# Or add to requirements.txt
echo "ruff>=0.1.0" > requirements.txt
pip install -r requirements.txt
```

### 3. Create Project Configuration

Create `pyproject.toml` with basic linting configuration:

```toml
[project]
name = "my-python-project"
version = "0.1.0"
description = "A sample Python project"
dependencies = []

[tool.ruff]
# Enable pycodestyle (`E`) and Pyflakes (`F`) codes by default
select = ["E", "F"]
ignore = []

# Allow fix for all enabled rules (when `--fix`) is provided
fixable = ["ALL"]
unfixable = []

# Exclude common directories
exclude = [
    ".git",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
]

# Same as Black
line-length = 88
indent-width = 4

# Assume Python 3.8+
target-version = "py38"
```

### 4. Create Sample Code with Issues

Create `src/main.py` with intentional linting issues:

```python
import os
import sys
import json  # unused import

def hello_world( ):  # extra space in function def
    name="World"   # missing space around operator
    print(f"Hello, {name}!")
    
    unused_variable = 42  # unused variable
    
def add_numbers(a,b):  # missing spaces after commas
    return a+b  # missing spaces around operator

if __name__ == "__main__":
    hello_world()
    result=add_numbers(5,10)  # missing spaces
    print(f"Result: {result}")
```

### 5. Install the Linter Hook

```bash
# Clone the hook repository (if not already done)
git clone https://github.com/your-username/post-tool-linter-hook.git

# Install for this project only
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --local

# Verify installation
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --validate
```

### 6. Test the Setup

Create a simple test to verify the hook works:

```bash
# Create a test script
cat > test_hook.py << 'EOF'
#!/usr/bin/env python3

import json
import subprocess
import sys

def test_hook():
    # Simulate Claude Code tool usage
    hook_input = {
        "tool_name": "Edit",
        "tool_input": {
            "file_path": "./src/main.py"
        },
        "tool_output": {
            "success": True
        },
        "cwd": "."
    }
    
    # Run the hook
    process = subprocess.Popen(
        ['node', '/path/to/post-tool-linter-hook.js'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(json.dumps(hook_input))
    
    print("Hook stdout:", stdout)
    print("Hook stderr:", stderr)
    print("Exit code:", process.returncode)
    
    # Check if linter errors were reported
    if process.returncode == 2:
        print("✅ Hook detected linting issues (expected)")
        
        # Check if error report was created
        import os
        if os.path.exists('development/linter-errors.md'):
            print("✅ Error report created")
            with open('development/linter-errors.md', 'r') as f:
                print("Report content:")
                print(f.read())
        else:
            print("❌ Error report not found")
    else:
        print("❌ Hook did not detect linting issues")

if __name__ == "__main__":
    test_hook()
EOF

python test_hook.py
```

## Expected Results

After running the test, you should see:

1. **Hook execution**: The hook runs and detects linting issues
2. **Error report**: A detailed report in `development/linter-errors.md`
3. **TODO task**: A new high-priority task in `TODO.json` (if it exists)

### Sample Error Report

The `development/linter-errors.md` file should contain something like:

```markdown
# Linter Errors Report

**Generated:** 2025-07-25T19:56:48.322Z
**Total Issues:** 8 (8 errors, 0 warnings)
**Files:** 1

## main.py (ruff)

**File Path:** `/path/to/my-python-project/src/main.py`
**Issues:** 8

❌ **Line 3:1** - `json` imported but unused [F401]
❌ **Line 5:19** - Whitespace before ')' [E201]
❌ **Line 6:10** - Missing whitespace around operator [E225]
❌ **Line 9:1** - Local variable `unused_variable` is assigned to but never used [F841]
❌ **Line 11:16** - Missing whitespace after ',' [E231]
❌ **Line 12:13** - Missing whitespace around operator [E225]
❌ **Line 16:11** - Missing whitespace around operator [E225]
❌ **Line 17:24** - Missing whitespace after ',' [E231]
```

## Next Steps

1. **Fix the linting issues** by editing `src/main.py`
2. **Run ruff manually** to verify fixes: `ruff check src/`
3. **Use Claude Code** to edit files and see the hook in action
4. **Customize configuration** in `pyproject.toml` as needed

## Common Issues

### Hook Not Running

- Verify Claude Code settings: `~/.claude/settings.json`
- Check hook script path is absolute and correct
- Ensure hook script is executable: `chmod +x post-tool-linter-hook.js`

### Ruff Not Found

```bash
# Install ruff globally
pip install ruff

# Or in a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install ruff
```

### Project Not Detected

Ensure you have at least one of these files:
- `pyproject.toml` (with `[tool.*]` or `[project]` sections)
- `setup.py` (with `setup()` call)
- `requirements.txt`
- `.python-version`
- `Pipfile`

## Advanced Configuration

### Stricter Rules

Add more rule categories to `pyproject.toml`:

```toml
[tool.ruff]
select = [
    "E",   # pycodestyle errors
    "F",   # Pyflakes
    "W",   # pycodestyle warnings
    "I",   # isort (import sorting)
    "N",   # pep8-naming
    "D",   # pydocstyle (docstrings)
    "UP",  # pyupgrade
    "B",   # flake8-bugbear
]
```

### Custom Ignore Patterns

```toml
[tool.ruff]
ignore = [
    "E501",  # Line too long
    "D100",  # Missing docstring in public module
    "D104",  # Missing docstring in public package
]
```

### Per-File Ignores

```toml
[tool.ruff.per-file-ignores]
"tests/*.py" = ["D"]  # No docstring requirements in tests
"__init__.py" = ["F401"]  # Allow unused imports in __init__.py
```

This completes the basic Python project setup. Your project should now have automatic linting integrated with Claude Code!