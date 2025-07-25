# Team Integration Workflows

This guide demonstrates how to integrate the Post-Tool Linter Hook into various team workflows and development processes.

## Table of Contents

1. [Team Onboarding](#team-onboarding)
2. [Code Review Integration](#code-review-integration) 
3. [CI/CD Pipeline Integration](#cicd-pipeline-integration)
4. [Git Hooks Integration](#git-hooks-integration)
5. [Multi-Project Management](#multi-project-management)
6. [Quality Gates](#quality-gates)

## Team Onboarding

### New Developer Setup Script

Create a standardized onboarding script for new team members:

```bash
#!/bin/bash
# team-onboarding.sh

echo "🚀 Setting up development environment..."

# 1. Verify prerequisites
echo "Checking prerequisites..."
node --version || { echo "❌ Node.js required"; exit 1; }
python --version || { echo "❌ Python required"; exit 1; }

# 2. Install linters globally
echo "Installing linters..."
pip install ruff
npm install -g eslint

# 3. Clone hook repository
if [ ! -d "./tools/post-tool-linter-hook" ]; then
    git clone https://github.com/company/post-tool-linter-hook.git ./tools/post-tool-linter-hook
fi

# 4. Setup hook for each project
echo "Setting up linter hooks..."
for project in ./projects/*/; do
    if [ -f "$project/package.json" ] || [ -f "$project/pyproject.toml" ]; then
        echo "Setting up hook for $project"
        cd "$project"
        node ../tools/post-tool-linter-hook/setup-post-tool-hook.js --local
        cd ..
    fi
done

# 5. Verify setup
echo "Verifying installation..."
node ./tools/post-tool-linter-hook/test-linter-hook.js

echo "✅ Development environment ready!"
```

### Team Configuration Standards

Create a team-wide configuration file:

```javascript
// .team-eslintrc.js - Team ESLint standards
module.exports = {
  env: {
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    '@company/eslint-config'  // Company-specific rules
  ],
  rules: {
    // Error prevention (non-negotiable)
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    
    // Code quality (enforced)
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'prefer-const': 'error',
    
    // Style (warnings, auto-fixable)
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single'],
    'indent': ['warn', 2],
    
    // Team-specific rules
    'max-len': ['warn', { code: 100 }],
    'no-console': 'warn',
    'camelcase': ['error', { properties: 'never' }]
  }
};
```

```toml
# .team-ruff.toml - Team Python standards
[tool.ruff]
# Team-agreed rule selection
select = [
    "E",   # pycodestyle errors
    "F",   # Pyflakes
    "W",   # pycodestyle warnings
    "I",   # isort
    "N",   # pep8-naming
    "UP",  # pyupgrade
    "B",   # flake8-bugbear
]

# Team exceptions
ignore = [
    "E501",  # Line too long (handled by formatter)
    "N818",  # Exception name should be named with an Error suffix
]

# Team standards
line-length = 100
target-version = "py39"

# Exclude patterns
exclude = [
    "migrations/",
    "*/migrations/*",
    "venv/",
    "*.pyi",
]

[tool.ruff.per-file-ignores]
"tests/*" = ["D"]  # No docstring requirements in tests
"__init__.py" = ["F401"]  # Allow unused imports
```

## Code Review Integration

### Pre-Review Checklist

Create a pre-review checklist template:

```markdown
## Pre-Review Checklist

### Linting ✅
- [ ] All files pass linting without errors
- [ ] No new linting warnings introduced
- [ ] Hook reports generated and addressed

### Testing ✅
- [ ] All tests pass
- [ ] New tests added for new functionality
- [ ] Test coverage maintained or improved

### Documentation ✅
- [ ] Code changes documented
- [ ] README updated if needed
- [ ] API documentation updated

### Hook Integration ✅
- [ ] Linter hook runs without errors
- [ ] TODO.json updated appropriately
- [ ] Error reports clear and actionable

**Hook Report Summary:**
<!-- Paste output from development/linter-errors.md -->
```

### Review Automation

Create a script for reviewers to run:

```bash
#!/bin/bash
# review-prep.sh

echo "🔍 Preparing code for review..."

# 1. Run linters on all changed files
echo "Running linters..."
git diff --name-only HEAD~1 | while read file; do
    if [[ "$file" == *.py ]]; then
        echo "Linting Python: $file"
        ruff check "$file"
    elif [[ "$file" == *.js ]] || [[ "$file" == *.ts ]]; then
        echo "Linting JavaScript: $file"
        eslint "$file"
    fi
done

# 2. Test hook on changed files
echo "Testing linter hook..."
for file in $(git diff --name-only HEAD~1); do
    echo "Testing hook on: $file"
    echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$file\"},\"cwd\":\".\"}" | node post-tool-linter-hook.js
done

# 3. Generate review summary
echo "Generating review summary..."
echo "## Linting Summary" > review-summary.md
echo "- Files changed: $(git diff --name-only HEAD~1 | wc -l)" >> review-summary.md
echo "- Linting errors: $(find . -name "linter-errors.md" -exec wc -l {} \; | tail -1 | cut -d' ' -f1)" >> review-summary.md
echo "- Hook execution: ✅" >> review-summary.md

echo "✅ Review preparation complete!"
echo "📄 See review-summary.md for details"
```

## CI/CD Pipeline Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/linting.yml
name: Linting and Quality Checks

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        # Python dependencies
        pip install ruff
        
        # JavaScript dependencies
        npm install
    
    - name: Run Python linting
      if: hashFiles('**/*.py') != ''
      run: |
        echo "Running Ruff on Python files..."
        ruff check . --format=github
    
    - name: Run JavaScript linting
      if: hashFiles('**/*.js', '**/*.ts') != ''
      run: |
        echo "Running ESLint on JavaScript/TypeScript files..."
        npx eslint . --format=compact
    
    - name: Test linter hook
      run: |
        echo "Testing linter hook integration..."
        # Test hook on changed files
        git diff --name-only ${{ github.event.before }}..${{ github.sha }} | while read file; do
          if [ -f "$file" ]; then
            echo "Testing hook on: $file"
            echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$file\"},\"cwd\":\".\"}" | node post-tool-linter-hook.js || true
          fi
        done
    
    - name: Upload linting reports
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: linting-reports
        path: |
          development/linter-errors.md
          post-tool-linter-hook.log
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                // Install linters
                sh 'pip install ruff'
                sh 'npm install -g eslint'
                
                // Install project dependencies
                sh 'npm install'
            }
        }
        
        stage('Lint Check') {
            parallel {
                stage('Python Lint') {
                    when {
                        anyOf {
                            changeset "**/*.py"
                        }
                    }
                    steps {
                        sh 'ruff check . --format=json > ruff-results.json || true'
                        
                        script {
                            def results = readJSON file: 'ruff-results.json'
                            if (results.size() > 0) {
                                unstable("Python linting issues found")
                            }
                        }
                    }
                }
                
                stage('JavaScript Lint') {
                    when {
                        anyOf {
                            changeset "**/*.js"
                            changeset "**/*.ts"
                        }
                    }
                    steps {
                        sh 'npx eslint . --format=json --output-file=eslint-results.json || true'
                        
                        script {
                            def results = readJSON file: 'eslint-results.json'
                            def hasErrors = results.any { it.errorCount > 0 }
                            if (hasErrors) {
                                unstable("JavaScript linting issues found")
                            }
                        }
                    }
                }
            }
        }
        
        stage('Hook Integration Test') {
            steps {
                script {
                    // Test hook on changed files
                    def changedFiles = sh(
                        script: 'git diff --name-only HEAD~1',
                        returnStdout: true
                    ).trim().split('\n')
                    
                    changedFiles.each { file ->
                        if (file.endsWith('.py') || file.endsWith('.js') || file.endsWith('.ts')) {
                            sh """
                                echo '{"tool_name":"Edit","tool_input":{"file_path":"${file}"},"cwd":"."}' | \
                                node post-tool-linter-hook.js || true
                            """
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Archive linting results
            archiveArtifacts artifacts: '*-results.json, development/linter-errors.md, post-tool-linter-hook.log', 
                            fingerprint: true, 
                            allowEmptyArchive: true
        }
        
        unstable {
            // Notify team of linting issues
            emailext (
                subject: "Linting Issues in ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "Linting issues found. Check the build logs and artifacts for details.",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

## Git Hooks Integration

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# pre-commit hook with linter integration

echo "🔍 Running pre-commit linting..."

# Get staged files
staged_files=$(git diff --cached --name-only --diff-filter=ACM)

# Track if any linting issues found
has_issues=false

# Process each staged file
for file in $staged_files; do
    if [[ "$file" == *.py ]]; then
        echo "Checking Python file: $file"
        if ! ruff check "$file" --quiet; then
            echo "❌ Ruff issues found in $file"
            has_issues=true
        fi
    elif [[ "$file" == *.js ]] || [[ "$file" == *.ts ]]; then
        echo "Checking JavaScript file: $file"
        if ! eslint "$file" --quiet; then
            echo "❌ ESLint issues found in $file"
            has_issues=true
        fi
    fi
done

# Test linter hook on staged files
echo "Testing linter hook integration..."
for file in $staged_files; do
    if [[ "$file" == *.py ]] || [[ "$file" == *.js ]] || [[ "$file" == *.ts ]]; then
        echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$file\"},\"cwd\":\".\"}" | \
        node post-tool-linter-hook.js > /dev/null 2>&1
        
        if [ $? -eq 2 ]; then
            echo "⚠️  Linter hook detected issues in $file"
            has_issues=true
        fi
    fi
done

if [ "$has_issues" = true ]; then
    echo ""
    echo "❌ Commit blocked due to linting issues"
    echo "💡 Run 'ruff check . --fix' or 'eslint . --fix' to auto-fix issues"
    echo "📄 Check development/linter-errors.md for detailed reports"
    exit 1
fi

echo "✅ All linting checks passed"
exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### Commit Message Hook

Create `.git/hooks/prepare-commit-msg`:

```bash
#!/bin/bash
# prepare-commit-msg hook

commit_msg_file=$1
commit_source=$2
sha1=$3

# Add linting status to commit message
if [ -f "development/linter-errors.md" ]; then
    error_count=$(grep -c "❌" development/linter-errors.md)
    if [ $error_count -gt 0 ]; then
        echo "🔧 Linting: $error_count issues addressed" >> $commit_msg_file
    else
        echo "✅ Linting: All checks passed" >> $commit_msg_file
    fi
fi

# Add TODO.json status
if [ -f "TODO.json" ]; then
    pending_tasks=$(jq '[.tasks[] | select(.status == "pending")] | length' TODO.json)
    echo "📋 Tasks: $pending_tasks pending" >> $commit_msg_file
fi
```

## Multi-Project Management

### Workspace Configuration

For managing multiple projects with consistent linting:

```bash
#!/bin/bash
# setup-workspace.sh

workspace_dir="$1"
if [ -z "$workspace_dir" ]; then
    echo "Usage: $0 <workspace_directory>"
    exit 1
fi

echo "Setting up linting for workspace: $workspace_dir"

# 1. Setup global hook configuration
mkdir -p "$workspace_dir/.config"
cp .team-eslintrc.js "$workspace_dir/.config/"
cp .team-ruff.toml "$workspace_dir/.config/"

# 2. Install hook for each project
find "$workspace_dir" -name "package.json" -o -name "pyproject.toml" | while read config_file; do
    project_dir=$(dirname "$config_file")
    echo "Setting up hook for: $project_dir"
    
    cd "$project_dir"
    
    # Link to workspace config
    if [ -f "package.json" ]; then
        ln -sf "../.config/.team-eslintrc.js" ".eslintrc.js"
    fi
    
    if [ -f "pyproject.toml" ]; then
        # Append team config to project config
        echo "" >> pyproject.toml
        cat "../.config/.team-ruff.toml" >> pyproject.toml
    fi
    
    # Install hook
    node ../tools/post-tool-linter-hook/setup-post-tool-hook.js --local
    
    cd - > /dev/null
done

echo "✅ Workspace setup complete"
```

### Centralized Reporting

Create a script to collect linting reports from all projects:

```bash
#!/bin/bash
# collect-reports.sh

workspace_dir="${1:-.}"
report_dir="$workspace_dir/reports"
mkdir -p "$report_dir"

echo "📊 Collecting linting reports from workspace..."

# Collect individual reports
find "$workspace_dir" -name "linter-errors.md" -not -path "*/reports/*" | while read report; do
    project_name=$(basename $(dirname $(dirname "$report")))
    cp "$report" "$report_dir/${project_name}-linter-errors.md"
done

# Generate summary report
cat > "$report_dir/workspace-summary.md" << 'EOF'
# Workspace Linting Summary

**Generated:** $(date -Iseconds)

## Project Status

EOF

find "$workspace_dir" -name "linter-errors.md" -not -path "*/reports/*" | while read report; do
    project_name=$(basename $(dirname $(dirname "$report")))
    error_count=$(grep -c "❌" "$report" 2>/dev/null || echo "0")
    warning_count=$(grep -c "⚠️" "$report" 2>/dev/null || echo "0")
    
    if [ "$error_count" -eq 0 ] && [ "$warning_count" -eq 0 ]; then
        status="✅ Clean"
    elif [ "$error_count" -eq 0 ]; then
        status="⚠️  $warning_count warnings"
    else
        status="❌ $error_count errors, $warning_count warnings"
    fi
    
    echo "- **$project_name**: $status" >> "$report_dir/workspace-summary.md"
done

echo "📄 Reports collected in $report_dir/"
```

## Quality Gates

### Quality Gate Script

Create quality gates for different development phases:

```bash
#!/bin/bash
# quality-gate.sh

phase="${1:-development}"
project_dir="${2:-.}"

echo "🚪 Running quality gate for phase: $phase"

case $phase in
    "development")
        # Lenient gate for active development
        max_errors=5
        max_warnings=20
        ;;
    "review")
        # Stricter gate for code review
        max_errors=0
        max_warnings=10
        ;;
    "release")
        # Strictest gate for release
        max_errors=0
        max_warnings=0
        ;;
    *)
        echo "Unknown phase: $phase"
        exit 1
        ;;
esac

# Run linting
cd "$project_dir"
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"./src/\"},\"cwd\":\".\"}" | \
node post-tool-linter-hook.js > /dev/null 2>&1

# Check results
if [ -f "development/linter-errors.md" ]; then
    error_count=$(grep -c "❌" development/linter-errors.md)
    warning_count=$(grep -c "⚠️" development/linter-errors.md)
else
    error_count=0
    warning_count=0
fi

echo "Results: $error_count errors, $warning_count warnings"
echo "Limits: $max_errors errors, $max_warnings warnings"

# Check quality gate
if [ $error_count -gt $max_errors ] || [ $warning_count -gt $max_warnings ]; then
    echo "❌ Quality gate FAILED for phase: $phase"
    echo "📄 See development/linter-errors.md for details"
    exit 1
else
    echo "✅ Quality gate PASSED for phase: $phase"
    exit 0
fi
```

### Integration with CI/CD

```yaml
# Quality gate integration in GitHub Actions
- name: Development Quality Gate
  if: github.event_name == 'push' && github.ref != 'refs/heads/main'
  run: bash quality-gate.sh development

- name: Review Quality Gate  
  if: github.event_name == 'pull_request'
  run: bash quality-gate.sh review

- name: Release Quality Gate
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: bash quality-gate.sh release
```

This comprehensive team integration guide provides practical workflows for incorporating the Post-Tool Linter Hook into various team development processes, ensuring consistent code quality across all team members and projects.