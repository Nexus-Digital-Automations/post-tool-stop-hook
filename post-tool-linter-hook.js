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
      command: 'ruff check --output-format json',
      projectCommand: 'ruff check . --output-format json',
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
    const command = 'ruff check . --output-format json';
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
      return [{ 
        success: false, 
        linter: 'ruff', 
        file: projectPath, 
        violations: [], 
        projectWide: true,
        executionFailure: true,
        failureType: 'missing_dependency',
        message: 'Ruff linter is not installed',
        suggestion: 'Install ruff: pip install ruff'
      }];
    }
    
    // Handle timeout errors
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      log('ERROR: Ruff project execution timed out');
      return [{
        success: false,
        linter: 'ruff',
        file: projectPath,
        violations: [],
        projectWide: true,
        executionFailure: true,
        failureType: 'timeout',
        message: `Ruff project execution timed out (>${CONFIG.timeout * 3}ms)`,
        suggestion: 'Reduce project size or increase timeout in hook configuration'
      }];
    }
    
    // Log stderr for debugging
    if (error.stderr) {
      log(`Ruff project stderr: ${error.stderr}`);
    }
    
    log(`Unexpected error running ruff project: ${error.message}`);
    return [{ 
      success: false, 
      linter: 'ruff', 
      file: projectPath, 
      violations: [], 
      projectWide: true,
      executionFailure: true,
      failureType: 'execution_error',
      message: `Ruff project execution failed: ${error.message}`,
      suggestion: 'Check the log file for detailed error information'
    }];
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
    
    // Properly quote command for cross-platform compatibility - always quote paths with spaces
    const quotedCommand = `"${eslintCommand}"`;
    // Add ignore patterns for skipExtensions
    const ignorePatterns = CONFIG.skipExtensions.map(ext => `--ignore-pattern "**/*${ext}"`).join(' ');
    const fullCommand = `${quotedCommand} . --format json ${ignorePatterns}`;
    
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
      log('ESLint not found - marking project as failed');
      return [{ 
        success: false, 
        linter: 'eslint', 
        file: projectPath, 
        violations: [], 
        projectWide: true,
        executionFailure: true,
        failureType: 'missing_dependency',
        message: 'ESLint is not installed or not found',
        suggestion: 'Install ESLint: npm install eslint'
      }];
    }
    
    // Handle timeout errors
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      log('ERROR: ESLint project execution timed out');
      return [{
        success: false,
        linter: 'eslint',
        file: projectPath,
        violations: [],
        projectWide: true,
        executionFailure: true,
        failureType: 'timeout',
        message: `ESLint project execution timed out (>${CONFIG.timeout * 3}ms)`,
        suggestion: 'Reduce project size or increase timeout in hook configuration'
      }];
    }
    
    // Log stderr for debugging
    if (error.stderr) {
      log(`ESLint project stderr: ${error.stderr}`);
    }
    
    log(`Unexpected ESLint project error: ${error.message}`);
    return [{ 
      success: false, 
      linter: 'eslint', 
      file: projectPath, 
      violations: [], 
      projectWide: true,
      executionFailure: true,
      failureType: 'execution_error',
      message: `ESLint project execution failed: ${error.message}`,
      suggestion: 'Check the log file for detailed error information'
    }];
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
      return { 
        success: false, 
        linter: 'ruff', 
        file: filePath, 
        violations: [], 
        executionFailure: true,
        failureType: 'missing_dependency',
        message: 'Ruff linter is not installed',
        suggestion: 'Install ruff: pip install ruff'
      };
    }
    
    // Handle timeout errors
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      log('ERROR: Ruff execution timed out');
      return {
        success: false,
        linter: 'ruff',
        file: filePath,
        violations: [],
        executionFailure: true,
        failureType: 'timeout',
        message: `Ruff execution timed out (>${CONFIG.timeout}ms)`,
        suggestion: 'Check file complexity or increase timeout in hook configuration'
      };
    }
    
    // Log stderr for debugging
    if (error.stderr) {
      log(`Ruff stderr: ${error.stderr}`);
    }
    
    log(`Unexpected error running ruff: ${error.message}`);
    return { 
      success: false, 
      linter: 'ruff', 
      file: filePath, 
      violations: [],
      executionFailure: true,
      failureType: 'execution_error',
      message: `Ruff execution failed: ${error.message}`,
      suggestion: 'Check the log file for detailed error information'
    };
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
    
    // Properly quote command and file path for cross-platform compatibility - always quote paths with spaces
    const quotedCommand = `"${eslintCommand}"`;
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
      log('ESLint not found - marking as failed');
      return { 
        success: false, 
        linter: 'eslint', 
        file: filePath, 
        violations: [],
        executionFailure: true,
        failureType: 'missing_dependency',
        message: 'ESLint is not installed or not found',
        suggestion: 'Install ESLint: npm install eslint'
      };
    }
    
    // Handle timeout errors
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      log('ERROR: ESLint execution timed out');
      return {
        success: false,
        linter: 'eslint',
        file: filePath,
        violations: [],
        executionFailure: true,
        failureType: 'timeout',
        message: `ESLint execution timed out (>${CONFIG.timeout}ms)`,
        suggestion: 'Check file complexity or increase timeout in hook configuration'
      };
    }
    
    // Log stderr for debugging
    if (error.stderr) {
      log(`ESLint stderr: ${error.stderr}`);
    }
    
    log(`Unexpected ESLint error: ${error.message}`);
    return { 
      success: false, 
      linter: 'eslint', 
      file: filePath, 
      violations: [],
      executionFailure: true,
      failureType: 'execution_error',
      message: `ESLint execution failed: ${error.message}`,
      suggestion: 'Check the log file for detailed error information'
    };
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

function writeLinterErrorsFile(resultsWithViolations, projectPath) {
  const developmentDir = path.join(projectPath, 'development');
  const errorsFilePath = path.join(developmentDir, 'linter-errors.md');
  
  // Ensure development directory exists
  try {
    if (!fs.existsSync(developmentDir)) {
      fs.mkdirSync(developmentDir, { recursive: true });
      log(`Created development directory: ${developmentDir}`);
    }
  } catch (error) {
    log(`Failed to create development directory: ${error.message}`);
    // Fallback to project root if development dir creation fails
    const fallbackPath = path.join(projectPath, 'linter-errors.md');
    log(`Using fallback path: ${fallbackPath}`);
    return writeLinterErrorsToPath(resultsWithViolations, fallbackPath);
  }
  
  // Sort files by severity (same as in prompt)
  const sortedResults = resultsWithViolations.sort((a, b) => {
    const aErrors = a.violations.filter(v => v.severity === 'error').length;
    const bErrors = b.violations.filter(v => v.severity === 'error').length;
    if (aErrors !== bErrors) {
      return bErrors - aErrors;
    }
    return b.violations.length - a.violations.length;
  });
  
  const totalViolations = resultsWithViolations.reduce((sum, r) => sum + r.violations.length, 0);
  const errors = resultsWithViolations.flatMap(r => r.violations.filter(v => v.severity === 'error'));
  const warnings = resultsWithViolations.flatMap(r => r.violations.filter(v => v.severity === 'warning'));
  
  let content = `# Linter Errors Report\n\n`;
  content += `**Generated:** ${new Date().toISOString()}\n`;
  content += `**Total Issues:** ${totalViolations} (${errors.length} errors, ${warnings.length} warnings)\n`;
  content += `**Files:** ${resultsWithViolations.length}\n\n`;
  
  for (const result of sortedResults) {
    const fileName = result.projectWide ? 
      `${path.basename(result.file)} (${result.linter} - project scan)` :
      `${path.basename(result.file)} (${result.linter})`;
    
    content += `## ${fileName}\n\n`;
    content += `**File Path:** \`${result.file}\`\n`;
    content += `**Issues:** ${result.violations.length}\n\n`;
    
    // Sort violations by severity, then line number
    const sortedViolations = result.violations.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1;
      }
      return a.line - b.line;
    });
    
    for (const violation of sortedViolations) {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      const fixable = violation.fixable ? ' (auto-fixable)' : '';
      content += `${icon} **Line ${violation.line}:${violation.column}** - ${violation.message}`;
      if (violation.code) {
        content += ` \`[${violation.code}]\``;
      }
      content += `${fixable}\n\n`;
    }
    
    content += `---\n\n`;
  }
  
  return writeLinterErrorsToPath(resultsWithViolations, errorsFilePath, content);
}

function writeLinterErrorsToPath(resultsWithViolations, filePath, content = null) {
  if (!content) {
    // Generate content if not provided (for fallback case)
    const sortedResults = resultsWithViolations.sort((a, b) => {
      const aErrors = a.violations.filter(v => v.severity === 'error').length;
      const bErrors = b.violations.filter(v => v.severity === 'error').length;
      if (aErrors !== bErrors) {
        return bErrors - aErrors;
      }
      return b.violations.length - a.violations.length;
    });
    
    const totalViolations = resultsWithViolations.reduce((sum, r) => sum + r.violations.length, 0);
    const errors = resultsWithViolations.flatMap(r => r.violations.filter(v => v.severity === 'error'));
    const warnings = resultsWithViolations.flatMap(r => r.violations.filter(v => v.severity === 'warning'));
    
    content = `# Linter Errors Report\n\n`;
    content += `**Generated:** ${new Date().toISOString()}\n`;
    content += `**Total Issues:** ${totalViolations} (${errors.length} errors, ${warnings.length} warnings)\n`;
    content += `**Files:** ${resultsWithViolations.length}\n\n`;
    
    for (const result of sortedResults) {
      const fileName = result.projectWide ? 
        `${path.basename(result.file)} (${result.linter} - project scan)` :
        `${path.basename(result.file)} (${result.linter})`;
      
      content += `## ${fileName}\n\n`;
      content += `**File Path:** \`${result.file}\`\n`;
      content += `**Issues:** ${result.violations.length}\n\n`;
      
      // Sort violations by severity, then line number
      const sortedViolations = result.violations.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'error' ? -1 : 1;
        }
        return a.line - b.line;
      });
      
      for (const violation of sortedViolations) {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        const fixable = violation.fixable ? ' (auto-fixable)' : '';
        content += `${icon} **Line ${violation.line}:${violation.column}** - ${violation.message}`;
        if (violation.code) {
          content += ` \`[${violation.code}]\``;
        }
        content += `${fixable}\n\n`;
      }
      
      content += `---\n\n`;
    }
  }
  
  // Write file (overwrite any existing version)
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Wrote complete linting report to: ${filePath}`);
    return filePath;
  } catch (error) {
    log(`Failed to write linter errors file: ${error.message}`);
    return null;
  }
}


function formatLinterFailurePrompt(failures, projectPath) {
  if (failures.length === 0) {
    return '';
  }
  
  const logFile = path.join(projectPath, 'post-tool-linter-hook.log');
  const relativeLogPath = path.relative(projectPath, logFile);
  
  let prompt = `# 🚨 LINTER EXECUTION FAILED - CHECK CONFIGURATION\n\n`;
  prompt += `Linter execution failed for ${failures.length} linter${failures.length !== 1 ? 's' : ''}. `;
  prompt += `This indicates setup or configuration issues that need to be resolved.\n\n`;
  
  // Group failures by type
  const failuresByType = failures.reduce((acc, failure) => {
    const type = failure.failureType || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(failure);
    return acc;
  }, {});
  
  for (const [failureType, typeFailures] of Object.entries(failuresByType)) {
    prompt += `## ${failureType.charAt(0).toUpperCase() + failureType.slice(1)} Issues\n\n`;
    
    for (const failure of typeFailures) {
      prompt += `**${failure.linter}**: ${failure.message}\n`;
      if (failure.suggestion) {
        prompt += `💡 *${failure.suggestion}*\n`;
      }
      prompt += `\n`;
    }
  }
  
  prompt += `📄 **Detailed logs**: \`${relativeLogPath}\`\n\n`;
  prompt += `**REQUIRED**: Fix the linter setup issues above before proceeding. Check the log file for detailed error information.\n`;
  
  return prompt;
}

function formatLinterPrompt(results, projectPath, editedFiles = [], _taskCreated = false) {
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
  
  // Filter results for edited files - normalize paths for comparison
  const editedFilesWithViolations = resultsWithViolations.filter(r => 
    editedFiles.some(editedFile => {
      const normalizedResultPath = path.resolve(r.file);
      const normalizedEditedPath = path.resolve(editedFile);
      return normalizedResultPath === normalizedEditedPath;
    })
  );
  
  // Write all errors to a file for the Claude agent to access
  const errorsFilePath = writeLinterErrorsFile(resultsWithViolations, projectPath);
  const relativeErrorsPath = path.relative(projectPath, errorsFilePath);
  
  // Generate ultra-prominent impossible-to-ignore prompt
  let prompt = `
██████ ████████  ██████  ██████     ██
██        ██    ██    ██ ██   ██    ██
███████   ██    ██    ██ ██████     ██
     ██   ██    ██    ██ ██         ██
███████   ██     ██████  ██         ██

🛑🛑🛑 STOP ALL WORK IMMEDIATELY 🛑🛑🛑
🚨🚨🚨 LINTER ERRORS MUST BE FIXED FIRST 🚨🚨🚨
🚫🚫🚫 DO NOT CONTINUE WITH OTHER TASKS 🚫🚫🚫

**STOP:** Drop everything you're doing right now
**PRIORITY OVERRIDE:** Linter errors are now your highest priority  
**MANDATORY:** You CANNOT continue with other work until these are fixed

## 🚨 CRITICAL CODE QUALITY FAILURE 🚨

**PROJECT-WIDE TOTALS:** ${totalViolations} linting issue${totalViolations !== 1 ? 's' : ''} `;
  prompt += `(${errors.length} error${errors.length !== 1 ? 's' : ''}, `;
  prompt += `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}) `;
  prompt += `across ${resultsWithViolations.length} file${resultsWithViolations.length !== 1 ? 's' : ''} in entire codebase.

**EDITED FILES:** ${editedFilesWithViolations.length} of your recently edited files have linting issues.

**THIS IS NOT OPTIONAL - CODE QUALITY FAILURES BLOCK DEPLOYMENT**
**LINTER ERRORS INDICATE SERIOUS ISSUES THAT MUST BE RESOLVED**
**YOU MUST FIX LINTER ERRORS FIRST - THIS IS A HARD REQUIREMENT**

`;
  
  // Show specific errors for edited files
  if (editedFilesWithViolations.length > 0) {
    prompt += `## 🎯 FOCUS: Errors in Files You Just Edited\n\n`;
    prompt += `*(Note: Full project errors available in ${relativeErrorsPath})*\n\n`;
    
    for (const result of editedFilesWithViolations) {
      const fileName = path.basename(result.file);
      const linterName = result.linter || 'unknown';
      prompt += `### ${fileName} (${linterName})\n`;
      
      // Sort violations by severity (errors first), then by line number
      const sortedViolations = result.violations.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'error' ? -1 : 1;
        }
        return a.line - b.line;
      });
      
      for (const violation of sortedViolations) {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        const fixable = violation.fixable ? ' (auto-fixable)' : '';
        prompt += `${icon} Line ${violation.line}:${violation.column} - ${violation.message}`;
        if (violation.code) {
          prompt += ` [${violation.code}]`;
        }
        prompt += `${fixable}\n`;
      }
      prompt += '\n';
    }
  } else {
    prompt += `## 🎯 FOCUS: Your Edited Files Are Clean\n\n`;
    prompt += `✅ **Good news:** Your recently edited files have no linting errors!\n`;
    prompt += `⚠️ **However:** There are ${totalViolations} errors elsewhere in the project.\n\n`;
    prompt += `**Full project errors available in**: \`${relativeErrorsPath}\`\n\n`;
  }
  
  prompt += `
🛑🛑🛑 STOP EVERYTHING NOW 🛑🛑🛑

## 🚨 MANDATORY IMMEDIATE ACTIONS (DO NOT SKIP) 🚨

**COMMAND 1:** STOP whatever you are currently working on RIGHT NOW
**COMMAND 2:** READ the linter errors file IMMEDIATELY using the Read tool
**COMMAND 3:** FIX every single error and warning listed - NO EXCEPTIONS
**COMMAND 4:** DO NOT proceed with ANY other task until ALL issues are resolved

🔥 **CRITICAL PATH - NO DEVIATION ALLOWED:**

**STEP 1 - IMMEDIATE:** ${editedFilesWithViolations.length > 0 ? 'Fix all errors in your edited files shown above' : 'Read `' + relativeErrorsPath + '` to see project-wide errors'}
**STEP 2 - SECONDARY:** Read \`${relativeErrorsPath}\` for complete project error context
**STEP 3 - OPTIONAL:** Consider fixing project-wide errors if time permits
**STEP 4 - ESSENTIAL:** Run the linters again to verify edited file issues are resolved
**STEP 5 - FINAL:** Confirm your edited files have ZERO linter errors before proceeding

⚠️ **WARNING:** Do not attempt to continue with other tasks while linter errors exist
⚠️ **WARNING:** Do not ignore warnings - they must be fixed too
⚠️ **WARNING:** This is a blocking issue that prevents deployment

## 🔥 WHY LINTER ERRORS MUST BE FIXED IMMEDIATELY 🔥

**CODE QUALITY CRISIS:** Linter errors indicate serious code quality issues that compromise:
- **Deployment Safety:** Code with linter errors cannot be safely deployed
- **Team Standards:** Linter violations break established coding standards
- **System Reliability:** Poor code quality leads to runtime failures
- **Developer Productivity:** Technical debt accumulates with ignored warnings

**CONSEQUENCES OF IGNORING THIS:**
- 🚫 **Deployment Blocked:** Your code cannot be released with linter errors
- 🚫 **Code Review Failure:** Pull requests will be rejected with linter violations
- 🚫 **Technical Debt:** Ignored warnings compound into major issues
- 🚫 **Team Disruption:** Other developers blocked by your code quality issues

🛑🛑🛑 FINAL REMINDER: STOP ALL OTHER WORK AND FIX LINTER ERRORS NOW 🛑🛑🛑

`;
  
  return prompt;
}

// Smart Task Management Functions

function removeLinterTasks(todoData) {
  log('Removing existing linter tasks to prevent accumulation...');
  
  const tasks = todoData.tasks || [];
  const initialTaskCount = tasks.length;
  
  // Find all linter tasks (both pending and completed)
  const linterTaskIndices = [];
  tasks.forEach((task, index) => {
    if (task.is_linter_task === true) {
      linterTaskIndices.push(index);
      log(`Found linter task to remove: ${task.id} (${task.status}) at index ${index}`);
    }
  });
  
  // Remove linter tasks from highest index to lowest to maintain indices
  linterTaskIndices.sort((a, b) => b - a);
  linterTaskIndices.forEach(index => {
    const removedTask = tasks.splice(index, 1)[0];
    log(`Removed linter task: ${removedTask.id} (${removedTask.status})`);
  });
  
  const finalTaskCount = tasks.length;
  const removedCount = initialTaskCount - finalTaskCount;
  
  log(`Removed ${removedCount} linter tasks, ${finalTaskCount} tasks remain`);
  
  // Update current_task_index if needed
  if (todoData.current_task_index >= finalTaskCount && finalTaskCount > 0) {
    todoData.current_task_index = finalTaskCount - 1;
    log(`Adjusted current_task_index to ${todoData.current_task_index}`);
  }
  
  return {
    removedCount,
    finalTaskCount,
    updatedTodoData: todoData
  };
}

async function analyzeTodoState(projectPath) {
  log('Analyzing TODO.json state for smart task placement...');
  const todoPath = path.join(projectPath, 'TODO.json');
  
  try {
    const todoData = JSON.parse(fs.readFileSync(todoPath, 'utf8'));
    log(`Found ${todoData.tasks?.length || 0} existing tasks`);
    
    // Find current active task (pending or in_progress)
    const currentTaskIndex = todoData.current_task_index || 0;
    const tasks = todoData.tasks || [];
    const currentTask = tasks[currentTaskIndex];
    
    // Analyze task priorities and types
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status === 'pending');
    
    log(`Current task index: ${currentTaskIndex}, Current task: ${currentTask?.title || 'None'}`);
    log(`Pending tasks: ${pendingTasks.length}, High priority: ${highPriorityTasks.length}`);
    
    return {
      todoData,
      currentTask,
      currentTaskIndex,
      pendingTasks,
      highPriorityTasks,
      totalTasks: tasks.length
    };
  } catch (error) {
    log(`Failed to analyze TODO.json: ${error.message}`);
    return null;
  }
}

function determineInsertionPoint(analysis) {
  if (!analysis) {
    log('No TODO analysis available, will append task');
    return -1; // Append to end
  }
  
  const { currentTaskIndex } = analysis;
  
  // Strategy: Insert linter task as the immediate next task
  // This makes it the highest priority without disrupting current work
  const insertionIndex = currentTaskIndex + 1;
  
  log(`Determined insertion point: index ${insertionIndex} (after current task)`);
  return insertionIndex;
}

async function createSmartLinterTask(results, projectPath, filePaths, _analysis) {
  log('Creating standardized smart linter task...');
  
  const resultsWithViolations = results.filter(r => r.violations && r.violations.length > 0);
  const totalViolations = resultsWithViolations.reduce((sum, r) => sum + r.violations.length, 0);
  const errors = resultsWithViolations.flatMap(r => 
    r.violations.filter(v => v.severity === 'error')
  );
  const warnings = resultsWithViolations.flatMap(r => 
    r.violations.filter(v => v.severity === 'warning')
  );
  
  // Standardized task ID - predictable format
  const taskId = 'linter_task_active';
  const fileList = filePaths.map(fp => path.basename(fp)).join(', ');
  
  // Standardized linter task format
  const linterTask = {
    id: taskId,
    title: 'Fix Linter Errors - IMMEDIATE',
    description: `Fix ${errors.length} error${errors.length !== 1 ? 's' : ''} and ${warnings.length} warning${warnings.length !== 1 ? 's' : ''} found in recently edited files: ${fileList}`,
    mode: 'DEVELOPMENT',
    priority: 'high',
    status: 'pending',
    important_files: [
      'development/linter-errors.md', // Always include the linter errors file first
      ...filePaths.map(fp => path.relative(projectPath, fp)).filter(Boolean)
    ].filter((file, index, arr) => arr.indexOf(file) === index), // Remove duplicates
    success_criteria: [
      'All linter errors in edited files resolved',
      'development/linter-errors.md shows no issues for edited files',
      'Code passes linting without warnings or errors'
    ],
    created_at: new Date().toISOString(),
    is_linter_task: true, // Critical identifier for deduplication
    linter_summary: {
      total_violations: totalViolations,
      errors: errors.length,
      warnings: warnings.length,
      files_affected: filePaths.length
    }
  };
  
  log(`Created standardized linter task: ${taskId} with ${totalViolations} total issues (${errors.length} errors, ${warnings.length} warnings)`);
  return linterTask;
}

async function insertLinterTaskSmart(linterTask, analysis, projectPath) {
  if (!analysis) {
    log('No TODO analysis, skipping task insertion');
    return false;
  }
  
  const todoPath = path.join(projectPath, 'TODO.json');
  
  try {
    // Create a backup before modifying
    const backupPath = `${todoPath}.backup.${Date.now()}`;
    fs.copyFileSync(todoPath, backupPath);
    log(`Created backup: ${backupPath}`);
    
    const todoData = { ...analysis.todoData };
    
    // CRITICAL: Remove all existing linter tasks first to prevent accumulation
    const removalResult = removeLinterTasks(todoData);
    log(`Deduplication complete: removed ${removalResult.removedCount} existing linter tasks`);
    
    // Recalculate insertion point after removal
    const updatedAnalysis = {
      ...analysis,
      todoData: removalResult.updatedTodoData
    };
    const insertionIndex = determineInsertionPoint(updatedAnalysis);
    
    if (insertionIndex === -1) {
      // Append to end
      todoData.tasks.push(linterTask);
      log('Appended linter task to end of task list');
    } else {
      // Insert at specific position
      todoData.tasks.splice(insertionIndex, 0, linterTask);
      log(`Inserted linter task at index ${insertionIndex}`);
    }
    
    // Update metadata
    todoData.execution_count = (todoData.execution_count || 0) + 1;
    todoData.last_hook_activation = Date.now();
    
    // Write updated TODO.json
    fs.writeFileSync(todoPath, JSON.stringify(todoData, null, 2));
    log('Successfully updated TODO.json with deduplicated linter task placement');
    
    return true;
  } catch (error) {
    log(`Failed to insert linter task: ${error.message}`);
    return false;
  }
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
      
      // Check for execution failures vs violations
      const executionFailures = results.filter(r => r.executionFailure);
      const hasViolations = results.some(r => !r.success && !r.executionFailure && !r.skipped);
      
      log(`\nExecution failures: ${executionFailures.length}`);
      log(`Has linting violations: ${hasViolations}`);
      
      // Handle execution failures first (higher priority)
      if (executionFailures.length > 0) {
        const failurePrompt = formatLinterFailurePrompt(executionFailures, projectPath);
        if (failurePrompt) {
          log('\nGenerating execution failure prompt for Claude...');
          log(`Failure prompt length: ${failurePrompt.length} characters`);
          process.stderr.write(failurePrompt);
          log('\nExiting with code 2 - prompting Claude to fix execution failures');
          writeLogFile();
          process.exit(2); // Force continuation with prompt
        }
      }
      
      // Handle violations if no execution failures
      if (hasViolations) {
        // Analyze TODO.json state for smart task placement
        log('\nAttempting to create smart linter task...');
        const analysis = await analyzeTodoState(projectPath);
        let taskCreated = false;
        
        if (analysis) {
          // Create smart linter task with proper placement
          const linterTask = await createSmartLinterTask(results, projectPath, filePaths, analysis);
          taskCreated = await insertLinterTaskSmart(linterTask, analysis, projectPath);
          log(`Smart task creation result: ${taskCreated}`);
        } else {
          log('No TODO.json analysis available, skipping task creation');
        }
        
        // Format and output prompt for Claude
        const prompt = formatLinterPrompt(results, projectPath, filePaths, taskCreated);
        if (prompt) {
          log('\nGenerating violations prompt for Claude...');
          log(`Prompt length: ${prompt.length} characters`);
          process.stderr.write(prompt);
          log('\nExiting with code 2 - prompting Claude to fix violations');
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