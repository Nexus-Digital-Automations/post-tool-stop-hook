#!/usr/bin/env node

/**
 * Unit Tests for Setup Linter Hook Script
 * 
 * Tests the legacy hook installation and setup functionality
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('os');

// Mock process.exit to prevent Jest from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Import the setup script functions
const setupScript = require('./setup-linter-hook.js');

describe('Setup Linter Hook Script', () => {
  let mockFs, mockPath, mockOs;
  let consoleSpy, consoleErrorSpy;

  beforeAll(() => {
    mockFs = fs;
    mockPath = path;
    mockOs = os;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.exit mock
    mockExit.mockClear();
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock path methods
    mockPath.resolve.mockImplementation((...args) => '/' + args.join('/'));
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockImplementation((p) => p ? p.split('/').slice(0, -1).join('/') : '');

    // Mock os methods
    mockOs.homedir.mockReturnValue('/Users/testuser');

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('Constants and Configuration', () => {
    test('should have functions available for testing', () => {
      expect(typeof setupScript.ensureSettingsDirectory).toBe('function');
      expect(typeof setupScript.loadSettings).toBe('function');
      expect(typeof setupScript.setupHook).toBe('function');
      expect(typeof setupScript.showCurrentConfig).toBe('function');
    });
  });

  describe('ensureSettingsDirectory', () => {
    test('should create settings directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockPath.dirname.mockReturnValue('/Users/testuser/.claude');
      
      setupScript.ensureSettingsDirectory();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        '/Users/testuser/.claude',
        { recursive: true }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created settings directory')
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
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    test('should return empty object when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const settings = setupScript.loadSettings();
      
      expect(settings).toEqual({});
    });

    test('should exit process when file is corrupted', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      setupScript.loadSettings();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error parsing existing settings.json:',
        expect.any(String)
      );
    });

    test('should handle read errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      setupScript.loadSettings();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('setupHook', () => {
    test('should install hook successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.setupHook();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hook configured successfully')
      );
    });

    test('should exit when hook script does not exist', () => {
      // First call returns false for the hook script check
      mockFs.existsSync.mockReturnValueOnce(false);
      
      setupScript.setupHook();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hook script not found')
      );
    });

    test('should update existing hook configuration', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [{
            hooks: [{
              command: '/path/to/post-tool-linter-hook.js'
            }]
          }]
        }
      }));
      
      setupScript.setupHook();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already configured')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating configuration')
      );
    });

    test('should handle write errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      setupScript.setupHook();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error saving settings:',
        expect.any(String)
      );
    });

    test('should create proper hook configuration structure', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.setupHook();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      
      expect(savedSettings.hooks).toBeDefined();
      expect(savedSettings.hooks.PostToolUse).toBeDefined();
      expect(savedSettings.hooks.PostToolUse[0]).toMatchObject({
        matcher: 'Edit|Write|MultiEdit',
        hooks: [{
          type: 'command',
          timeout: 15000
        }]
      });
    });

    test('should initialize hooks structure if missing', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.setupHook();
      
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      
      expect(savedSettings.hooks).toBeDefined();
      expect(savedSettings.hooks.PostToolUse).toBeInstanceOf(Array);
    });
  });

  describe('showCurrentConfig', () => {
    test('should display current linter hook configuration', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [{
            hooks: [{
              command: '/path/to/post-tool-linter-hook.js'
            }]
          }]
        }
      }));
      
      setupScript.showCurrentConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current Linter Hook Configuration')
      );
    });

    test('should show message when no linter hook configured', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [{
            hooks: [{
              command: '/other/hook.js'
            }]
          }]
        }
      }));
      
      setupScript.showCurrentConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No linter hook currently configured')
      );
    });

    test('should show message when no hooks configured', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      setupScript.showCurrentConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No hooks configured')
      );
    });

    test('should handle missing PostToolUse section', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {}
      }));
      
      setupScript.showCurrentConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No hooks configured')
      );
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle file system errors during setup', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      expect(() => setupScript.setupHook()).toThrow('File system error');
    });

    test('should handle complex existing hook structures', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Other',
              hooks: [{ command: 'other.js' }]
            },
            {
              matcher: 'Edit|Write',
              hooks: [{ command: '/path/to/post-tool-linter-hook.js' }]
            }
          ]
        }
      }));
      
      setupScript.setupHook();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already configured')
      );
    });

    test('should preserve other hooks when updating', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Other',
              hooks: [{ command: 'other.js' }]
            },
            {
              matcher: 'Edit|Write',
              hooks: [{ command: '/path/to/post-tool-linter-hook.js' }]
            }
          ]
        }
      }));
      
      setupScript.setupHook();
      
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedSettings = JSON.parse(writeCall[1]);
      
      // Should have the other hook plus the new one
      expect(savedSettings.hooks.PostToolUse).toHaveLength(2);
      expect(savedSettings.hooks.PostToolUse[0].matcher).toBe('Other');
    });
  });
});