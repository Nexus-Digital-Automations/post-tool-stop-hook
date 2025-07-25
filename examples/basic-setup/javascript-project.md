# Basic JavaScript Project Setup

This guide shows how to set up the Post-Tool Linter Hook for a JavaScript/TypeScript project from scratch.

## Prerequisites

- Claude Code installed and configured
- Node.js 16+ installed
- npm or yarn package manager

## Step-by-Step Setup

### 1. Create Project Structure

```bash
mkdir my-js-project
cd my-js-project

# Create basic project structure
mkdir src tests
touch src/index.js
touch src/utils.js
touch tests/index.test.js
```

### 2. Initialize Node.js Project

```bash
# Initialize package.json
npm init -y

# Install ESLint as dev dependency
npm install -D eslint

# Optional: Install additional ESLint plugins
npm install -D @eslint/js
```

### 3. Create ESLint Configuration

Create `.eslintrc.js` with basic linting rules:

```javascript
module.exports = {
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Error prevention
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    
    // Code quality
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'prefer-const': 'warn',
    
    // Style consistency  
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { 'allowTemplateLiterals': true }],
    'indent': ['warn', 2],
    'comma-spacing': ['warn', { 'before': false, 'after': true }],
    'key-spacing': ['warn', { 'beforeColon': false, 'afterColon': true }]
  }
};
```

### 4. Update package.json

Add linting scripts to `package.json`:

```json
{
  "name": "my-js-project",
  "version": "1.0.0",
  "description": "A sample JavaScript project",
  "main": "src/index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  },
  "devDependencies": {
    "eslint": "^8.0.0"
  }
}
```

### 5. Create Sample Code with Issues

Create `src/index.js` with intentional linting issues:

```javascript
// Missing semicolon, unused import
import fs from 'fs'
import path from 'path'  // unused import

// Using var instead of const/let
var userName = "World"

// Double quotes instead of single
const greeting = "Hello"

// Missing spaces around operators
function addNumbers(a,b){
  return a+b  // missing semicolon
}

// Unused variable
function main() {
  let unused = 42
  
  // Using == instead of ===
  if (userName == "World") {
    console.log(greeting + ", " + userName + "!")  // string concatenation instead of template literal
  }
  
  const result=addNumbers(5,10)  // missing spaces around =
  console.log("Result: " + result)  // missing semicolon, string concatenation
}

// Missing semicolon
main()
```

Create `src/utils.js` with more issues:

```javascript
// Function with unused parameter
function processData(data, options) {
  return data.map(item => item.toUpperCase())  // missing semicolon
}

// Unreachable code
function unreachableExample() {
  return 'done';
  console.log('This will never execute');  // unreachable
}

// Using eval (dangerous)
function dangerousFunction(code) {
  return eval(code);  // should be avoided
}

export { processData, unreachableExample, dangerousFunction };
```

### 6. Install the Linter Hook

```bash
# Install for this project only
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --local

# Verify installation
node /path/to/post-tool-linter-hook/setup-post-tool-hook.js --validate
```

### 7. Test the Setup

Create a test script to verify the hook works:

```javascript
// test-hook.js
const { spawn } = require('child_process');
const fs = require('fs');

async function testHook() {
  // Simulate Claude Code tool usage
  const hookInput = {
    tool_name: 'Edit',
    tool_input: {
      file_path: './src/index.js'
    },
    tool_output: {
      success: true
    },
    cwd: '.'
  };
  
  console.log('Testing linter hook...');
  
  const child = spawn('node', ['/path/to/post-tool-linter-hook.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let stdout = '';
  let stderr = '';
  
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  
  child.on('close', (code) => {
    console.log('Hook stdout:', stdout);
    console.log('Hook stderr:', stderr);
    console.log('Exit code:', code);
    
    if (code === 2) {
      console.log('✅ Hook detected linting issues (expected)');
      
      // Check if error report was created
      if (fs.existsSync('development/linter-errors.md')) {
        console.log('✅ Error report created');
        const report = fs.readFileSync('development/linter-errors.md', 'utf8');
        console.log('Report content:');
        console.log(report);
      } else {
        console.log('❌ Error report not found');
      }
    } else {
      console.log('❌ Hook did not detect linting issues');
    }
  });
  
  // Send input to hook
  child.stdin.write(JSON.stringify(hookInput));
  child.stdin.end();
}

testHook();
```

Run the test:

```bash
node test-hook.js
```

## Expected Results

After running the test, you should see:

1. **Hook execution**: The hook runs and detects multiple linting issues
2. **Error report**: A detailed report in `development/linter-errors.md`
3. **TODO task**: A new high-priority task in `TODO.json` (if it exists)

### Sample Error Report

The `development/linter-errors.md` file should contain something like:

```markdown
# Linter Errors Report

**Generated:** 2025-07-25T19:57:31.221Z
**Total Issues:** 15 (12 errors, 3 warnings)
**Files:** 1

## index.js (eslint)

**File Path:** `/path/to/my-js-project/src/index.js`
**Issues:** 15

❌ **Line 2:20** - Missing semicolon. [semi]
❌ **Line 3:1** - 'path' is defined but never used. [no-unused-vars]
❌ **Line 6:1** - Unexpected var, use let or const instead. [no-var]
❌ **Line 9:18** - Strings must use single quotes. [quotes]
❌ **Line 12:16** - Missing space after comma. [comma-spacing]
❌ **Line 12:18** - Missing space before opening brace. [space-before-blocks]
❌ **Line 13:12** - Missing space around operator. [space-infix-ops]
❌ **Line 13:14** - Missing semicolon. [semi]
❌ **Line 18:7** - 'unused' is assigned a value but never used. [no-unused-vars]
❌ **Line 21:17** - Expected '===' and instead saw '=='. [eqeqeq]
```

## Next Steps

1. **Fix the linting issues** manually or using auto-fix:
   ```bash
   npm run lint:fix
   ```

2. **Run ESLint manually** to verify fixes:
   ```bash
   npm run lint
   ```

3. **Use Claude Code** to edit files and see the hook in action

4. **Customize configuration** in `.eslintrc.js` as needed

## Common Issues

### ESLint Not Found

```bash
# Install ESLint locally
npm install -D eslint

# Or globally
npm install -g eslint
```

### Project Not Detected

Ensure you have at least one of these files:
- `package.json` (with `scripts`, `dependencies`, `devDependencies`, or `type`)
- `tsconfig.json`
- `.eslintrc.json` or `.eslintrc.js`

### Hook Not Running

- Verify Claude Code settings in `~/.claude/settings.json`
- Check hook script path is absolute
- Ensure hook script permissions: `chmod +x post-tool-linter-hook.js`

## Advanced Configuration

### TypeScript Support

```bash
# Install TypeScript ESLint support
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin typescript

# Update .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
};
```

### React Support

```bash
# Install React ESLint plugin
npm install -D eslint-plugin-react eslint-plugin-react-hooks

# Update .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  plugins: ['react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

### Prettier Integration

```bash
# Install Prettier and ESLint integration
npm install -D prettier eslint-config-prettier

# Update .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'prettier'  // Must be last to override conflicting rules
  ],
  rules: {
    // Your custom rules
  }
};

# Create .prettierrc.js
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5'
};
```

This completes the basic JavaScript project setup. Your project should now have automatic linting integrated with Claude Code!