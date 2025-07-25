#!/usr/bin/env node

/**
 * Unit Tests for Package Hook Distribution System
 * 
 * Tests the HookPackager class and related functionality for
 * creating distribution packages of the linter hook system.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('crypto');
jest.mock('child_process');

// Import the package hook system
const { HookPackager, CONFIG } = require('./package-hook.js');

describe('Package Hook Distribution System', () => {
  let mockFs, mockPath, mockCrypto, mockExecSync;

  beforeAll(() => {
    mockFs = fs;
    mockPath = path;
    mockCrypto = crypto;
    mockExecSync = execSync;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path methods
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => '/' + args.join('/'));
    mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    mockPath.basename.mockImplementation((p) => p.split('/').pop());
    mockPath.extname.mockImplementation((p) => {
      const parts = p.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.copyFileSync.mockImplementation(() => {});
    mockFs.rmSync.mockImplementation(() => {});
    mockFs.statSync.mockReturnValue({ 
      isDirectory: () => false, 
      isFile: () => true, 
      size: 1024, 
      mtime: new Date('2024-01-01T00:00:00.000Z') 
    });
    
    // Mock fs.readdirSync to return Dirent-like objects when withFileTypes: true
    // Prevent infinite recursion by returning different results based on directory depth
    mockFs.readdirSync.mockImplementation((dir, options) => {
      if (options && options.withFileTypes) {
        // Return empty results for nested directories to prevent infinite recursion
        if (dir && (dir.includes('subdir') || dir.includes('nested') || dir.split('/').length > 3)) {
          return [];
        }
        return [
          { name: 'file1.js', isDirectory: () => false, isFile: () => true },
          { name: 'file2.js', isDirectory: () => false, isFile: () => true },
          { name: 'subdir', isDirectory: () => true, isFile: () => false }
        ];
      }
      // Same logic for string array format
      if (dir && (dir.includes('subdir') || dir.includes('nested') || dir.split('/').length > 3)) {
        return [];
      }
      return ['file1.js', 'file2.js', 'subdir'];
    });

    // Mock crypto
    mockCrypto.createHash.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mockedhash123')
    });

    // Mock execSync
    mockExecSync.mockReturnValue('command executed');
  });

  describe('CONFIG', () => {
    test('should have valid configuration structure', () => {
      expect(CONFIG).toBeDefined();
      expect(CONFIG.packageName).toBeDefined();
      expect(CONFIG.defaultVersion).toBeDefined();
      expect(CONFIG.requiredFiles).toBeInstanceOf(Array);
      expect(CONFIG.optionalFiles).toBeInstanceOf(Array);
      expect(CONFIG.supportedFormats).toBeInstanceOf(Array);
    });

    test('should include required files', () => {
      expect(CONFIG.requiredFiles).toContain('post-tool-linter-hook.js');
      expect(CONFIG.requiredFiles).toContain('package.json');
    });

    test('should support multiple formats', () => {
      expect(CONFIG.supportedFormats).toContain('zip');
      expect(CONFIG.supportedFormats).toContain('tar.gz');
      expect(CONFIG.supportedFormats).toContain('folder');
    });
  });

  describe('HookPackager Constructor', () => {
    test('should initialize with default options', () => {
      const packager = new HookPackager();
      
      expect(packager.options).toBeDefined();
      expect(packager.options.format).toBe('zip');
      expect(packager.options.clean).toBe(false);
      expect(packager.options.validate).toBe(true);
    });

    test('should accept custom options', () => {
      const options = {
        output: './custom-output',
        version: '2.0.0',
        format: 'tar.gz',
        clean: true,
        verbose: true
      };
      
      const packager = new HookPackager(options);
      
      expect(packager.options.output).toBe('./custom-output');
      expect(packager.options.version).toBe('2.0.0');
      expect(packager.options.format).toBe('tar.gz');
      expect(packager.options.clean).toBe(true);
      expect(packager.options.verbose).toBe(true);
    });

    test('should set package directory correctly', () => {
      const packager = new HookPackager({ version: '1.5.0' });
      
      expect(packager.packageDir).toContain('claude-code-linter-hook-v1.5.0');
    });
  });

  describe('detectVersion', () => {
    test('should read version from package.json', () => {
      mockFs.readFileSync.mockReturnValue('{"version": "1.2.3"}');
      
      const packager = new HookPackager();
      const version = packager.detectVersion();
      
      expect(version).toBe('1.2.3');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('package.json', 'utf8');
    });

    test('should use default version when package.json is invalid', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const packager = new HookPackager();
      const version = packager.detectVersion();
      
      expect(version).toBe(CONFIG.defaultVersion);
    });

    test('should use default version when package.json has no version', () => {
      mockFs.readFileSync.mockReturnValue('{}');
      
      const packager = new HookPackager();
      const version = packager.detectVersion();
      
      expect(version).toBe(CONFIG.defaultVersion);
    });
  });

  describe('prepareOutputDirectory', () => {
    test('should create output directory if not exists', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const packager = new HookPackager();
      await packager.prepareOutputDirectory();
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    test('should clean existing directory when clean option is true', async () => {
      const packager = new HookPackager({ clean: true });
      
      await packager.prepareOutputDirectory();
      
      expect(mockFs.rmSync).toHaveBeenCalled();
    });

    test('should not clean when clean option is false', async () => {
      const packager = new HookPackager({ clean: false });
      
      await packager.prepareOutputDirectory();
      
      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('copyRequiredFiles', () => {
    test('should copy all existing required files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const packager = new HookPackager();
      await packager.copyRequiredFiles();
      
      expect(mockFs.copyFileSync).toHaveBeenCalledTimes(CONFIG.requiredFiles.length);
    });

    test('should log warning for missing required files', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const packager = new HookPackager({ verbose: true });
      await packager.copyRequiredFiles();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('copyOptionalFiles', () => {
    test('should copy existing optional files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ 
        isDirectory: () => false, 
        isFile: () => true, 
        size: 1024, 
        mtime: new Date('2024-01-01T00:00:00.000Z') 
      });
      
      const packager = new HookPackager();
      await packager.copyOptionalFiles();
      
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    test('should copy directories recursively', async () => {
      // Mock that 'docs/' optional directory exists and is a directory
      mockFs.existsSync.mockImplementation((filePath) => {
        // Source 'docs/' directory exists
        if (filePath === 'docs/') return true;
        // Destination directories in package dir don't exist (so mkdirSync will be called)
        if (filePath.includes('claude-code-linter-hook')) return false;
        return false;
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => true, isFile: () => false });
      
      // Mock readdirSync to prevent infinite recursion by returning different results based on path depth
      mockFs.readdirSync.mockImplementation((dir, options) => {
        if (options && options.withFileTypes) {
          // Return empty array for nested directories to prevent infinite recursion
          if (dir.includes('nested-dir') || dir.includes('subdir')) {
            return [
              { name: 'deep-file.js', isDirectory: () => false, isFile: () => true }
            ];
          }
          // First level directory
          return [
            { name: 'subfile.js', isDirectory: () => false, isFile: () => true },
            { name: 'nested-dir', isDirectory: () => true, isFile: () => false }
          ];
        }
        return dir.includes('nested') ? ['deep-file.js'] : ['subfile.js', 'nested-dir'];
      });
      
      const packager = new HookPackager();
      await packager.copyOptionalFiles();
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    test('should skip non-existent optional files', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const packager = new HookPackager();
      await packager.copyOptionalFiles();
      
      // Should not throw and should not copy
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('generateInstallationScripts', () => {
    test('should create installation scripts for all platforms', async () => {
      const packager = new HookPackager();
      await packager.generateInstallationScripts();
      
      // Should write multiple installation scripts
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(3); // Unix, Windows, Node.js
    });

    test('should create executable scripts', async () => {
      const packager = new HookPackager();
      await packager.generateInstallationScripts();
      
      // Check that scripts contain executable content
      const calls = mockFs.writeFileSync.mock.calls;
      expect(calls.some(call => call[1].includes('#!/bin/bash'))).toBe(true);
    });
  });

  describe('createPackageMetadata', () => {
    test('should generate package metadata', async () => {
      const packager = new HookPackager();
      await packager.createPackageMetadata();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // Check that metadata contains expected information
      const metadataCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].includes('package-info.json')
      );
      expect(metadataCall).toBeDefined();
    });

    test('should include version and timestamp in metadata', async () => {
      const packager = new HookPackager({ version: '2.0.0' });
      await packager.createPackageMetadata();
      
      const metadataCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].includes('package-info.json')
      );
      expect(metadataCall[1]).toContain('2.0.0');
    });
  });

  describe('createArchive', () => {
    test('should create ZIP archive when format is zip', async () => {
      const packager = new HookPackager({ format: 'zip' });
      await packager.createArchive();
      
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('zip'),
        expect.any(Object)
      );
    });

    test('should create tar.gz archive when format is tar.gz', async () => {
      const packager = new HookPackager({ format: 'tar.gz' });
      await packager.createArchive();
      
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tar'),
        expect.any(Object)
      );
    });

    test('should skip archiving when format is folder', async () => {
      const packager = new HookPackager({ format: 'folder' });
      await packager.createArchive();
      
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('should handle archive creation errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Archive creation failed');
      });
      
      const packager = new HookPackager({ format: 'zip' });
      
      await expect(packager.createArchive()).rejects.toThrow('Archive creation failed');
    });
  });

  describe('validatePackage', () => {
    test('should validate all required files exist', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const packager = new HookPackager();
      await packager.validatePackage();
      
      // Should check existence of all required files
      expect(mockFs.existsSync).toHaveBeenCalledTimes(
        CONFIG.requiredFiles.length + 3 + 3 // +3 for installers, +3 for metadata files
      );
    });

    test('should throw error for missing required files', async () => {
      mockFs.existsSync.mockImplementation((filePath) => 
        !filePath.includes('post-tool-linter-hook.js')
      );
      
      const packager = new HookPackager();
      
      await expect(packager.validatePackage()).rejects.toThrow('Package validation failed with');
    });

    test('should skip validation when validate option is false', async () => {
      const packager = new HookPackager({ validate: false });
      
      // Should not throw even if files are missing
      await expect(packager.validatePackage()).resolves.toBeUndefined();
    });
  });

  describe('generateChecksums', () => {
    test('should generate checksums for all files', async () => {
      mockFs.readdirSync.mockImplementation((dir, options) => {
        if (options && options.withFileTypes) {
          return [
            { name: 'file1.js', isDirectory: () => false, isFile: () => true },
            { name: 'file2.js', isDirectory: () => false, isFile: () => true }
          ];
        }
        return ['file1.js', 'file2.js'];
      });
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      mockFs.readFileSync.mockReturnValue('file content');
      
      const packager = new HookPackager();
      await packager.generateChecksums();
      
      // Should create hash objects for each file
      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('CHECKSUMS.json'),
        expect.any(String)
      );
    });

    test('should handle checksum generation errors', async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read failed');
      });
      
      const packager = new HookPackager();
      
      // Should handle errors gracefully
      await expect(packager.generateChecksums()).resolves.toBeUndefined();
    });
  });

  describe('createPackage integration', () => {
    test('should complete full packaging workflow', async () => {
      // Mock Date.now to simulate time passing
      const mockNow = jest.spyOn(Date, 'now');
      let currentTime = 1000;
      mockNow.mockImplementation(() => currentTime++);
      
      const packager = new HookPackager();
      
      const result = await packager.createPackage();
      
      expect(result).toBeDefined();
      expect(result.packagePath).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      
      mockNow.mockRestore();
    });

    test('should handle workflow errors gracefully', async () => {
      // Make sure existsSync returns false so mkdirSync will be called
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Directory creation failed');
      });
      
      const packager = new HookPackager();
      
      await expect(packager.createPackage()).rejects.toThrow('Directory creation failed');
    });
  });

  describe('logging and utilities', () => {
    test('should log messages when verbose is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const packager = new HookPackager({ verbose: true });
      packager.log('Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      consoleSpy.mockRestore();
    });

    test('should not log messages when verbose is disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const packager = new HookPackager({ verbose: false });
      packager.log('Test message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});