# Ignore Files Guide for Linter Hook

## Table of Contents
- [Overview](#overview)
- [How Ignore Files Work](#how-ignore-files-work)
- [Supported File Types](#supported-file-types)
- [Pattern Syntax](#pattern-syntax)
- [Framework-Specific Patterns](#framework-specific-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Overview

The linter hook automatically respects ignore files to prevent linting of files that shouldn't be checked. This includes generated files, build artifacts, dependencies, and temporary files. Understanding how to configure ignore files properly is crucial for maintaining clean, efficient linting workflows.

## How Ignore Files Work

### File Discovery Order
The linter hook checks for ignore files in this order:
1. **Linter-specific ignore files** (e.g., `.eslintignore`, `.ruffignore`)
2. **Git ignore files** (`.gitignore`)
3. **Hierarchical ignore files** (in parent directories)

### Pattern Matching
The hook uses gitignore-compatible pattern matching with enhancements:
- **Glob patterns**: `*.log`, `**/*.tmp`
- **Directory patterns**: `node_modules/`, `build/`
- **Negation patterns**: `!important.log` (re-includes files)
- **Anchored patterns**: `/root-only.txt` (matches only at root)

## Supported File Types

### JavaScript/TypeScript Projects
**Ignore File**: `.eslintignore`
```gitignore
# Dependencies
node_modules/
package-lock.json

# Build outputs
dist/
build/
.next/
.nuxt/
.vite/
.svelte-kit/

# Development files
*.dev.js
*.local.js
*.test.js.map

# Environment
.env*
```

### Python Projects
**Ignore File**: `.ruffignore`
```gitignore
# Python cache
__pycache__/
*.pyc
*.pyo
*.pyd

# Virtual environments
venv/
.venv/
env/

# Build artifacts
build/
dist/
*.egg-info/

# Framework-specific
migrations/
staticfiles/
.django/
```

## Pattern Syntax

### Basic Patterns
```gitignore
# Exact filename (anywhere in project)
filename.txt

# File extension (anywhere in project)
*.log
*.tmp

# Directory (anywhere in project)
logs/
temp/

# Root-only (anchored pattern)
/config.local.json
```

### Advanced Patterns
```gitignore
# Wildcard directory matching
**/cache/
**/node_modules/

# Character classes
*.py[cod]
*.[oa]

# Brace expansion (some implementations)
*.{js,ts,jsx,tsx}

# Negation (re-include)
*.log
!important.log
```

### Pattern Precedence
1. **More specific patterns** override general ones
2. **Later patterns** override earlier ones  
3. **Negation patterns** (`!`) re-include excluded files
4. **Directory-specific** patterns take precedence

## Framework-Specific Patterns

### React/Next.js
```gitignore
# Next.js
.next/
out/

# React build
build/
dist/

# Development
.env.local
.env.development.local
.env.test.local
.env.production.local

# Storybook
storybook-static/
```

### Vue.js/Nuxt
```gitignore
# Nuxt
.nuxt/
.output/
.nitro/
dist/

# Vue build
dist/
node_modules/

# IDE
.vscode/
.idea/
```

### Django/Python Web
```gitignore
# Django
*/migrations/
staticfiles/
media/
*.mo
*.pot

# Flask
instance/
.webassets-cache

# FastAPI
__pycache__/
.coverage
htmlcov/
```

### Node.js/Express
```gitignore
# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Dependencies
node_modules/
jspm_packages/

# Build
dist/
build/
```

## Best Practices

### 1. Layer Your Ignore Files
```gitignore
# Global .gitignore (committed)
node_modules/
*.log
.env

# Local .eslintignore (project-specific)
build/
coverage/
docs/generated/
```

### 2. Be Specific Over General
```gitignore
# ❌ Too broad
*.js

# ✅ Specific
*.min.js
*.bundle.js
build/**/*.js
```

### 3. Document Your Patterns
```gitignore
# =========================
# Dependencies
# =========================
node_modules/
package-lock.json

# =========================
# Build Outputs  
# =========================
dist/
build/
coverage/
```

### 4. Use Framework Templates
Start with framework-specific templates and customize:
- **React**: Use Create React App's default `.gitignore`
- **Vue**: Use Vue CLI's default patterns
- **Python**: Use Python.org's recommended `.gitignore`

### 5. Test Your Patterns
```bash
# Test if file would be ignored
git check-ignore path/to/file

# Show ignore patterns matching file
git check-ignore -v path/to/file

# Test linter hook patterns
node -e "console.log(require('./post-tool-linter-hook.js').testIgnorePattern('path/to/file'))"
```

## Troubleshooting

### Common Issues

#### 1. Files Still Being Linted
**Problem**: Important files are ignored but generated files are still being linted.

**Solutions**:
```gitignore
# Ensure directory patterns end with /
build/
dist/

# Use ** for nested matching
**/generated/
**/node_modules/

# Check pattern precedence
*.temp
!important.temp  # This re-includes important.temp
```

#### 2. Important Files Being Ignored
**Problem**: Files you want to lint are being ignored.

**Solutions**:
```gitignore
# Use negation to re-include
dist/
!dist/custom-important.js

# Be more specific with initial pattern
dist/generated/
# Instead of: dist/
```

#### 3. Pattern Not Working
**Debugging steps**:
1. Check pattern syntax (anchoring, wildcards)
2. Verify file path (relative vs absolute)
3. Test with git check-ignore
4. Check pattern order (later patterns override)

### Diagnostic Commands
```bash
# Show effective ignore patterns
git ls-files --others --ignored --exclude-standard

# Test specific patterns
echo "pattern" | git check-ignore --stdin

# Debug linter hook (if available)
DEBUG=1 node post-tool-linter-hook.js
```

## Advanced Configuration

### Custom Ignore File Locations
```javascript
// In post-tool-linter-hook.js CONFIG
linters: {
  javascript: {
    ignoreFiles: ['.eslintignore', '.gitignore', 'custom.ignore'],
    // ...
  }
}
```

### Dynamic Pattern Generation
```javascript
// Framework detection and auto-patterns
function getFrameworkPatterns(projectPath) {
  const packageJson = require(path.join(projectPath, 'package.json'));
  
  if (packageJson.dependencies?.react) {
    return ['build/', '.next/', 'coverage/'];
  }
  
  if (packageJson.dependencies?.vue) {
    return ['.nuxt/', 'dist/', '.output/'];
  }
  
  return [];
}
```

### Performance Optimization
```gitignore
# Group patterns by type for better performance
# Dependencies (checked first)
node_modules/
.pnpm-store/

# Build outputs (checked second)  
dist/
build/
.next/

# Temporary files (checked last)
*.tmp
*.log
.cache/
```

### Integration with CI/CD
```gitignore
# CI-specific ignores
.github/
.gitlab-ci.yml
.travis.yml

# Deployment artifacts
deploy/
.deployment/
terraform.tfstate
```

## Quick Reference

### Most Common Patterns
```gitignore
# Universal
node_modules/
.git/
*.log
*.tmp
.env*

# JavaScript
dist/
build/
coverage/
.next/
.nuxt/

# Python  
__pycache__/
*.pyc
.venv/
.pytest_cache/

# Generated files
*.min.js
*.bundle.js
*.map
docs/generated/
```

### Pattern Testing
```bash
# Test if file matches ignore patterns
git check-ignore path/to/file

# Show which pattern matched
git check-ignore -v path/to/file

# List all ignored files
git ls-files --others --ignored --exclude-standard
```

---

## Getting Help

If you're experiencing issues with ignore files:

1. **Check the log file**: `post-tool-linter-hook.log` contains detailed pattern matching information
2. **Test patterns**: Use `git check-ignore` to test your patterns
3. **Review this guide**: Check the framework-specific sections for your project type
4. **Enable debug mode**: Set `DEBUG=1` environment variable for verbose logging

For more advanced scenarios, see the [Advanced Configuration](#advanced-configuration) section or review the linter hook source code.