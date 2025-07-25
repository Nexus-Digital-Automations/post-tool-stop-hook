// ESLint configuration for post-tool-linter-hook project
// Compatible with ESLint v9+

const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      // Error prevention rules
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      
      // Code quality rules
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // Style rules (relaxed for CLI tools)
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { 'allowTemplateLiterals': true }],
      'indent': ['warn', 2, { 'SwitchCase': 1 }],
      'comma-dangle': ['warn', 'never'],
      
      // Allow console statements for CLI tools
      'no-console': 'off',
      
      // Disable rules that conflict with CLI script patterns
      'no-process-exit': 'off',
      'no-sync': 'off'
    }
  },
  {
    // Test files have more relaxed rules
    files: ['**/*.test.js', '**/test-*.js', '**/tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];