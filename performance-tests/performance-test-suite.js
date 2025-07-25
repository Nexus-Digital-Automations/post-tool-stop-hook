#!/usr/bin/env node

/**
 * Performance Test Suite for Post-Tool Linter Hook
 * 
 * Tests the performance optimizations implemented in the linter hook:
 * - Caching effectiveness
 * - Async execution performance
 * - Strategy selection accuracy
 * - Overall execution time improvements
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  iterations: 5,
  timeoutMs: 30000,
  testProjects: {
    small: {
      name: 'Small Project',
      fileCount: 5,
      expectedStrategy: 'file-based',
      maxExecutionTime: 2000
    },
    medium: {
      name: 'Medium Project',
      fileCount: 15,
      expectedStrategy: 'project-wide',
      maxExecutionTime: 5000
    },
    large: {
      name: 'Large Project',
      fileCount: 50,
      expectedStrategy: 'project-wide',
      maxExecutionTime: 8000
    }
  }
};

// Performance metrics collection
class PerformanceMetrics {
  constructor() {
    this.tests = new Map();
    this.summary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      avgExecutionTime: 0,
      cacheEfficiency: 0
    };
  }

  addTest(testName, metrics) {
    this.tests.set(testName, metrics);
    this.summary.totalTests++;
    
    if (metrics.passed) {
      this.summary.passed++;
    } else {
      this.summary.failed++;
    }
  }

  calculateSummary() {
    const executionTimes = Array.from(this.tests.values()).map(t => t.executionTime);
    this.summary.avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    
    const cacheHitRatios = Array.from(this.tests.values())
      .filter(t => t.cacheHitRatio !== undefined)
      .map(t => t.cacheHitRatio);
    
    if (cacheHitRatios.length > 0) {
      this.summary.cacheEfficiency = cacheHitRatios.reduce((a, b) => a + b, 0) / cacheHitRatios.length;
    }
  }

  generateReport() {
    this.calculateSummary();
    
    let report = '\n=== PERFORMANCE TEST SUITE RESULTS ===\n';
    report += `Total Tests: ${this.summary.totalTests}\n`;
    report += `Passed: ${this.summary.passed}\n`;
    report += `Failed: ${this.summary.failed}\n`;
    report += `Success Rate: ${((this.summary.passed / this.summary.totalTests) * 100).toFixed(1)}%\n`;
    report += `Average Execution Time: ${this.summary.avgExecutionTime.toFixed(2)}ms\n`;
    report += `Cache Efficiency: ${this.summary.cacheEfficiency.toFixed(1)}%\n\n`;
    
    report += '=== DETAILED TEST RESULTS ===\n';
    for (const [testName, metrics] of this.tests.entries()) {
      report += `\n${testName}:\n`;
      report += `  Status: ${metrics.passed ? '✅ PASS' : '❌ FAIL'}\n`;
      report += `  Execution Time: ${metrics.executionTime.toFixed(2)}ms\n`;
      
      if (metrics.cacheHitRatio !== undefined) {
        report += `  Cache Hit Ratio: ${metrics.cacheHitRatio.toFixed(1)}%\n`;
      }
      
      if (metrics.strategyUsed) {
        report += `  Strategy Used: ${metrics.strategyUsed}\n`;
      }
      
      if (metrics.error) {
        report += `  Error: ${metrics.error}\n`;
      }
    }
    
    return report;
  }
}

// Mock hook data generator
function generateMockHookData(fileCount, projectType = 'javascript') {
  const basePath = '/mock/project';
  const files = [];
  
  for (let i = 1; i <= fileCount; i++) {
    const ext = projectType === 'python' ? '.py' : '.js';
    files.push(`${basePath}/file${i}${ext}`);
  }
  
  return {
    tool_name: 'Edit',
    tool_input: {
      file_path: files[0]
    },
    tool_output: {
      success: true
    },
    cwd: basePath
  };
}

// Test runner for individual performance tests
async function runPerformanceTest(testName, hookScript, mockData, _expectedMetrics) {
  const startTime = process.hrtime.bigint();
  
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('node', [hookScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: TEST_CONFIG.timeoutMs
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
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      // Send mock data to hook
      child.stdin.write(JSON.stringify(mockData));
      child.stdin.end();
    });
    
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to ms
    
    // Parse performance metrics from hook output
    const metrics = parseHookMetrics(result.stdout);
    
    return {
      passed: result.code === 0 || result.code === 2, // 0 = success, 2 = violations found
      executionTime,
      cacheHitRatio: metrics.cacheHitRatio,
      strategyUsed: metrics.strategyUsed,
      linterExecutions: metrics.linterExecutions,
      error: result.code !== 0 && result.code !== 2 ? result.stderr : null
    };
    
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1000000;
    
    return {
      passed: false,
      executionTime,
      error: error.message
    };
  }
}

// Parse performance metrics from hook log output
function parseHookMetrics(output) {
  const metrics = {
    cacheHitRatio: 0,
    strategyUsed: 'unknown',
    linterExecutions: 0
  };
  
  // Extract cache hit ratio
  const cacheMatch = output.match(/Cache hit ratio: ([\d.]+)%/);
  if (cacheMatch) {
    metrics.cacheHitRatio = parseFloat(cacheMatch[1]);
  }
  
  // Extract strategy used
  const strategyMatch = output.match(/Selected strategy: ([\w-]+)/);
  if (strategyMatch) {
    metrics.strategyUsed = strategyMatch[1];
  }
  
  // Extract linter executions
  const executionsMatch = output.match(/Linter executions: (\d+)/);
  if (executionsMatch) {
    metrics.linterExecutions = parseInt(executionsMatch[1]);
  }
  
  return metrics;
}

// Cache effectiveness test
async function testCacheEffectiveness(hookScript) {
  console.log('Testing cache effectiveness...');
  
  const mockData = generateMockHookData(10);
  const results = [];
  
  // Run multiple iterations to test cache warming
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    const result = await runPerformanceTest(
      `Cache Test Iteration ${i + 1}`,
      hookScript,
      mockData,
      { maxExecutionTime: 3000 }
    );
    results.push(result);
  }
  
  // Verify cache hit ratio improves over iterations
  const finalCacheRatio = results[results.length - 1].cacheHitRatio;
  const passed = finalCacheRatio > 50; // Should have > 50% cache hits after warming
  
  return {
    testName: 'Cache Effectiveness',
    passed,
    executionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
    cacheHitRatio: finalCacheRatio,
    error: !passed ? `Cache hit ratio too low: ${finalCacheRatio}%` : null
  };
}

// Strategy selection test
async function testStrategySelection(hookScript) {
  console.log('Testing strategy selection logic...');
  
  const tests = [];
  
  for (const [, config] of Object.entries(TEST_CONFIG.testProjects)) {
    const mockData = generateMockHookData(config.fileCount);
    const result = await runPerformanceTest(
      `Strategy Test - ${config.name}`,
      hookScript,
      mockData,
      { expectedStrategy: config.expectedStrategy }
    );
    
    // Verify correct strategy was selected
    const strategyCorrect = result.strategyUsed === config.expectedStrategy;
    result.passed = result.passed && strategyCorrect;
    
    if (!strategyCorrect) {
      result.error = `Expected ${config.expectedStrategy}, got ${result.strategyUsed}`;
    }
    
    tests.push({
      testName: `Strategy Selection - ${config.name}`,
      ...result
    });
  }
  
  return tests;
}

// Performance regression test
async function testPerformanceRegression(optimizedHook, originalHook) {
  console.log('Testing performance improvements...');
  
  const mockData = generateMockHookData(25); // Medium-sized test
  const tests = [];
  
  // Test optimized version
  const optimizedResult = await runPerformanceTest(
    'Optimized Hook Performance',
    optimizedHook,
    mockData,
    { maxExecutionTime: 5000 }
  );
  tests.push(optimizedResult);
  
  // Test original version if available
  if (fs.existsSync(originalHook)) {
    const originalResult = await runPerformanceTest(
      'Original Hook Performance',
      originalHook,
      mockData,
      { maxExecutionTime: 10000 }
    );
    
    // Calculate performance improvement
    const improvement = ((originalResult.executionTime - optimizedResult.executionTime) / originalResult.executionTime) * 100;
    
    tests.push({
      testName: 'Performance Comparison',
      passed: improvement > 10, // Should be at least 10% faster
      executionTime: improvement,
      error: improvement <= 10 ? `Only ${improvement.toFixed(1)}% improvement` : null
    });
    
    tests.push(originalResult);
  }
  
  return tests;
}

// Concurrent execution test
async function testConcurrentExecution(hookScript) {
  console.log('Testing concurrent execution handling...');
  
  const mockData = generateMockHookData(20);
  const concurrentPromises = [];
  
  // Run multiple hooks concurrently
  for (let i = 0; i < 3; i++) {
    concurrentPromises.push(
      runPerformanceTest(
        `Concurrent Test ${i + 1}`,
        hookScript,
        mockData,
        { maxExecutionTime: 8000 }
      )
    );
  }
  
  const results = await Promise.all(concurrentPromises);
  
  // Verify all executions completed successfully
  const allPassed = results.every(r => r.passed);
  const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
  
  return {
    testName: 'Concurrent Execution',
    passed: allPassed,
    executionTime: avgExecutionTime,
    error: !allPassed ? 'Some concurrent executions failed' : null
  };
}

// Main test suite runner
async function runPerformanceTestSuite() {
  console.log('🚀 Starting Performance Test Suite for Post-Tool Linter Hook\n');
  
  const metrics = new PerformanceMetrics();
  const optimizedHookPath = path.join(__dirname, 'performance-optimized-hook.js');
  const originalHookPath = path.join(__dirname, '..', 'post-tool-linter-hook.js');
  
  // Verify test files exist
  if (!fs.existsSync(optimizedHookPath)) {
    console.error('❌ Optimized hook not found:', optimizedHookPath);
    process.exit(1);
  }
  
  try {
    // Test 1: Cache Effectiveness
    const cacheTest = await testCacheEffectiveness(optimizedHookPath);
    metrics.addTest(cacheTest.testName, cacheTest);
    
    // Test 2: Strategy Selection
    const strategyTests = await testStrategySelection(optimizedHookPath);
    strategyTests.forEach(test => metrics.addTest(test.testName, test));
    
    // Test 3: Performance Regression
    const regressionTests = await testPerformanceRegression(optimizedHookPath, originalHookPath);
    regressionTests.forEach(test => metrics.addTest(test.testName, test));
    
    // Test 4: Concurrent Execution
    const concurrentTest = await testConcurrentExecution(optimizedHookPath);
    metrics.addTest(concurrentTest.testName, concurrentTest);
    
    // Generate and display results
    const report = metrics.generateReport();
    console.log(report);
    
    // Write report to file
    const reportPath = path.join(__dirname, 'performance-test-results.md');
    fs.writeFileSync(reportPath, `# Performance Test Results\n\n${report}\n`);
    console.log(`📊 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(metrics.summary.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run test suite if called directly
if (require.main === module) {
  runPerformanceTestSuite();
}

module.exports = {
  runPerformanceTestSuite,
  PerformanceMetrics,
  generateMockHookData,
  runPerformanceTest
};