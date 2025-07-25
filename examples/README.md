# Examples and Use Cases

This directory contains real-world examples, use cases, and sample configurations for the Post-Tool Linter Hook system.

## Directory Structure

```
examples/
├── README.md                    # This file
├── basic-setup/                 # Basic installation examples
├── project-configurations/      # Sample project configs
├── troubleshooting/            # Common issues and solutions
├── workflows/                  # Integration workflows
└── advanced-usage/             # Advanced configurations
```

## Quick Start Examples

### 1. Python Project Setup

```bash
# Example: Setting up linter hook for a Python project
cd my-python-project

# Ensure you have a pyproject.toml
cat > pyproject.toml << 'EOF'
[tool.ruff]
select = ["E", "F", "W", "I"]
ignore = ["E501"]
line-length = 88

[project]
name = "my-project"
version = "0.1.0"
EOF

# Install the hook
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --local
```

### 2. JavaScript Project Setup

```bash
# Example: Setting up linter hook for a JavaScript project  
cd my-js-project

# Ensure you have package.json and ESLint config
npm init -y
npm install -D eslint

# Create ESLint config
cat > .eslintrc.js << 'EOF'
module.exports = {
  env: {
    node: true,
    es2022: true
  },
  rules: {
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error'
  }
};
EOF

# Install the hook  
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --local
```

### 3. Mixed Project (Python + JavaScript)

```bash
# Example: Full-stack project with both Python and JavaScript
cd my-fullstack-project

# Python backend setup
mkdir backend
cd backend
cat > pyproject.toml << 'EOF'
[tool.ruff]
select = ["E", "F", "W", "I", "N"]
line-length = 88

[project]
name = "backend"
version = "0.1.0"
EOF
cd ..

# JavaScript frontend setup
mkdir frontend
cd frontend
npm init -y
npm install -D eslint
cat > .eslintrc.js << 'EOF'
module.exports = {
  env: { browser: true, es2022: true },
  rules: {
    'no-unused-vars': 'error',
    'no-undef': 'error'
  }
};
EOF
cd ..

# Install hook at project root
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --local
```

## Common Use Cases

### Use Case 1: New Project Onboarding

**Scenario**: Setting up linting for a new team member

1. **Clone project**:
   ```bash
   git clone https://github.com/company/project.git
   cd project
   ```

2. **Install dependencies**:
   ```bash
   # Python projects
   pip install -r requirements.txt
   pip install ruff
   
   # JavaScript projects  
   npm install
   ```

3. **Setup hook**:
   ```bash
   node /path/to/setup-post-tool-hook.js --local
   ```

4. **Verify setup**:
   ```bash
   node /path/to/test-linter-hook.js
   ```

### Use Case 2: CI/CD Integration

**Scenario**: Using the hook in continuous integration pipelines

```yaml
# .github/workflows/lint-check.yml
name: Lint Check
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      # Python projects
      - name: Install Python dependencies
        run: |
          pip install ruff
          
      # JavaScript projects  
      - name: Install JS dependencies
        run: npm install
        
      # Run linter hook manually
      - name: Run linting
        run: |
          echo '{"tool_name":"Edit","tool_input":{"file_path":"./src/main.py"},"cwd":"./"}' | node post-tool-linter-hook.js
```

### Use Case 3: Legacy Codebase Cleanup

**Scenario**: Gradually improving code quality in an existing project

1. **Start with minimal config**:
   ```toml
   # pyproject.toml - start conservative
   [tool.ruff]  
   select = ["E9", "F63", "F7", "F82"]  # Only critical errors
   ```

2. **Progressively tighten rules**:
   ```toml
   # After initial cleanup
   [tool.ruff]
   select = ["E", "F"]  # Add all pycodestyle errors
   
   # After more cleanup
   select = ["E", "F", "W", "I"]  # Add warnings and imports
   ```

3. **Monitor progress**:
   ```bash
   # Track improvement over time
   ruff check . --statistics
   ```

## See Also

- [basic-setup/](basic-setup/) - Simple installation examples
- [project-configurations/](project-configurations/) - Real project configs
- [troubleshooting/](troubleshooting/) - Common problems and solutions
- [workflows/](workflows/) - Team integration workflows
- [advanced-usage/](advanced-usage/) - Complex configurations