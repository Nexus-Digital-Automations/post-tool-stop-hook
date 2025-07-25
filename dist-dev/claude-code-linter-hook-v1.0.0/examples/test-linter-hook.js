#!/usr/bin/env node

/**
 * Test script for Post-Tool Linter Hook
 * 
 * This script simulates Claude Code tool usage to test the linter hook
 */

const { spawn } = require('child_process');
const path = require('path');

const HOOK_PATH = path.resolve(__dirname, 'post-tool-linter-hook.js');

// Test data simulating Claude Code hook input
const testCases = [
  {
    name: 'Python file edit with violations',
    input: {
      session_id: 'test-session-1',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(__dirname, 'test_files', 'example.py'),
        old_string: 'def foo():\n    pass',
        new_string: 'def foo( ):\n    x=1\n    return x'
      },
      tool_output: {
        success: true,
        message: 'File edited successfully'
      },
      cwd: __dirname
    }
  },
  {
    name: 'JavaScript file write',
    input: {
      session_id: 'test-session-2',
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(__dirname, 'test_files', 'example.js'),
        content: 'function test() {\n  console.log("test")\n}'
      },
      tool_output: {
        success: true
      },
      cwd: __dirname
    }
  },
  {
    name: 'MultiEdit on multiple files',
    input: {
      session_id: 'test-session-3',
      hook_event_name: 'PostToolUse',
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: path.join(__dirname, 'test_files', 'multi.py'),
        edits: [
          {
            old_string: 'import os',
            new_string: 'import os\nimport sys'
          }
        ]
      },
      tool_output: {
        success: true
      },
      cwd: __dirname
    }
  },
  {
    name: 'Non-code file (should skip)',
    input: {
      session_id: 'test-session-4',
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(__dirname, 'README.md'),
        content: '# Test'
      },
      tool_output: {
        success: true
      },
      cwd: __dirname
    }
  }
];

// Create test files
const fs = require('fs');
const testDir = path.join(__dirname, 'test_files');

function setupTestFiles() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Create Python test file with violations
  fs.writeFileSync(
    path.join(testDir, 'example.py'),
    `def foo( ):  # Extra spaces in parentheses
    x=1  # Missing spaces around =
    y = 2
    unused_var = 3  # Unused variable
    return x
`
  );
  
  // Create JavaScript test file
  fs.writeFileSync(
    path.join(testDir, 'example.js'),
    `function test() {
  console.log("test")  // Missing semicolon
  var x = 1  // Should use const/let
}
`
  );
  
  // Create another Python file
  fs.writeFileSync(
    path.join(testDir, 'multi.py'),
    `import os
import sys
import json  # Unused import

def process():
    pass
`
  );
}

async function runTest(testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${testCase.name}`);
  console.log(`${'='.repeat(60)}\n`);
  
  return new Promise((resolve) => {
    const child = spawn('node', [HOOK_PATH], {
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
      console.log(`Exit code: ${code}`);
      
      if (stdout) {
        console.log('\nSTDOUT:');
        console.log(stdout);
      }
      
      if (stderr) {
        console.log('\nSTDERR (Claude Prompt):');
        console.log(stderr);
      }
      
      if (!stdout && !stderr) {
        console.log('No output (hook passed silently)');
      }
      
      resolve({ code, stdout, stderr });
    });
    
    // Send test input
    child.stdin.write(JSON.stringify(testCase.input));
    child.stdin.end();
  });
}

async function runAllTests() {
  console.log('=== Post-Tool Linter Hook Test Suite ===\n');
  
  // Check if hook exists
  if (!fs.existsSync(HOOK_PATH)) {
    console.error(`❌ Hook script not found at: ${HOOK_PATH}`);
    process.exit(1);
  }
  
  // Setup test files
  console.log('Setting up test files...');
  setupTestFiles();
  
  // Check if linters are available
  console.log('\nChecking linter availability:');
  try {
    require('child_process').execSync('ruff --version', { stdio: 'pipe' });
    console.log('✅ Ruff is installed');
  } catch {
    console.log('⚠️  Ruff is not installed (Python linting will be skipped)');
  }
  
  try {
    require('child_process').execSync('eslint --version', { stdio: 'pipe' });
    console.log('✅ ESLint is installed');
  } catch {
    console.log('⚠️  ESLint is not installed (JavaScript linting will be skipped)');
  }
  
  // Run tests
  const results = [];
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push({ name: testCase.name, ...result });
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test Summary:');
  console.log(`${'='.repeat(60)}\n`);
  
  for (const result of results) {
    const status = result.code === 0 ? '✅ PASS' : 
      result.code === 2 ? '🔍 LINT' : '❌ FAIL';
    console.log(`${status} ${result.name} (exit: ${result.code})`);
  }
  
  // Cleanup
  console.log('\nCleaning up test files...');
  fs.rmSync(testDir, { recursive: true, force: true });
  
  console.log('\nTest complete!');
}

// Run tests
runAllTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});