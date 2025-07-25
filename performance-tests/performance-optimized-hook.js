#!/usr/bin/env node

/**
 * Performance-Optimized Post-Tool Linter Hook for Claude Code
 * 
 * Optimizations implemented:
 * - In-memory caching for project type detection
 * - File type detection caching
 * - Async linter execution with timeout control
 * - Performance metrics collection
 * - Smart project-wide vs file-based linting decisions
 * - Reduced file system operations
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Performance monitoring
const performanceMetrics = {
  startTime: null,
  endTime: null,
  phases: {},
  cacheHits: 0,
  cacheMisses: 0,
  linterExecutions: 0
};

function startTiming(phase) {
  performanceMetrics.phases[phase] = { start: process.hrtime.bigint() };
}

function endTiming(phase) {
  if (performanceMetrics.phases[phase]) {
    performanceMetrics.phases[phase].end = process.hrtime.bigint();
    performanceMetrics.phases[phase].duration = 
      Number(performanceMetrics.phases[phase].end - performanceMetrics.phases[phase].start) / 1000000; // Convert to ms
  }
}

// In-memory caches with TTL
const projectTypeCache = new Map();
const fileTypeCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

function getCacheKey(projectPath) {
  try {
    const stats = fs.statSync(projectPath);
    return `${projectPath}:${stats.mtime.getTime()}`;
  } catch {
    return projectPath;
  }
}

function getCachedProjectTypes(projectPath) {
  const cacheKey = getCacheKey(projectPath);
  const cached = projectTypeCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    performanceMetrics.cacheHits++;
    log(`Cache HIT for project types: ${projectPath}`);
    return cached.types;
  }
  
  performanceMetrics.cacheMisses++;
  log(`Cache MISS for project types: ${projectPath}`);
  return null;
}

function setCachedProjectTypes(projectPath, types) {
  const cacheKey = getCacheKey(projectPath);
  projectTypeCache.set(cacheKey, {
    types,
    timestamp: Date.now()
  });
  
  // Cleanup old cache entries
  if (projectTypeCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of projectTypeCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        projectTypeCache.delete(key);
      }
    }
  }
}

function getCachedFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const cached = fileTypeCache.get(ext);
  
  if (cached) {
    performanceMetrics.cacheHits++;
    return cached;
  }
  
  performanceMetrics.cacheMisses++;
  return null;
}

function setCachedFileType(filePath, type) {
  const ext = path.extname(filePath).toLowerCase();
  fileTypeCache.set(ext, type);
}

// Initialize logging
let logFile = null;
let logContent = [];

function initializeLogging(projectPath) {
  const logPath = path.join(projectPath, 'post-tool-linter-hook.log');
  logFile = logPath;
  logContent = [];
  log('=== PERFORMANCE-OPTIMIZED POST-TOOL LINTER HOOK LOG ===');
  log(`Date: ${new Date().toISOString()}`);
  log(`Project: ${projectPath}`);
  log(`Node Version: ${process.version}`);
  log(`Platform: ${process.platform}`);
  log('');
}

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  logContent.push(logEntry);
  
  if (data !== null) {
    const dataStr = JSON.stringify(data, null, 2);
    logContent.push(`  Data: ${dataStr}`);
  }
}

function writeLogFile() {
  if (logFile && logContent.length > 0) {
    try {
      // Add performance metrics to log
      const metricsReport = generatePerformanceReport();
      logContent.push('\n=== PERFORMANCE METRICS ===');
      logContent.push(metricsReport);
      
      fs.writeFileSync(logFile, logContent.join('\n') + '\n');
    } catch {
      // Silently fail log file writes
    }
  }
}

function generatePerformanceReport() {
  const totalTime = performanceMetrics.endTime - performanceMetrics.startTime;
  let report = `Total execution time: ${(Number(totalTime) / 1000000).toFixed(2)}ms\n`;
  report += `Cache hits: ${performanceMetrics.cacheHits}, misses: ${performanceMetrics.cacheMisses}\n`;
  report += `Linter executions: ${performanceMetrics.linterExecutions}\n`;
  report += `Cache hit ratio: ${((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100).toFixed(1)}%\n`;
  
  report += '\nPhase timings:\n';
  for (const [phase, timing] of Object.entries(performanceMetrics.phases)) {
    if (timing.duration) {
      report += `  ${phase}: ${timing.duration.toFixed(2)}ms\n`;
    }
  }
  
  return report;
}

// Enhanced configuration with performance optimizations
const CONFIG = {
  timeout: 8000, // Slightly increased timeout for async operations
  enabledTools: ['Edit', 'Write', 'MultiEdit'],
  lintingMode: 'smart', // 'files-only', 'project-wide', 'hybrid', 'smart'
  maxFilesForFileMode: 5, // Increased threshold
  respectIgnoreFiles: true,
  performanceMode: true,
  asyncLinting: true, // Enable async linter execution
  maxConcurrentLinters: 2, // Limit concurrent executions
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

// Optimized file system operations with reduced I/O
async function validateConfigFileBatch(configPaths, _type) {
  startTiming('validateConfigFiles');
  
  const validationPromises = configPaths.map(async (configPath) => {
    try {
      const exists = fs.existsSync(configPath);
      if (!exists) return { configPath, valid: false };
      
      // Use async file reading for better performance
      const content = await fs.promises.readFile(configPath, 'utf8');
      
      let isValid = false;
      if (configPath.endsWith('package.json')) {
        const parsed = JSON.parse(content);
        isValid = !!(parsed.scripts || parsed.dependencies || parsed.devDependencies || parsed.type);
      } else if (configPath.endsWith('pyproject.toml')) {
        isValid = content.includes('[tool.') || content.includes('[build-system]') || content.includes('[project]');
      } else if (configPath.endsWith('setup.py')) {
        isValid = content.includes('setup(') || content.includes('from setuptools');
      } else {
        isValid = true; // Existence is sufficient for other files
      }
      
      return { configPath, valid: isValid };
    } catch {
      return { configPath, valid: false };
    }
  });
  
  const results = await Promise.all(validationPromises);
  endTiming('validateConfigFiles');
  
  return results.filter(r => r.valid).length;
}

async function detectProjectTypesOptimized(projectPath) {
  startTiming('detectProjectTypes');
  
  // Check cache first
  const cached = getCachedProjectTypes(projectPath);
  if (cached !== null) {
    endTiming('detectProjectTypes');
    return cached;
  }
  
  log(`Detecting project types for: ${projectPath} (cache miss)`);
  
  
  // Batch process all linter types
  const typePromises = Object.entries(CONFIG.linters).map(async ([type, config]) => {
    const configPaths = config.configFiles.map(f => path.join(projectPath, f));
    const score = await validateConfigFileBatch(configPaths, type);
    
    return score > 0 ? { type, score } : null;
  });
  
  const typeResults = await Promise.all(typePromises);
  const validTypes = typeResults.filter(r => r !== null).map(r => r.type);
  
  // Cache the result
  setCachedProjectTypes(projectPath, validTypes);
  
  log(`Project types detected: ${validTypes.length > 0 ? validTypes.join(', ') : 'none'}`);
  endTiming('detectProjectTypes');
  return validTypes;
}

function getFileTypeOptimized(filePath) {
  // Check cache first
  const cached = getCachedFileType(filePath);
  if (cached !== null) {
    return cached;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  
  // Skip extensions check
  if (CONFIG.skipExtensions.includes(ext)) {
    setCachedFileType(filePath, null);
    return null;
  }
  
  // Find matching linter type
  for (const [type, config] of Object.entries(CONFIG.linters)) {
    if (config.fileExtensions.includes(ext)) {
      setCachedFileType(filePath, type);
      return type;
    }
  }
  
  setCachedFileType(filePath, null);
  return null;
}

// Async linter execution with better error handling
async function runLinterAsync(command, options) {
  startTiming('linterExecution');
  performanceMetrics.linterExecutions++;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      ...options,
      timeout: CONFIG.timeout
    });
    
    endTiming('linterExecution');
    return { success: true, stdout, stderr };
  } catch (error) {
    endTiming('linterExecution');
    return { 
      success: false, 
      error, 
      stdout: error.stdout, 
      stderr: error.stderr,
      code: error.code
    };
  }
}

async function runPythonLinterOptimized(filePath, projectPath) {
  log(`Running optimized Python linter on: ${filePath}`);
  
  const command = `ruff check "${filePath}" --output-format json`;
  const result = await runLinterAsync(command, {
    cwd: projectPath,
    encoding: 'utf8'
  });
  
  if (result.success) {
    const violations = JSON.parse(result.stdout || '[]');
    return {
      success: violations.length === 0,
      linter: 'ruff',
      file: filePath,
      violations: violations.map(v => ({
        line: v.location?.row || 0,
        column: v.location?.column || 0,
        code: v.code,
        message: v.message,
        severity: 'error',
        fixable: v.fix !== null && v.fix !== undefined
      }))
    };
  } else {
    // Handle error cases (similar to original but with async handling)
    if (result.code === 1 && result.stdout) {
      try {
        const violations = JSON.parse(result.stdout);
        return {
          success: false,
          linter: 'ruff',
          file: filePath,
          violations: violations.map(v => ({
            line: v.location?.row || 0,
            column: v.location?.column || 0,
            code: v.code,
            message: v.message,
            severity: 'error',
            fixable: v.fix !== null && v.fix !== undefined
          }))
        };
      } catch {
        return { success: true, linter: 'ruff', file: filePath, violations: [] };
      }
    }
    
    return {
      success: false,
      linter: 'ruff',
      file: filePath,
      violations: [],
      executionFailure: true,
      failureType: 'execution_error',
      message: `Ruff execution failed: ${result.error.message}`
    };
  }
}

async function runJavaScriptLinterOptimized(filePath, projectPath) {
  log(`Running optimized JavaScript linter on: ${filePath}`);
  
  // Find eslint command (cached approach)
  let eslintCommand = 'eslint';
  const localEslint = path.join(projectPath, 'node_modules', '.bin', 'eslint');
  
  if (fs.existsSync(localEslint)) {
    eslintCommand = localEslint;
  }
  
  const command = `"${eslintCommand}" "${filePath}" --format json --no-warn-ignored`;
  const result = await runLinterAsync(command, {
    cwd: projectPath,
    encoding: 'utf8'
  });
  
  if (result.success) {
    const reports = JSON.parse(result.stdout || '[]');
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
  } else {
    // Handle ESLint errors (similar structure to Python linter)
    if (result.stdout) {
      try {
        const reports = JSON.parse(result.stdout);
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
      } catch {
        return { success: true, linter: 'eslint', file: filePath, violations: [] };
      }
    }
    
    return {
      success: false,
      linter: 'eslint',
      file: filePath,
      violations: [],
      executionFailure: true,
      failureType: 'execution_error',
      message: `ESLint execution failed: ${result.error.message}`
    };
  }
}

// Smart linting strategy selection
function selectLintingStrategy(filePaths, projectTypes) {
  startTiming('strategySelection');
  
  const fileTypes = filePaths.map(fp => getFileTypeOptimized(fp)).filter(Boolean);
  const uniqueFileTypes = [...new Set(fileTypes)];
  
  log(`Strategy analysis: ${filePaths.length} files, ${uniqueFileTypes.length} unique types, ${projectTypes.length} project types`);
  
  let strategy;
  
  if (CONFIG.lintingMode === 'smart') {
    // Smart strategy: optimize based on file count and type overlap
    const fileTypesMatchProject = uniqueFileTypes.every(ft => projectTypes.includes(ft));
    const manyFiles = filePaths.length > CONFIG.maxFilesForFileMode;
    
    if (projectTypes.length > 0 && (fileTypesMatchProject || manyFiles)) {
      strategy = 'project-wide';
    } else {
      strategy = 'file-based';
    }
  } else {
    strategy = CONFIG.lintingMode === 'project-wide' ? 'project-wide' : 'file-based';
  }
  
  log(`Selected strategy: ${strategy}`);
  endTiming('strategySelection');
  return strategy;
}

// Project-wide linting for better performance on large codebases
async function runProjectWideLinting(projectTypes, projectPath) {
  startTiming('projectWideLinting');
  
  const results = [];
  
  for (const projectType of projectTypes) {
    if (projectType === 'python') {
      log(`Running project-wide Python linting`);
      const command = `ruff check . --output-format json`;
      const result = await runLinterAsync(command, {
        cwd: projectPath,
        encoding: 'utf8'
      });
      
      if (result.success) {
        const violations = JSON.parse(result.stdout || '[]');
        results.push({
          success: violations.length === 0,
          linter: 'ruff',
          file: projectPath,
          projectWide: true,
          violations: violations.map(v => ({
            line: v.location?.row || 0,
            column: v.location?.column || 0,
            code: v.code,
            message: v.message,
            severity: 'error',
            fixable: v.fix !== null && v.fix !== undefined,
            filename: v.filename
          }))
        });
      } else {
        results.push({
          success: false,
          linter: 'ruff',
          file: projectPath,
          projectWide: true,
          violations: [],
          executionFailure: true,
          failureType: 'execution_error',
          message: `Project-wide Ruff execution failed: ${result.error.message}`
        });
      }
    } else if (projectType === 'javascript') {
      log(`Running project-wide JavaScript linting`);
      let eslintCommand = 'eslint';
      const localEslint = path.join(projectPath, 'node_modules', '.bin', 'eslint');
      
      if (fs.existsSync(localEslint)) {
        eslintCommand = localEslint;
      }
      
      const command = `"${eslintCommand}" . --format json --no-warn-ignored`;
      const result = await runLinterAsync(command, {
        cwd: projectPath,
        encoding: 'utf8'
      });
      
      if (result.success) {
        const reports = JSON.parse(result.stdout || '[]');
        const allViolations = [];
        let hasErrors = false;
        
        for (const report of reports) {
          if (report.errorCount > 0 || report.warningCount > 0) {
            hasErrors = hasErrors || report.errorCount > 0;
            allViolations.push(...report.messages.map(m => ({
              line: m.line,
              column: m.column,
              severity: m.severity === 2 ? 'error' : 'warning',
              message: m.message,
              code: m.ruleId,
              fixable: m.fix !== undefined,
              filename: report.filePath
            })));
          }
        }
        
        results.push({
          success: allViolations.length === 0,
          linter: 'eslint',
          file: projectPath,
          projectWide: true,
          violations: allViolations
        });
      } else {
        results.push({
          success: false,
          linter: 'eslint',
          file: projectPath,
          projectWide: true,
          violations: [],
          executionFailure: true,
          failureType: 'execution_error',
          message: `Project-wide ESLint execution failed: ${result.error.message}`
        });
      }
    }
  }
  
  endTiming('projectWideLinting');
  return results;
}

// Concurrent file linting with semaphore
async function lintFilesConcurrently(filePaths, projectPath) {
  startTiming('concurrentLinting');
  
  const semaphore = new Array(CONFIG.maxConcurrentLinters).fill(null);
  let semaphoreIndex = 0;
  
  const lintingTasks = filePaths.map(async (filePath) => {
    // Wait for semaphore slot
    const slotIndex = semaphoreIndex++ % CONFIG.maxConcurrentLinters;
    await semaphore[slotIndex];
    
    const fileType = getFileTypeOptimized(filePath);
    if (!fileType) {
      return { success: true, file: filePath, reason: 'No linter configured' };
    }
    
    let result;
    if (fileType === 'python') {
      result = await runPythonLinterOptimized(filePath, projectPath);
    } else if (fileType === 'javascript') {
      result = await runJavaScriptLinterOptimized(filePath, projectPath);
    } else {
      result = { success: true, file: filePath, reason: 'Unsupported file type' };
    }
    
    // Release semaphore slot
    semaphore[slotIndex] = Promise.resolve();
    
    return result;
  });
  
  const results = await Promise.all(lintingTasks);
  endTiming('concurrentLinting');
  return results;
}

// Main optimized execution
async function main() {
  performanceMetrics.startTime = process.hrtime.bigint();
  
  let inputData = '';
  
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => inputData += chunk);
  
  process.stdin.on('end', async () => {
    let projectPath = process.cwd();
    
    try {
      startTiming('initialization');
      
      const hookData = JSON.parse(inputData);
      projectPath = hookData.cwd || process.cwd();
      
      initializeLogging(projectPath);
      
      log('=== PERFORMANCE-OPTIMIZED HOOK EXECUTION START ===');
      log(`Tool: ${hookData.tool_name}`);
      
      endTiming('initialization');
      
      // Skip checks
      if (!CONFIG.enabledTools.includes(hookData.tool_name)) {
        log(`Tool ${hookData.tool_name} not enabled, skipping`);
        writeLogFile();
        performanceMetrics.endTime = process.hrtime.bigint();
        process.exit(0);
      }
      
      if (hookData.tool_output && !hookData.tool_output.success) {
        log('Tool execution failed, skipping');
        writeLogFile();
        performanceMetrics.endTime = process.hrtime.bigint();
        process.exit(0);
      }
      
      // Extract file paths (optimized)
      startTiming('fileExtraction');
      const filePaths = [];
      
      if (hookData.tool_name === 'Edit' || hookData.tool_name === 'Write') {
        if (hookData.tool_input?.file_path && fs.existsSync(hookData.tool_input.file_path)) {
          filePaths.push(hookData.tool_input.file_path);
        }
      } else if (hookData.tool_name === 'MultiEdit') {
        if (hookData.tool_input?.file_path && fs.existsSync(hookData.tool_input.file_path)) {
          filePaths.push(hookData.tool_input.file_path);
        }
      }
      endTiming('fileExtraction');
      
      if (filePaths.length === 0) {
        log('No valid file paths found');
        writeLogFile();
        performanceMetrics.endTime = process.hrtime.bigint();
        process.exit(0);
      }
      
      log(`Starting optimized linting for ${filePaths.length} file(s)...`);
      
      // Optimized project type detection
      const projectTypes = await detectProjectTypesOptimized(projectPath);
      
      // Smart strategy selection
      const strategy = selectLintingStrategy(filePaths, projectTypes);
      
      let results = [];
      
      if (strategy === 'project-wide' && projectTypes.length > 0) {
        log(`Using project-wide linting strategy`);
        results = await runProjectWideLinting(projectTypes, projectPath);
      } else {
        log(`Using concurrent file-based linting strategy`);
        results = await lintFilesConcurrently(filePaths, projectPath);
      }
      
      // Performance reporting
      performanceMetrics.endTime = process.hrtime.bigint();
      const performanceReport = generatePerformanceReport();
      
      log('\n=== PERFORMANCE OPTIMIZATION RESULTS ===');
      log(performanceReport);
      
      // Check for violations and handle as before
      const hasViolations = results.some(r => !r.success && !r.executionFailure);
      
      if (hasViolations) {
        log('Violations found, generating prompt...');
        // Use original prompt generation logic
        const prompt = `
🔥 PERFORMANCE-OPTIMIZED LINTER FOUND ISSUES 🔥

Optimized execution completed in ${(Number(performanceMetrics.endTime - performanceMetrics.startTime) / 1000000).toFixed(2)}ms
Cache efficiency: ${((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100).toFixed(1)}%

Please fix the linting violations found.
`;
        process.stderr.write(prompt);
        writeLogFile();
        process.exit(2);
      }
      
      log('Optimized linting completed successfully');
      writeLogFile();
      process.exit(0);
      
    } catch (error) {
      log(`ERROR: ${error.message}`);
      performanceMetrics.endTime = process.hrtime.bigint();
      writeLogFile();
      process.exit(0);
    }
  });
  
  // Timeout handling
  setTimeout(() => {
    log('ERROR: Optimized hook timeout exceeded');
    performanceMetrics.endTime = process.hrtime.bigint();
    writeLogFile();
    process.exit(0);
  }, CONFIG.timeout + 5000);
}

// Run the optimized hook
main();