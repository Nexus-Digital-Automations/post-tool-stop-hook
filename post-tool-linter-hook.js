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
    } catch {
      // Silently fail log file writes to avoid cluttering stderr
    }
  }
}

// Configuration
const CONFIG = {
  timeout: 10000, // 10 seconds max for linting
  enabledTools: ['Edit', 'Write', 'MultiEdit'],
  lintingMode: 'hybrid', // 'files-only', 'project-wide', 'hybrid'
  maxFilesForFileMode: 3, // Switch to project-wide if more than this many files
  respectIgnoreFiles: true,
  linters: {
    python: {
      command: 'ruff check --format json',
      projectCommand: 'ruff check . --format json',
      fileExtensions: ['.py', '.pyi'],
      configFiles: ['pyproject.toml', 'setup.py', 'requirements.txt', '.python-version', 'Pipfile'],
      ignoreFiles: ['.ruffignore', '.gitignore']
    },
    javascript: {
      command: 'eslint --format json',
      projectCommand: 'eslint . --format json',
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
      configFiles: ['package.json', 'tsconfig.json', '.eslintrc.json', '.eslintrc.js'],
      ignoreFiles: ['.eslintignore', '.gitignore']
    }
  },
  skipExtensions: ['.json', '.md', '.txt', '.yml', '.yaml', '.xml', '.csv', '.log']
};

// Utility functions
function validateConfigFile(configPath, type) {
  log(`Validating ${type} config file: ${configPath}`);
  
  try {
    if (!fs.existsSync(configPath)) {
      return false;
    }
    
    // Basic validation for different config file types
    if (configPath.endsWith('package.json')) {
      const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      // Valid if it has scripts, dependencies, or is explicitly a Node.js project
      const isValid = content.scripts || content.dependencies || content.devDependencies || content.type;
      log(`  package.json validation: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    }
    
    if (configPath.endsWith('pyproject.toml')) {
      const content = fs.readFileSync(configPath, 'utf8');
      // Valid if it contains Python-specific sections
      const isValid = content.includes('[tool.') || content.includes('[build-system]') || content.includes('[project]');
      log(`  pyproject.toml validation: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    }
    
    if (configPath.endsWith('setup.py')) {
      const content = fs.readFileSync(configPath, 'utf8');
      // Valid if it contains setup() call
      const isValid = content.includes('setup(') || content.includes('from setuptools');
      log(`  setup.py validation: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    }
    
    // For other files, existence is sufficient
    log(`  ${path.basename(configPath)} validation: VALID (existence check)`);
    return true;
    
  } catch (error) {
    log(`  Validation error for ${configPath}: ${error.message}`);
    return false;
  }
}

function detectProjectType(projectPath) {
  log(`Detecting project type for: ${projectPath}`);
  
  const foundTypes = [];
  
  // Check each linter type and validate config files
  for (const [type, config] of Object.entries(CONFIG.linters)) {
    log(`Checking for ${type} project indicators...`);
    let typeScore = 0;
    
    for (const configFile of config.configFiles) {
      const configPath = path.join(projectPath, configFile);
      const exists = fs.existsSync(configPath);
      log(`  ${configFile}: ${exists ? 'FOUND' : 'not found'}`);
      
      if (exists && validateConfigFile(configPath, type)) {
        typeScore++;
        log(`    -> Valid ${type} indicator (score: ${typeScore})`);
      }
    }
    
    if (typeScore > 0) {
      foundTypes.push({ type, score: typeScore });
    }
  }
  
  // Return the type with highest score, or null if no valid types found
  if (foundTypes.length > 0) {
    foundTypes.sort((a, b) => b.score - a.score);
    const selectedType = foundTypes[0].type;
    log(`Project type detected: ${selectedType} (score: ${foundTypes[0].score})`);
    
    if (foundTypes.length > 1) {
      log(`Other detected types: ${foundTypes.slice(1).map(t => `${t.type}(${t.score})`).join(', ')}`);
    }
    
    return selectedType;
  }
  
  log('No valid project type detected');
  return null;
}

function detectProjectTypes(projectPath) {
  log(`Detecting all project types for: ${projectPath}`);
  
  const foundTypes = [];
  
  for (const [type, config] of Object.entries(CONFIG.linters)) {
    let typeScore = 0;
    
    for (const configFile of config.configFiles) {
      const configPath = path.join(projectPath, configFile);
      if (fs.existsSync(configPath) && validateConfigFile(configPath, type)) {
        typeScore++;
      }
    }
    
    if (typeScore > 0) {
      foundTypes.push(type);
    }
  }
  
  log(`All detected project types: ${foundTypes.length > 0 ? foundTypes.join(', ') : 'none'}`);
  return foundTypes;
}

async function runPythonProjectLinter(projectPath) {
  log(`Running Python project linter (ruff) on: ${projectPath}`);
  
  try {
    const command = 'ruff check . --format json';
    log(`Executing project command: ${command}`);
    
    const result = execSync(command, {
      cwd: projectPath,
      encoding: 'utf8',
      timeout: CONFIG.timeout * 3, // Allow more time for project-wide linting
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    log(`Ruff project linting executed successfully, parsing output...`);
    const violations = JSON.parse(result || '[]');
    log(`Found ${violations.length} total project violations`);
    
    // Group violations by file
    const violationsByFile = violations.reduce((acc, v) => {
      const filename = v.filename || 'unknown';
      if (!acc[filename]) acc[filename] = [];
      acc[filename].push({
        line: v.location?.row || v.location?.start?.row || 0,
        column: v.location?.column || v.location?.start?.column || 0,
        code: v.code,
        message: v.message,
        severity: 'error',
        fixable: v.fix !== null && v.fix !== undefined
      });
      return acc;
    }, {});
    
    const results = Object.entries(violationsByFile).map(([filename, fileViolations]) => ({
      success: fileViolations.length === 0,
      linter: 'ruff',
      file: path.resolve(projectPath, filename),
      violations: fileViolations
    }));
    
    // If no violations, return a single success result
    if (results.length === 0) {
      return [{
        success: true,
        linter: 'ruff',
        file: projectPath,
        violations: [],
        projectWide: true
      }];
    }
    
    return results;
  } catch (error) {
    log(`Ruff project execution failed with status: ${error.status}`);
    
    // Ruff returns non-zero exit code when violations found
    if (error.status === 1 && error.stdout) {
      try {
        log(`Parsing project error stdout for violations...`);
        const violations = JSON.parse(error.stdout);
        log(`Found ${violations.length} violations from project error output`);
        
        // Group violations by file
        const violationsByFile = violations.reduce((acc, v) => {
          const filename = v.filename || 'unknown';
          if (!acc[filename]) acc[filename] = [];
          acc[filename].push({
            line: v.location?.row || v.location?.start?.row || 0,
            column: v.location?.column || v.location?.start?.column || 0,
            code: v.code,
            message: v.message,
            severity: 'error',
            fixable: v.fix !== null && v.fix !== undefined
          });
          return acc;
        }, {});
        
        return Object.entries(violationsByFile).map(([filename, fileViolations]) => ({
          success: false,
          linter: 'ruff',
          file: path.resolve(projectPath, filename),
          violations: fileViolations
        }));
      } catch (parseError) {
        log(`Failed to parse ruff project output: ${parseError.message}`);
        return [{ success: true, linter: 'ruff', file: projectPath, violations: [], projectWide: true }];
      }
    }
    
    // Check if ruff is installed
    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
      log('ERROR: Ruff is not installed');
      return [{ success: true, linter: 'ruff', file: projectPath, violations: [], skipped: true, reason: 'Ruff not installed', projectWide: true }];
    }
    
    log(`Unexpected error running ruff project: ${error.message}`);
    return [{ success: true, linter: 'ruff', file: projectPath, violations: [], projectWide: true }];
  }
}

async function runJavaScriptProjectLinter(projectPath) {
  log(`Running JavaScript project linter (eslint) on: ${projectPath}`);
  
  try {
    // Try to find eslint in multiple locations
    let eslintCommand = 'eslint';
    const localEslint = path.join(projectPath, 'node_modules', '.bin', 'eslint');
    const localEslintCmd = path.join(projectPath, 'node_modules', '.bin', 'eslint.cmd');
    
    if (fs.existsSync(localEslint)) {
      eslintCommand = localEslint;
    } else if (fs.existsSync(localEslintCmd)) {
      eslintCommand = localEslintCmd;
    }
    
    // Properly quote command for cross-platform compatibility
    const quotedCommand = process.platform === 'win32' ? `"${eslintCommand}"` : eslintCommand;
    const fullCommand = `${quotedCommand} . --format json`;
    
    log(`Executing ESLint project command: ${fullCommand}`);
    
    const result = execSync(fullCommand, {
      cwd: projectPath,
      encoding: 'utf8',
      timeout: CONFIG.timeout * 3, // Allow more time for project-wide linting
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    log(`ESLint project linting executed successfully, parsing output...`);
    const reports = JSON.parse(result || '[]');
    log(`Found ${reports.length} files in project ESLint results`);
    
    const results = reports.map(report => ({
      success: report.errorCount === 0 && report.warningCount === 0,
      linter: 'eslint',
      file: report.filePath,
      violations: report.messages.map(m => ({
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? 'error' : 'warning',
        message: m.message,
        code: m.ruleId,
        fixable: m.fix !== undefined
      }))
    })).filter(result => result.violations.length > 0); // Only return files with violations
    
    // If no violations, return a single success result
    if (results.length === 0) {
      return [{
        success: true,
        linter: 'eslint',
        file: projectPath,
        violations: [],
        projectWide: true
      }];
    }
    
    return results;
  } catch (error) {
    log(`ESLint project execution failed: ${error.message}`);
    
    // ESLint returns non-zero when violations found
    if (error.stdout) {
      try {
        log('Parsing ESLint project stdout for violations...');
        const reports = JSON.parse(error.stdout);
        log(`Found ${reports.length} files in project ESLint error results`);
        
        const results = reports.map(report => ({
          success: report.errorCount === 0,
          linter: 'eslint',
          file: report.filePath,
          violations: report.messages.map(m => ({
            line: m.line,
            column: m.column,
            severity: m.severity === 2 ? 'error' : 'warning',
            message: m.message,
            code: m.ruleId,
            fixable: m.fix !== undefined
          }))
        })).filter(result => result.violations.length > 0); // Only return files with violations
        
        return results.length > 0 ? results : [{
          success: true,
          linter: 'eslint',
          file: projectPath,
          violations: [],
          projectWide: true
        }];
      } catch (parseError) {
        log(`Failed to parse ESLint project output: ${parseError.message}`);
        return [{ success: true, linter: 'eslint', file: projectPath, violations: [], projectWide: true }];
      }
    }
    
    // Check if eslint is installed
    if (error.message.includes('command not found') || 
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      log('ESLint not found - marking project as skipped');
      return [{ success: true, linter: 'eslint', file: projectPath, violations: [], skipped: true, reason: 'ESLint not installed', projectWide: true }];
    }
    
    log(`Unexpected ESLint project error: ${error.message}`);
    return [{ success: true, linter: 'eslint', file: projectPath, violations: [], projectWide: true }];
  }
}

async function lintProject(projectPath, linterTypes) {
  log(`\n--- Linting entire project: ${projectPath} ---`);
  log(`Linter types: ${linterTypes.join(', ')}`);
  
  const allResults = [];
  
  for (const linterType of linterTypes) {
    switch (linterType) {
      case 'python':
        const pythonResults = await runPythonProjectLinter(projectPath);
        allResults.push(...pythonResults);
        break;
      case 'javascript':
        const jsResults = await runJavaScriptProjectLinter(projectPath);
        allResults.push(...jsResults);
        break;
      default:
        log(`Unsupported project linter type: ${linterType}`);
        break;
    }
  }
  
  log(`Project linting completed with ${allResults.length} result(s)`);
  return allResults;
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
    const command = `ruff check "${filePath}" --format json`;
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
    // Try to find eslint in multiple locations
    let eslintCommand = 'eslint';
    const localEslint = path.join(projectPath, 'node_modules', '.bin', 'eslint');
    const localEslintCmd = path.join(projectPath, 'node_modules', '.bin', 'eslint.cmd');
    
    if (fs.existsSync(localEslint)) {
      eslintCommand = localEslint;
    } else if (fs.existsSync(localEslintCmd)) {
      eslintCommand = localEslintCmd;
    }
    
    // Properly quote command and file path for cross-platform compatibility
    const quotedCommand = process.platform === 'win32' ? `"${eslintCommand}"` : eslintCommand;
    const quotedFile = `"${filePath}"`;
    const fullCommand = `${quotedCommand} ${quotedFile} --format json`;
    
    log(`Executing ESLint command: ${fullCommand}`);
    
    const result = execSync(fullCommand, {
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
    log(`ESLint execution failed: ${error.message}`);
    
    // ESLint returns non-zero when violations found
    if (error.stdout) {
      try {
        log('Parsing ESLint stdout for violations...');
        const reports = JSON.parse(error.stdout);
        const fileReport = reports[0] || { messages: [] };
        
        log(`Found ${fileReport.messages.length} ESLint violations`);
        
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
        log(`Failed to parse ESLint output: ${parseError.message}`);
        return { success: true, linter: 'eslint', file: filePath, violations: [] };
      }
    }
    
    // Check if eslint is installed
    if (error.message.includes('command not found') || 
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      log('ESLint not found - marking as skipped');
      return { success: true, linter: 'eslint', file: filePath, violations: [], skipped: true, reason: 'ESLint not installed' };
    }
    
    log(`Unexpected ESLint error: ${error.message}`);
    return { success: true, linter: 'eslint', file: filePath, violations: [] };
  }
}

async function lintFile(filePath, projectPath) {
  log(`\n--- Linting file: ${filePath} ---`);
  
  const fileType = getFileType(filePath);
  const projectType = detectProjectType(projectPath);
  const allProjectTypes = detectProjectTypes(projectPath);
  
  // Prefer file type over project type, but consider all available types
  let linterType = fileType || projectType;
  
  log(`File type: ${fileType || 'none'}, Project type: ${projectType || 'none'}`);
  log(`All project types: ${allProjectTypes.length > 0 ? allProjectTypes.join(', ') : 'none'}`);
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
  
  const isProjectWide = resultsWithViolations.some(r => r.projectWide);
  const scopeText = isProjectWide ? 'CODEBASE-WIDE' : 'FILE-SPECIFIC';
  
  let prompt = `# 🚨 ${scopeText} LINTING ERRORS DETECTED - FIX REQUIRED\n\n`;
  prompt += `Found ${totalViolations} linting issue${totalViolations !== 1 ? 's' : ''} `;
  prompt += `(${errors.length} error${errors.length !== 1 ? 's' : ''}, `;
  prompt += `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}) `;
  prompt += `across ${resultsWithViolations.length} file${resultsWithViolations.length !== 1 ? 's' : ''}:\n\n`;
  
  // Group by file
  for (const result of resultsWithViolations) {
    const fileName = result.projectWide ? 
      `${path.basename(result.file)} (${result.linter} - project scan)` :
      `${path.basename(result.file)} (${result.linter})`;
    
    prompt += `## ${fileName}\n\n`;
    
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
  prompt += `2. **Fix all errors first** (${errors.length} error${errors.length !== 1 ? 's' : ''})
`;
  prompt += `3. **Then fix warnings** (${warnings.length} warning${warnings.length !== 1 ? 's' : ''})
`;
  prompt += `4. **Use the Edit tool** to correct each issue\n`;
  prompt += `5. **Preserve functionality** while fixing style issues\n\n`;
  
  const hasFixable = resultsWithViolations.some(r => 
    r.violations.some(v => v.fixable)
  );
  
  if (hasFixable) {
    prompt += `💡 **Tip**: Some issues are auto-fixable. `;
    if (isProjectWide) {
      prompt += `Run \`ruff check --fix .\` or \`eslint --fix .\` to auto-fix project-wide issues.\n\n`;
    } else {
      prompt += `Run \`ruff check --fix\` or \`eslint --fix\` on individual files.\n\n`;
    }
  }
  
  if (isProjectWide) {
    prompt += `**Note**: This was a codebase-wide scan. Issues may exist in files beyond those recently modified.\n\n`;
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
      
      // Determine linting approach based on configuration and file count
      let results = [];
      const allProjectTypes = detectProjectTypes(projectPath);
      
      const shouldUseProjectWide = (
        CONFIG.lintingMode === 'project-wide' ||
        (CONFIG.lintingMode === 'hybrid' && filePaths.length > CONFIG.maxFilesForFileMode) ||
        (CONFIG.lintingMode === 'hybrid' && allProjectTypes.length > 0)
      );
      
      if (shouldUseProjectWide && allProjectTypes.length > 0) {
        log(`Using project-wide linting mode (${filePaths.length} files, types: ${allProjectTypes.join(', ')})`);
        results = await lintProject(projectPath, allProjectTypes);
      } else {
        log(`Using file-by-file linting mode`);
        // Run linters on all modified files
        results = await Promise.all(
          filePaths.map(fp => lintFile(fp, projectPath))
        );
      }
      
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