#!/usr/bin/env node

/**
 * Comprehensive Test Suite for getAllFiles Function
 * 
 * Tests covering recursion limits, symlinks, error conditions, 
 * and edge cases for the HookPackager.getAllFiles() method.
 */

const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('path');

// Import the package hook system
const { HookPackager } = require('./package-hook.js');

describe('HookPackager.getAllFiles() - Comprehensive Test Suite', () => {
  let packager;
  let mockFs, mockPath;
  let consoleSpy;

  beforeAll(() => {
    mockFs = fs;
    mockPath = path;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic path mocking BEFORE creating packager
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => '/' + args.join('/'));
    mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    
    // Setup basic fs mocking
    mockFs.existsSync.mockReturnValue(true);
    mockFs.realpathSync.mockImplementation((p) => p); // Return the same path
    mockFs.accessSync.mockImplementation(() => {}); // No error = accessible
    mockFs.constants = { R_OK: 4 };
    mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
    
    // Create packager instance with verbose logging for tests AFTER mocking
    packager = new HookPackager({ verbose: true });
    
    // Spy on console.log to capture log messages
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Input Validation', () => {
    test('should return empty array for null directory', () => {
      const result = packager.getAllFiles(null);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid directory path provided: null')
      );
    });

    test('should return empty array for undefined directory', () => {
      const result = packager.getAllFiles(undefined);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid directory path provided: undefined')
      );
    });

    test('should return empty array for non-string directory', () => {
      const result = packager.getAllFiles(123);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid directory path provided: 123')
      );
    });

    test('should return empty array for empty string directory', () => {
      const result = packager.getAllFiles('');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid directory path provided:')
      );
    });

    test('should process valid string directory path', () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = packager.getAllFiles('/valid/path');
      
      expect(result).toEqual([]);
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/valid/path', { withFileTypes: true });
    });
  });

  describe('Directory Existence Checking', () => {
    test('should return empty array for non-existent directory', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = packager.getAllFiles('/nonexistent');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Directory does not exist: /nonexistent')
      );
    });

    test('should handle existsSync errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = packager.getAllFiles('/protected');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error checking directory existence: /protected - Permission denied')
      );
    });
  });

  describe('Recursion Depth Limiting', () => {
    test('should respect default maxDepth of 10', () => {
      const result = packager.getAllFiles('/deep/path', 10);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Maximum recursion depth (10) reached for directory: /deep/path')
      );
    });

    test('should respect custom maxDepth parameter', () => {
      const result = packager.getAllFiles('/deep/path', 5, 5);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Maximum recursion depth (5) reached for directory: /deep/path')
      );
    });

    test('should process directories within depth limit', () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = packager.getAllFiles('/shallow/path', 2, 5);
      
      expect(result).toEqual([]);
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/shallow/path', { withFileTypes: true });
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Maximum recursion depth')
      );
    });

    test('should handle recursive directory structures correctly', () => {
      // Setup nested directory structure
      mockFs.readdirSync.mockImplementation((dir) => {
        if (dir === '/root') {
          return [
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
            { name: 'subdir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
          ];
        } else if (dir === '/root/subdir') {
          return [
            { name: 'file2.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
          ];
        }
        return [];
      });

      const result = packager.getAllFiles('/root', 0, 5);
      
      expect(result).toContain('/root/file1.txt');
      expect(result).toContain('/root/subdir/file2.txt');
      expect(result).toHaveLength(2);
    });
  });

  describe('Real Path Resolution', () => {
    test('should handle realpathSync errors gracefully', () => {
      mockFs.realpathSync.mockImplementation(() => {
        const error = new Error('Broken symlink');
        error.code = 'ENOENT';
        throw error;
      });
      
      const result = packager.getAllFiles('/broken/symlink');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Cannot resolve real path for: /broken/symlink - File or directory not found')
      );
    });

    test('should resolve real paths successfully', () => {
      mockFs.realpathSync.mockReturnValue('/real/path');
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = packager.getAllFiles('/symlink/path');
      
      expect(mockFs.realpathSync).toHaveBeenCalledWith('/symlink/path');
      expect(result).toEqual([]);
    });
  });

  describe('Circular Symlink Detection', () => {
    test('should detect and skip circular symlinks', () => {
      const visitedPaths = new Set(['/real/path']);
      mockFs.realpathSync.mockReturnValue('/real/path');
      
      const result = packager.getAllFiles('/circular/link', 0, 10, visitedPaths);
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Circular symlink detected, skipping: /circular/link → /real/path')
      );
    });

    test('should allow processing non-circular symlinks', () => {
      const visitedPaths = new Set();
      mockFs.realpathSync.mockReturnValue('/unique/path');
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = packager.getAllFiles('/valid/symlink', 0, 10, visitedPaths);
      
      expect(result).toEqual([]);
      expect(visitedPaths.has('/unique/path')).toBe(false); // Should be cleaned up
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Circular symlink detected')
      );
    });

    test('should properly manage visitedPaths Set during recursion', () => {
      const visitedPaths = new Set();
      mockFs.realpathSync.mockImplementation((path) => `/real${path}`);
      mockFs.readdirSync.mockImplementation((dir) => {
        if (dir === '/test') {
          return [
            { name: 'subdir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
          ];
        }
        return [];
      });
      
      packager.getAllFiles('/test', 0, 5, visitedPaths);
      
      // After processing, the Set should be clean (paths removed during backtracking)
      expect(visitedPaths.size).toBe(0);
    });
  });

  describe('Directory Reading Error Handling', () => {
    test('should handle permission denied errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        throw error;
      });
      
      const result = packager.getAllFiles('/protected/dir');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔒 Permission denied accessing directory: /protected/dir')
      );
    });

    test('should handle file not found errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('No such file or directory');
        error.code = 'ENOENT';
        throw error;
      });
      
      const result = packager.getAllFiles('/missing/dir');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📁 Directory not found: /missing/dir')
      );
    });

    test('should handle system resource limit errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('Too many open files');
        error.code = 'EMFILE';
        throw error;
      });
      
      const result = packager.getAllFiles('/resource/limited');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ System resource limit reached while reading: /resource/limited')
      );
    });

    test('should handle I/O errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('Input/output error');
        error.code = 'EIO';
        throw error;
      });
      
      const result = packager.getAllFiles('/io/error');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💿 I/O error reading directory: /io/error')
      );
    });

    test('should handle not-a-directory errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('Not a directory');
        error.code = 'ENOTDIR';
        throw error;
      });
      
      const result = packager.getAllFiles('/file/not/dir');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Expected directory but found file: /file/not/dir')
      );
    });

    test('should handle unknown errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        const error = new Error('Unknown filesystem error');
        error.code = 'EUNKNOWN';
        throw error;
      });
      
      const result = packager.getAllFiles('/unknown/error');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error reading directory: /unknown/error')
      );
    });
  });

  describe('File System Entry Validation', () => {
    test('should skip entries with invalid names', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'valid.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/valid.txt');
      expect(result).not.toContain('/test/');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Skipping entry with invalid name')
      );
    });

    test('should skip entries with null characters', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'bad\0file.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'good.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/good.txt');
      expect(result).not.toContain('/test/bad\0file.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Skipping entry with null character')
      );
    });

    test('should properly handle current and parent directory references', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: '.', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        { name: '..', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        { name: '.hidden', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'normal.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/.hidden');
      expect(result).toContain('/test/normal.txt');
      expect(result).not.toContain('/test/.');
      expect(result).not.toContain('/test/..');
    });
  });

  describe('File Accessibility Checking', () => {
    test('should include accessible files', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'accessible.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      mockFs.accessSync.mockImplementation(() => {}); // No error = accessible
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/accessible.txt');
    });

    test('should skip inaccessible files', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'inaccessible.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'accessible.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      mockFs.accessSync.mockImplementation((path) => {
        if (path.includes('inaccessible')) {
          const error = new Error('Permission denied');
          error.code = 'EACCES';
          throw error;
        }
        // No error for accessible files
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/accessible.txt');
      expect(result).not.toContain('/test/inaccessible.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ File not accessible: /test/inaccessible.txt')
      );
    });
  });

  describe('Symbolic Link Handling', () => {
    test('should handle valid symbolic links to files', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'symlink.txt', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true }
      ]);
      mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
      mockFs.readlinkSync.mockReturnValue('../target.txt');
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      mockFs.accessSync.mockImplementation(() => {}); // Accessible
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/symlink.txt');
    });

    test('should handle broken symbolic links', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'broken.txt', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true }
      ]);
      mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
      mockFs.readlinkSync.mockReturnValue('../missing.txt');
      mockFs.statSync.mockImplementation(() => {
        const error = new Error('No such file or directory');
        error.code = 'ENOENT';
        throw error;
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).not.toContain('/test/broken.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Symbolic link target not accessible: /test/broken.txt → ../missing.txt')
      );
    });

    test('should handle readlink errors', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'unreadable.txt', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true }
      ]);
      mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
      mockFs.readlinkSync.mockImplementation(() => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        throw error;
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).not.toContain('/test/unreadable.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Cannot read symbolic link: /test/unreadable.txt')
      );
    });

    test('should handle lstat errors on symbolic links', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'badlink.txt', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true }
      ]);
      mockFs.lstatSync.mockImplementation(() => {
        const error = new Error('No such file or directory');
        error.code = 'ENOENT';
        throw error;
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).not.toContain('/test/badlink.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Cannot stat symbolic link: /test/badlink.txt')
      );
    });
  });

  describe('Error Recovery and Isolation', () => {
    test('should continue processing after individual entry errors', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'error.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'good.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      mockFs.accessSync.mockImplementation((path) => {
        if (path.includes('error.txt')) {
          throw new Error('Access denied');
        }
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/good.txt');
      expect(result).not.toContain('/test/error.txt');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ File not accessible: /test/error.txt')
      );
    });

    test('should continue processing after subdirectory errors', () => {
      mockFs.readdirSync.mockImplementation((dir) => {
        if (dir === '/test') {
          return [
            { name: 'errordir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
            { name: 'gooddir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
          ];
        } else if (dir === '/test/errordir') {
          throw new Error('Permission denied');
        } else if (dir === '/test/gooddir') {
          return [
            { name: 'file.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
          ];
        }
        return [];
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toContain('/test/gooddir/file.txt');
    });

    test('should handle unexpected processing errors gracefully', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'problematic.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
      ]);
      
      // Mock accessSync to throw an unexpected error after join
      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Unexpected access error');
      });
      
      const result = packager.getAllFiles('/test');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ File not accessible: /test/problematic.txt - Unknown error: Unexpected access error')
      );
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    beforeEach(() => {
      // Restore clean mocking for each test
      mockPath.join.mockImplementation((...args) => args.join('/'));
    });

    test('should handle empty directories', () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = packager.getAllFiles('/empty');
      
      expect(result).toEqual([]);
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/empty', { withFileTypes: true });
    });

    test('should handle directories with only subdirectories', () => {
      mockFs.readdirSync.mockImplementation((dir) => {
        if (dir === '/parent') {
          return [
            { name: 'subdir1', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
            { name: 'subdir2', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
          ];
        } else {
          return []; // Empty subdirectories
        }
      });
      
      const result = packager.getAllFiles('/parent');
      
      expect(result).toEqual([]);
    });

    test('should handle mixed content types correctly', () => {
      mockFs.readdirSync.mockReturnValue([
        { name: 'regular.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: 'subdir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        { name: 'symlink.txt', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true },
        { name: 'socket', isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false } // Special file type
      ]);
      
      // Mock symlink handling
      mockFs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
      mockFs.readlinkSync.mockReturnValue('../target.txt');
      mockFs.statSync.mockReturnValue({ isFile: () => true });
      
      const result = packager.getAllFiles('/mixed');
      
      expect(result).toContain('/mixed/regular.txt');
      expect(result).toContain('/mixed/symlink.txt');
      // Should not contain special files like sockets
      expect(result).not.toContain('/mixed/socket');
    });

    test('should properly clean up visitedPaths even when errors occur', () => {
      const visitedPaths = new Set();
      mockFs.realpathSync.mockReturnValue('/real/path');
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      
      packager.getAllFiles('/test', 0, 10, visitedPaths);
      
      // Path should be cleaned up even after error
      expect(visitedPaths.has('/real/path')).toBe(false);
    });

    test('should handle large directory structures within depth limits', () => {
      // Create a structure that would hit depth limits
      let callCount = 0;
      mockFs.readdirSync.mockImplementation((dir) => {
        callCount++;
        const depth = dir.split('/').length - 2; // Approximate depth calculation
        
        if (depth < 3) {
          return [
            { name: `file${depth}.txt`, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
            { name: `subdir${depth}`, isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false }
          ];
        }
        return []; // Stop recursion
      });
      
      const result = packager.getAllFiles('/deep', 0, 5);
      
      expect(result.length).toBeGreaterThan(0);
      expect(callCount).toBeGreaterThan(1);
      // Should contain files from different levels
      expect(result.some(file => file.includes('file0.txt'))).toBe(true);
    });
  });

  describe('Error Categorization Helper', () => {
    beforeEach(() => {
      // Restore clean mocking for each test
      mockPath.join.mockImplementation((...args) => args.join('/'));
    });

    test('should categorize common filesystem errors correctly', () => {
      const testCases = [
        { code: 'ENOENT', expected: 'File or directory not found' },
        { code: 'EACCES', expected: 'Permission denied - insufficient access rights' },
        { code: 'EPERM', expected: 'Operation not permitted - administrative privileges required' },
        { code: 'EMFILE', expected: 'Too many open files - system limit reached' },
        { code: 'ENFILE', expected: 'File table overflow - system-wide limit exceeded' },
        { code: 'ENOTDIR', expected: 'Not a directory - path component is not a directory' },
        { code: 'EISDIR', expected: 'Is a directory - expected file but found directory' },
        { code: 'ELOOP', expected: 'Too many symbolic links - possible circular reference' },
        { code: 'ENAMETOOLONG', expected: 'Filename too long - exceeds system limits' },
        { code: 'ENOSPC', expected: 'No space left on device' },
        { code: 'EIO', expected: 'Input/output error - hardware or network issue' },
        { code: 'EROFS', expected: 'Read-only file system' },
        { code: 'EBUSY', expected: 'Resource busy - file is in use' },
        { code: 'EEXIST', expected: 'File already exists' },
        { code: 'EXDEV', expected: 'Cross-device link - operation spans different filesystems' }
      ];

      testCases.forEach(({ code, expected }) => {
        const error = new Error('Test error');
        error.code = code;
        
        const result = packager.categorizeFileSystemError(error);
        
        expect(result).toBe(expected);
      });
    });

    test('should handle unknown error codes', () => {
      const error = new Error('Unknown error message');
      error.code = 'EUNKNOWN';
      
      const result = packager.categorizeFileSystemError(error);
      
      expect(result).toBe('EUNKNOWN: Unknown error message');
    });

    test('should handle errors without codes', () => {
      const error = new Error('Error without code');
      
      const result = packager.categorizeFileSystemError(error);
      
      expect(result).toBe('Unknown error: Error without code');
    });
  });
});