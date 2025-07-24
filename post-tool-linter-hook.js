#!/usr/bin/env node

/**
 * Post-Tool Linter Hook for Claude Code
 * 
 * This hook runs after Claude Code uses file modification tools (Edit, Write, MultiEdit)
 * and automatically runs appropriate linters (ruff for Python, ESLint for JavaScript).
 * If linting errors are found, it prompts Claude to fix them before continuing.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Initialize logging
let logFile = null;
let logContent = [];

function initializeLogging(projectPath) {
  const logPath = path.join(projectPath, 'post-tool-linter-hook.log');
  logFile = logPath;
  logContent = [];
  log('=== POST-TOOL LINTER HOOK LOG ===');
  log(`Date: ${new Date().toISOString()}`);
  log(`Project: ${projectPath}`);
  log(`Node Version: ${process.version}`);
  log(`Platform: ${process.platform}`);
  log('');
}

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  // Only log to file, not stderr (keep stderr clean for Claude prompts)
  logContent.push(logEntry);
  
  if (data !== null) {
    const dataStr = JSON.stringify(data, null, 2);
    logContent.push(`  Data: ${dataStr}`);
  }
}

function writeLogFile() {
  if (logFile && logContent.length > 0) {
    try {
      fs.writeFileSync(logFile, logContent.join('\n') + '\n');
      // Don't log to stderr - keep it clean for Claude prompts
    } catch (error) {
      // Silently fail log file writes to avoid cluttering stderr
    }
  }
}

// Configuration
const CONFIG = {
  timeout: 10000, // 10 seconds max for linting
  enabledTools: ['Edit', 'Write', 'MultiEdit'],
  linters: {
    python: {
      command: 'ruff check --format json',
      fileExtensions: ['.py', '.pyi'],
      configFiles: ['pyproject.toml', 'setup.py', 'requirements.txt', '.python-version', 'Pipfile']
    },
    javascript: {
      command: 'eslint --format json',
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
      configFiles: ['package.json', 'tsconfig.json', '.eslintrc.json', '.eslintrc.js']
    }
  },
  skipExtensions: ['.json', '.md', '.txt', '.yml', '.yaml', '.xml', '.csv', '.log']
};

// Utility functions
function detectProjectType(projectPath) {
  log(`Detecting project type for: ${projectPath}`);
  
  for (const [type, config] of Object.entries(CONFIG.linters)) {
    log(`Checking for ${type} project indicators...`);
    for (const configFile of config.configFiles) {
      const configPath = path.join(projectPath, configFile);
      const exists = fs.existsSync(configPath);
      log(`  ${configFile}: ${exists ? 'FOUND' : 'not found'}`);
      
      if (exists) {
        log(`Project type detected: ${type}`);
        return type;
      }
    }
  }
  
  log('No project type detected');
  return null;
}

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  log(`Getting file type for extension: ${ext}`);
  
  // Check if extension should be skipped
  if (CONFIG.skipExtensions.includes(ext)) {
    log(`Extension ${ext} is in skip list - no linting needed`);
    return null;
  }
  
  for (const [type, config] of Object.entries(CONFIG.linters)) {
    if (config.fileExtensions.includes(ext)) {
      log(`File type detected: ${type}`);
      return type;
    }
  }
  
  log(`No linter configured for extension: ${ext}`);
  return null;
}

function extractFilePaths(hookData) {
  const paths = [];
  log(`Extracting file paths from tool: ${hookData.tool_name}`);
  
  if (hookData.tool_name === 'Edit' || hookData.tool_name === 'Write') {
    if (hookData.tool_input?.file_path) {
      paths.push(hookData.tool_input.file_path);
      log(`Found file path: ${hookData.tool_input.file_path}`);
    }
  } else if (hookData.tool_name === 'MultiEdit') {
    if (hookData.tool_input?.file_path) {
      paths.push(hookData.tool_input.file_path);
      log(`Found file path: ${hookData.tool_input.file_path}`);
    }
  }
  
  const existingPaths = paths.filter(p => {
    const exists = p && fs.existsSync(p);
    log(`Checking path existence: ${p} - ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    return exists;
  });
  
  log(`Total paths found: ${existingPaths.length}`);
  return existingPaths;
}

async function runPythonLinter(filePath, projectPath) {
  log(`Running Python linter (ruff) on: ${filePath}`);
  
  try {
    const command = `ruff check "${filePath}" --output-format json`;
    log(`Executing command: ${command}`);
    
    const result = execSync(command, {
      cwd: projectPath,
      encoding: 'utf8',
      timeout: CONFIG.timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    log(`Ruff executed successfully, parsing output...`);
    const violations = JSON.parse(result || '[]');
    log(`Found ${violations.length} violations`);
    
    return {
      success: violations.length === 0,
      linter: 'ruff',
      file: filePath,
      violations: violations.map(v => ({
        line: v.location?.row || v.location?.start?.row || 0,
        column: v.location?.column || v.location?.start?.column || 0,
        code: v.code,
        message: v.message,
        severity: 'error',
        fixable: v.fix !== null && v.fix !== undefined
      }))
    };
  } catch (error) {
    log(`Ruff execution failed with status: ${error.status}`);
    
    // Ruff returns non-zero exit code when violations found
    if (error.status === 1 && error.stdout) {
      try {
        log(`Parsing error stdout for violations...`);
        const violations = JSON.parse(error.stdout);
        log(`Found ${violations.length} violations from error output`);
        
        return {
          success: false,
          linter: 'ruff',
          file: filePath,
          violations: violations.map(v => ({
            line: v.location?.row || v.location?.start?.row || 0,
            column: v.location?.column || v.location?.start?.column || 0,
            code: v.code,
            message: v.message,
            severity: 'error',
            fixable: v.fix !== null && v.fix !== undefined
          }))
        };
      } catch (parseError) {
        log(`Failed to parse ruff output: ${parseError.message}`);
        return { success: true, linter: 'ruff', file: filePath, violations: [] };
      }
    }
    
    // Check if ruff is installed
    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
      log('ERROR: Ruff is not installed');
      return { success: true, linter: 'ruff', file: filePath, violations: [], skipped: true, reason: 'Ruff not installed' };
    }
    
    log(`Unexpected error running ruff: ${error.message}`);
    return { success: true, linter: 'ruff', file: filePath, violations: [] };
  }
}

async function runJavaScriptLinter(filePath, projectPath) {
  try {
    // Try to find eslint
    let eslintCommand = 'eslint';
    if (fs.existsSync(path.join(projectPath, 'node_modules', '.bin', 'eslint'))) {
      eslintCommand = path.join(projectPath, 'node_modules', '.bin', 'eslint');
    }
    
    const result = execSync(`"${eslintCommand}" "${filePath}" --format json`, {
      cwd: projectPath,
      encoding: 'utf8',
      timeout: CONFIG.timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const reports = JSON.parse(result || '[]');
    const fileReport = reports[0] || { messages: [] };
    
    return {
      success: fileReport.errorCount === 0 && fileReport.warningCount === 0,
      linter: 'eslint',
      file: filePath,
      violations: fileReport.messages.map(m => ({
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? 'error' : 'warning',
        message: m.message,
        code: m.ruleId,
        fixable: m.fix !== undefined
      }))
    };
  } catch (error) {
    // ESLint returns non-zero when violations found
    if (error.stdout) {
      try {
        const reports = JSON.parse(error.stdout);
        const fileReport = reports[0] || { messages: [] };
        
        return {
          success: fileReport.errorCount === 0,
          linter: 'eslint',
          file: filePath,
          violations: fileReport.messages.map(m => ({
            line: m.line,
            column: m.column,
            severity: m.severity === 2 ? 'error' : 'warning',
            message: m.message,
            code: m.ruleId,
            fixable: m.fix !== undefined
          }))
        };
      } catch (parseError) {
        return { success: true, linter: 'eslint', file: filePath, violations: [] };
      }
    }
    
    // Check if eslint is installed
    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
      return { success: true, linter: 'eslint', file: filePath, violations: [], skipped: true, reason: 'ESLint not installed' };
    }
    
    return { success: true, linter: 'eslint', file: filePath, violations: [] };
  }
}

async function lintFile(filePath, projectPath) {
  log(`\n--- Linting file: ${filePath} ---`);
  
  const fileType = getFileType(filePath);
  const projectType = detectProjectType(projectPath);
  const linterType = fileType || projectType;
  
  log(`File type: ${fileType || 'none'}, Project type: ${projectType || 'none'}`);
  log(`Selected linter type: ${linterType || 'none'}`);
  
  if (!linterType) {
    log('No linter configured for this file/project type');
    return { success: true, file: filePath, reason: 'No linter configured for this file type' };
  }
  
  switch (linterType) {
    case 'python':
      return await runPythonLinter(filePath, projectPath);
    case 'javascript':
      return await runJavaScriptLinter(filePath, projectPath);
    default:
      log(`Unsupported linter type: ${linterType}`);
      return { success: true, file: filePath, reason: 'Unsupported file type' };
  }
}

function formatLinterPrompt(results) {
  const resultsWithViolations = results.filter(r => r.violations && r.violations.length > 0);
  
  if (resultsWithViolations.length === 0) {
    return '';
  }
  
  const totalViolations = resultsWithViolations.reduce((sum, r) => sum + r.violations.length, 0);
  const errors = resultsWithViolations.flatMap(r => 
    r.violations.filter(v => v.severity === 'error')
  );
  const warnings = resultsWithViolations.flatMap(r => 
    r.violations.filter(v => v.severity === 'warning')
  );
  
  let prompt = `# 🚨 LINTING ERRORS DETECTED - FIX REQUIRED\n\n`;
  prompt += `Found ${totalViolations} linting issue${totalViolations !== 1 ? 's' : ''} `;
  prompt += `(${errors.length} error${errors.length !== 1 ? 's' : ''}, `;
  prompt += `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}):\n\n`;
  
  // Group by file
  for (const result of resultsWithViolations) {
    prompt += `## ${path.basename(result.file)} (${result.linter})\n\n`;
    
    // Sort violations by line number
    const sortedViolations = result.violations.sort((a, b) => a.line - b.line);
    
    for (const violation of sortedViolations) {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      const fixable = violation.fixable ? ' (auto-fixable)' : '';
      prompt += `${icon} Line ${violation.line}:${violation.column} - `;
      prompt += `${violation.message}`;
      if (violation.code) {
        prompt += ` [${violation.code}]`;
      }
      prompt += fixable;
      prompt += '\n';
    }
    prompt += '\n';
  }
  
  prompt += `## REQUIRED ACTIONS:\n\n`;
  prompt += `1. **STOP all other work** - Code quality must be maintained\n`;
  prompt += `2. **Fix all errors first** (${errors.length} error${errors.length !== 1 ? 's' : ''})\n`;
  prompt += `3. **Then fix warnings** (${warnings.length} warning${warnings.length !== 1 ? 's' : ''})\n`;
  prompt += `4. **Use the Edit tool** to correct each issue\n`;
  prompt += `5. **Preserve functionality** while fixing style issues\n\n`;
  
  const hasFixable = resultsWithViolations.some(r => 
    r.violations.some(v => v.fixable)
  );
  
  if (hasFixable) {
    prompt += `💡 **Tip**: Some issues are auto-fixable. `;
    prompt += `For Python, you could run \`ruff check --fix\`. `;
    prompt += `For JavaScript, you could run \`eslint --fix\`.\n\n`;
  }
  
  prompt += `Remember: Clean code is maintainable code. Fix these issues before proceeding.\n`;
  
  return prompt;
}

// Main execution
async function main() {
  let inputData = '';
  
  // Read stdin
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => inputData += chunk);
  
  process.stdin.on('end', async () => {
    let projectPath = process.cwd();
    
    try {
      // Parse input
      const hookData = JSON.parse(inputData);
      projectPath = hookData.cwd || process.cwd();
      
      // Initialize logging with project path
      initializeLogging(projectPath);
      
      log('=== HOOK EXECUTION START ===');
      log(`Tool: ${hookData.tool_name}`);
      log(`Session ID: ${hookData.session_id || 'unknown'}`);
      log('Hook input:', hookData);
      
      // Skip if not a file modification tool
      if (!CONFIG.enabledTools.includes(hookData.tool_name)) {
        log(`Tool ${hookData.tool_name} is not in enabled tools list, skipping`);
        writeLogFile();
        process.exit(0);
      }
      
      // Skip if tool execution failed
      if (hookData.tool_output && !hookData.tool_output.success) {
        log('Tool execution failed, skipping linting');
        writeLogFile();
        process.exit(0);
      }
      
      // Extract file paths
      const filePaths = extractFilePaths(hookData);
      
      if (filePaths.length === 0) {
        log('No file paths extracted, nothing to lint');
        writeLogFile();
        process.exit(0);
      }
      
      log(`\nStarting linting for ${filePaths.length} file(s)...`);
      
      // Run linters on all modified files
      const results = await Promise.all(
        filePaths.map(fp => lintFile(fp, projectPath))
      );
      
      log('\n=== LINTING RESULTS ===');
      results.forEach((result, index) => {
        log(`File ${index + 1}: ${result.file}`);
        log(`  Success: ${result.success}`);
        log(`  Linter: ${result.linter || 'none'}`);
        log(`  Violations: ${result.violations?.length || 0}`);
        if (result.skipped) log(`  SKIPPED: Linter not installed`);
        if (result.reason) log(`  Reason: ${result.reason}`);
      });
      
      // Check if any linting issues were found
      const hasIssues = results.some(r => !r.success && !r.skipped);
      log(`\nHas linting issues: ${hasIssues}`);
      
      if (hasIssues) {
        // Format and output prompt for Claude
        const prompt = formatLinterPrompt(results);
        if (prompt) {
          log('\nGenerating prompt for Claude...');
          log(`Prompt length: ${prompt.length} characters`);
          process.stderr.write(prompt);
          log('\nExiting with code 2 - prompting Claude to fix issues');
          writeLogFile();
          process.exit(2); // Force continuation with prompt
        }
      }
      
      // Log summary if linters were skipped  
      const skippedResults = results.filter(r => r.skipped);
      if (skippedResults.length > 0) {
        log(`\nNote: ${skippedResults.length} linter(s) were skipped (not installed)`);
      }
      
      log('\nNo linting issues found or all skipped');
      log('Exiting with code 0 - success');
      writeLogFile();
      process.exit(0);
    } catch (error) {
      // Don't output hook errors to stderr - just log them
      log(`\nERROR: ${error.message}`);
      log(error.stack);
      writeLogFile();
      // Don't block Claude on hook errors
      process.exit(0);
    }
  });
  
  // Handle timeout
  setTimeout(() => {
    log('\nERROR: Hook timeout exceeded');
    writeLogFile();
    process.exit(0);
  }, CONFIG.timeout + 5000);
}

// Run the hook
main();