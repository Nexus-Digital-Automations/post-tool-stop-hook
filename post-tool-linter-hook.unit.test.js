#!/usr/bin/env node

/**
 * Focused Unit Tests for Post-Tool Linter Hook
 * 
 * Streamlined tests focusing on coverage and correct expectations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('path');

// Import the hook functions
const hook = require('./post-tool-linter-hook.js');

describe('Post-Tool Linter Hook - Unit Tests', () => {
  let mockFs, mockExecSync, mockPath;

  beforeAll(() => {
    mockFs = fs;
    mockExecSync = execSync;
    mockPath = path;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => '/' + args.join('/'));
    mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    mockPath.basename.mockImplementation((p) => p.split('/').pop());
    mockPath.extname.mockImplementation((p) => {
      const parts = p.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });
    mockPath.relative.mockImplementation((from, to) => {
      // Simple relative path calculation for testing
      const fromParts = from.split('/').filter(Boolean);
      const toParts = to.split('/').filter(Boolean);
      
      // Find common prefix
      let commonLength = 0;
      while (commonLength < fromParts.length && commonLength < toParts.length &&
             fromParts[commonLength] === toParts[commonLength]) {
        commonLength++;
      }
      
      // Go up from 'from' path
      const upSteps = fromParts.length - commonLength;
      const relativeParts = Array(upSteps).fill('..');
      
      // Add remaining parts from 'to' path
      relativeParts.push(...toParts.slice(commonLength));
      
      return relativeParts.join('/') || '.';
    });

    // Setup basic fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});

    // Setup basic execSync mock
    mockExecSync.mockReturnValue('');
  });

  describe('CONFIG', () => {
    test('should have valid configuration structure', () => {
      expect(hook.CONFIG).toBeDefined();
      expect(hook.CONFIG.timeout).toBeGreaterThan(0);
      expect(hook.CONFIG.linters).toBeDefined();
      expect(hook.CONFIG.linters.python).toBeDefined();
      expect(hook.CONFIG.linters.javascript).toBeDefined();
    });
  });

  describe('getFileType', () => {
    test('should detect Python files correctly', () => {
      expect(hook.getFileType('/path/to/file.py')).toBe('python');
      expect(hook.getFileType('/path/to/file.pyi')).toBe('python');
    });

    test('should detect JavaScript files correctly', () => {
      expect(hook.getFileType('/path/to/file.js')).toBe('javascript');
      expect(hook.getFileType('/path/to/file.jsx')).toBe('javascript');
      expect(hook.getFileType('/path/to/file.ts')).toBe('javascript');
      expect(hook.getFileType('/path/to/file.tsx')).toBe('javascript');
    });

    test('should return null for unsupported files', () => {
      expect(hook.getFileType('/path/to/file.txt')).toBe(null);
      expect(hook.getFileType('/path/to/file.md')).toBe(null);
      expect(hook.getFileType('/path/to/file.json')).toBe(null);
    });

    test('should return null for files with no extension', () => {
      expect(hook.getFileType('/path/to/file')).toBe(null);
    });
  });

  describe('extractFilePaths', () => {
    test('should extract file path from Edit tool', () => {
      const hookData = {
        tool_name: 'Edit',
        tool_input: { file_path: '/path/to/file.py' }
      };
      expect(hook.extractFilePaths(hookData)).toEqual(['/path/to/file.py']);
    });

    test('should extract file path from Write tool', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/file.js' }
      };
      expect(hook.extractFilePaths(hookData)).toEqual(['/path/to/file.js']);
    });

    test('should extract file path from MultiEdit tool', () => {
      const hookData = {
        tool_name: 'MultiEdit',
        tool_input: { file_path: '/path/to/file.ts' }
      };
      expect(hook.extractFilePaths(hookData)).toEqual(['/path/to/file.ts']);
    });

    test('should return empty array for unsupported tools', () => {
      const hookData = {
        tool_name: 'Read',
        tool_input: { file_path: '/path/to/file.py' }
      };
      expect(hook.extractFilePaths(hookData)).toEqual([]);
    });
  });

  describe('initializeLogging', () => {
    test('should handle project path correctly', () => {
      expect(() => hook.initializeLogging('/test/project')).not.toThrow();
      expect(mockPath.join).toHaveBeenCalled();
    });

    test('should handle missing project path', () => {
      expect(() => hook.initializeLogging()).not.toThrow();
    });
  });

  describe('validateConfigFile', () => {
    test('should validate package.json with scripts', () => {
      mockFs.readFileSync.mockReturnValue('{"scripts": {"test": "jest"}}');
      expect(hook.validateConfigFile('/path/package.json', 'javascript')).toBe(true);
    });

    test('should validate package.json with dependencies', () => {
      mockFs.readFileSync.mockReturnValue('{"dependencies": {"react": "^18.0.0"}}');
      expect(hook.validateConfigFile('/path/package.json', 'javascript')).toBe(true);
    });

    test('should reject empty package.json', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      expect(hook.validateConfigFile('/path/package.json', 'javascript')).toBe(false);
    });

    test('should validate pyproject.toml with tool section', () => {
      mockFs.readFileSync.mockReturnValue('[tool.ruff]\nselect = ["E", "F"]');
      expect(hook.validateConfigFile('/path/pyproject.toml', 'python')).toBe(true);
    });

    test('should return false for non-existent files', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(hook.validateConfigFile('/missing/file', 'test')).toBe(false);
    });
  });

  describe('detectProjectType', () => {
    test('should detect JavaScript project', () => {
      mockFs.existsSync.mockImplementation((path) => path.includes('package.json'));
      mockFs.readFileSync.mockReturnValue('{"scripts": {"test": "jest"}}');
      
      expect(hook.detectProjectType('/test/project')).toBe('javascript');
    });

    test('should detect Python project', () => {
      mockFs.existsSync.mockImplementation((path) => path.includes('pyproject.toml'));
      mockFs.readFileSync.mockReturnValue('[tool.ruff]\\nselect = ["E"]');
      
      expect(hook.detectProjectType('/test/project')).toBe('python');
    });

    test('should return null for unknown projects', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(hook.detectProjectType('/test/project')).toBe(null);
    });
  });

  describe('determineInsertionPoint', () => {
    test('should determine insertion point after current task', () => {
      const analysis = { currentTaskIndex: 2 };
      expect(hook.determineInsertionPoint(analysis)).toBe(3);
    });

    test('should handle null analysis', () => {
      expect(hook.determineInsertionPoint(null)).toBe(-1);
    });

    test('should handle undefined currentTaskIndex', () => {
      const analysis = {};
      expect(hook.determineInsertionPoint(analysis)).toBe(0); // Should return 0 when no taskCount
    });
  });

  describe('removeLinterTasks', () => {
    test('should remove linter tasks from todo data', () => {
      const todoData = {
        tasks: [
          { id: 'task1', title: 'Regular task' },
          { id: 'linter_task', is_linter_task: true, title: 'Fix Linter Errors' },
          { id: 'task2', title: 'Another task' }
        ]
      };

      const result = hook.removeLinterTasks(todoData);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(task => !task.is_linter_task)).toBe(true);
    });

    test('should handle empty tasks array', () => {
      const todoData = { tasks: [] };
      const result = hook.removeLinterTasks(todoData);
      expect(result.tasks).toEqual([]);
    });

    test('should handle missing tasks property', () => {
      const todoData = {};
      const result = hook.removeLinterTasks(todoData);
      expect(result.tasks).toEqual([]);
    });
  });

  describe('async functions', () => {
    test('analyzeTodoState should handle missing TODO.json', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await hook.analyzeTodoState('/test/project');
      expect(result).toEqual({
        exists: false,
        valid: false,
        taskCount: 0,
        currentTaskIndex: null
      });
    });

    test('analyzeTodoState should parse valid TODO.json', async () => {
      const todoContent = JSON.stringify({
        current_task_index: 1,
        tasks: [
          { id: 'task1', status: 'completed' },
          { id: 'task2', status: 'pending' }
        ]
      });
      mockFs.readFileSync.mockReturnValue(todoContent);

      const result = await hook.analyzeTodoState('/test/project');
      expect(result).not.toBe(null);
      expect(result.currentTaskIndex).toBe(1);
      expect(result.totalTasks).toBe(2);
    });

    test('createSmartLinterTask should generate task object', async () => {
      const results = [{
        filePath: '/path/to/file.py',
        linter: 'ruff',
        violations: [{ line: 1, message: 'Test error', severity: 'error' }]
      }];

      const task = await hook.createSmartLinterTask(results, '/test/project', ['/path/to/file.py']);
      
      expect(task.title).toContain('Fix');
      expect(task.is_linter_task).toBe(true);
      expect(task.important_files).toContain('development/linter-errors.md');
      expect(task.important_files).toContain('../../path/to/file.py');
    });
  });
});