#!/usr/bin/env node

/**
 * Unit Tests for Setup Post-Tool Hook Script
 * 
 * Tests the setup script functionality for configuring the post-tool linter hook
 * in Claude Code settings with proper mocking and cross-platform compatibility.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');

// Mock process.exit to prevent Jest from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Import the setup script functions
const setupScript = require('./setup-post-tool-hook.js');

describe('Setup Post-Tool Hook Script', () => {
  let mockFs, mockPath, mockOs, mockExecSync;
  let consoleSpy, consoleErrorSpy;

  beforeAll(() => {
    mockFs = fs;
    mockPath = path;
    mockOs = os;
    mockExecSync = execSync;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.exit mock
    mockExit.mockClear();
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock path methods with better handling for undefined inputs
    mockPath.resolve.mockImplementation((...args) => {
      const filtered = args.filter(arg => arg !== null);
      return '/' + filtered.join('/');
    });
    mockPath.join.mockImplementation((...args) => {
      const filtered = args.filter(arg => arg !== null);
      return filtered.join('/');
    });
    mockPath.dirname.mockImplementation((p) => {
      if (!p || typeof p !== 'string') return '/';
      return p.split('/').slice(0, -1).join('/') || '/';
    });
    mockPath.basename.mockImplementation((p) => {
      if (!p || typeof p !== 'string') return '';
      return p.split('/').pop() || '';
    });

    // Mock os methods
    mockOs.platform.mockReturnValue('darwin');
    mockOs.homedir.mockReturnValue('/Users/testuser');

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.statSync.mockReturnValue({ isFile: () => true });

    // Mock execSync
    mockExecSync.mockReturnValue('command executed');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('Constants and Configuration', () => {
    test('should have correct Claude settings paths for all platforms', () => {
      const paths = setupScript.getClaudeSettingsPaths();
      expect(paths).toBeDefined();
      expect(paths.win32).toContain('AppData');
      expect(paths.darwin).toContain('.claude');
      expect(paths.linux).toContain('.claude');
    });

    test('should have valid hook path', () => {
      const hookPath = setupScript.getHookPath();
      expect(hookPath).toBeDefined();
      expect(hookPath).toContain('post-tool-linter-hook.js');
    });

    test('should set correct settings path based on platform', () => {
      const settingsPath = setupScript.getSettingsPath();
      expect(settingsPath).toBeDefined();
      // Will use darwin path due to our mock
      expect(settingsPath).toContain('.claude');
    });
  });

  describe('getArgValue', () => {
    test('should return correct argument value', () => {
      // Mock process.argv
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--timeout', '5000', '--flag'];
      
      const value = setupScript.getArgValue('--timeout', 15000);
      expect(value).toBe('5000');
      
      process.argv = originalArgv;
    });

    test('should return default value when argument not found', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--other-flag'];
      
      const value = setupScript.getArgValue('--timeout', 15000);
      expect(value).toBe(15000);
      
      process.argv = originalArgv;
    });

    test('should return default value when no value provided after flag', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--timeout'];
      
      const value = setupScript.getArgValue('--timeout', 15000);
      expect(value).toBe(15000);
      
      process.argv = originalArgv;
    });
  });

  describe('ensureSettingsDirectory', () => {
    test('should create settings directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      setupScript.ensureSettingsDirectory();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude'),
        { recursive: true }
      );
    });

    test('should not create directory if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      setupScript.ensureSettingsDirectory();
      
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('loadSettings', () => {
    test('should load existing settings file', () => {
      const mockSettings = { hooks: { existing: 'hook' } };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));
      
      const settings = setupScript.loadSettings();
      
      expect(settings).toEqual(mockSettings);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        'utf8'
      );
    });

    test('should return default settings when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const settings = setupScript.loadSettings();
      
      expect(settings).toEqual({ hooks: {} });
    });

    test('should exit process when file is corrupted', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockFs.copyFileSync.mockImplementation(() => {});
      
      setupScript.loadSettings();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should handle read errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const settings = setupScript.loadSettings();
      
      expect(settings).toEqual({ hooks: {} });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('saveSettings', () => {
    test('should save settings to file', () => {
      const settings = { hooks: { PostToolUse: ['hook-script.js'] } };
      
      setupScript.saveSettings(settings);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        JSON.stringify(settings, null, 2),
        'utf8'
      );
    });

    test('should handle write errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      const settings = { hooks: {} };
      
      expect(() => setupScript.saveSettings(settings)).toThrow('Write failed');
    });
  });

  describe('validateHookScript', () => {
    test('should return true for existing hook script', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      
      const isValid = setupScript.validateHookScript();
      
      expect(isValid).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining('post-tool-linter-hook.js'));
    });

    test('should return false for non-existent hook script', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const isValid = setupScript.validateHookScript();
      
      expect(isValid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hook script not found')
      );
    });

    test('should return false for directory instead of file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => false });
      
      const isValid = setupScript.validateHookScript();
      
      expect(isValid).toBe(false);
    });
  });

  describe('createLocalSettings', () => {
    test('should create local settings file', () => {
      const projectPath = '/test/project';
      
      setupScript.createLocalSettings(projectPath);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.stringContaining('PostToolUse')
      );
    });

    test('should handle directory creation for local settings', () => {
      const projectPath = '/test/project';
      mockFs.existsSync.mockReturnValue(false);
      
      setupScript.createLocalSettings(projectPath);
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('installHook', () => {
    test('should install hook successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.installHook();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Hook installed successfully')
      );
    });

    test('should fail when hook script is invalid', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      expect(() => setupScript.installHook()).toThrow();
    });

    test('should update existing hook configuration', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: ['existing-hook.js']
        }
      }));
      
      setupScript.installHook();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      expect(savedSettings.hooks.PostToolUse).toHaveLength(2);
    });
  });

  describe('validateConfiguration', () => {
    test('should validate correct configuration', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [expect.stringContaining('post-tool-linter-hook.js')]
        }
      }));
      
      const isValid = setupScript.validateConfiguration();
      
      expect(isValid).toBe(true);
    });

    test('should return false for missing configuration', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      const isValid = setupScript.validateConfiguration();
      
      expect(isValid).toBe(false);
    });

    test('should return false when settings file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const isValid = setupScript.validateConfiguration();
      
      expect(isValid).toBe(false);
    });
  });

  describe('checkLinterAvailability', () => {
    test('should check ESLint availability', () => {
      mockExecSync.mockReturnValue('9.0.0');
      
      setupScript.checkLinterAvailability();
      
      expect(mockExecSync).toHaveBeenCalledWith('npx eslint --version', expect.any(Object));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ ESLint')
      );
    });

    test('should handle missing ESLint gracefully', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('eslint')) {
          throw new Error('Command not found');
        }
        return 'output';
      });
      
      setupScript.checkLinterAvailability();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  ESLint not found')
      );
    });

    test('should check Ruff availability', () => {
      mockExecSync.mockReturnValue('0.1.0');
      
      setupScript.checkLinterAvailability();
      
      expect(mockExecSync).toHaveBeenCalledWith('ruff --version', expect.any(Object));
    });
  });

  describe('uninstallHook', () => {
    test('should remove hook from configuration', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [
            'other-hook.js',
            expect.stringContaining('post-tool-linter-hook.js')
          ]
        }
      }));
      
      setupScript.uninstallHook();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      expect(savedSettings.hooks.PostToolUse).toHaveLength(1);
      expect(savedSettings.hooks.PostToolUse[0]).toBe('other-hook.js');
    });

    test('should handle case when hook is not installed', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.uninstallHook();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hook is not currently installed')
      );
    });

    test('should remove PostToolUse section when no hooks remain', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [expect.stringContaining('post-tool-linter-hook.js')]
        }
      }));
      
      setupScript.uninstallHook();
      
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      expect(savedSettings.hooks.PostToolUse).toBeUndefined();
    });
  });

  describe('showCurrentConfig', () => {
    test('should display current configuration', () => {
      const settings = {
        hooks: {
          PostToolUse: ['hook1.js', 'hook2.js']
        }
      };
      
      setupScript.showCurrentConfig(settings);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current Configuration')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('hook1.js')
      );
    });

    test('should show message when no hooks configured', () => {
      const settings = { hooks: {} };
      
      setupScript.showCurrentConfig(settings);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No PostToolUse hooks')
      );
    });
  });

  describe('showHookInfo', () => {
    test('should display hook information', () => {
      setupScript.showHookInfo();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Post-Tool Linter Hook')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Features')
      );
    });
  });

  describe('Cross-platform compatibility', () => {
    test('should use correct settings path for Windows', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const settingsPath = setupScript.getSettingsPath();
      expect(settingsPath).toContain('AppData');
      expect(settingsPath).toContain('Roaming');
    });

    test('should use correct settings path for Linux', () => {
      mockOs.platform.mockReturnValue('linux');
      
      const settingsPath = setupScript.getSettingsPath();
      expect(settingsPath).toContain('.claude');
    });

    test('should fallback to Linux path for unknown platforms', () => {
      mockOs.platform.mockReturnValue('freebsd');
      
      const settingsPath = setupScript.getSettingsPath();
      expect(settingsPath).toContain('.claude');
    });
  });

  describe('Error handling', () => {
    test('should handle JSON parse errors in settings', () => {
      mockFs.readFileSync.mockReturnValue('invalid json {');
      
      const settings = setupScript.loadSettings();
      
      expect(settings).toEqual({ hooks: {} });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      expect(() => setupScript.validateHookScript()).not.toThrow();
    });

    test('should handle command execution errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      
      expect(() => setupScript.checkLinterAvailability()).not.toThrow();
    });
  });
});