#!/usr/bin/env node

/**
 * Claude Code Post-Tool Linter Hook Distribution Packager
 * 
 * Creates a distributable package containing all necessary files for the
 * post-tool linter hook system. This includes the hook script, setup utilities,
 * documentation, and examples for easy installation on new systems.
 * 
 * Features:
 * - Packages all required files into a single distributable archive
 * - Creates platform-specific installation scripts
 * - Includes comprehensive documentation and examples
 * - Supports version management and automated updates
 * - Validates package completeness before distribution
 * 
 * Usage:
 *   node package-hook.js [options]
 * 
 * Options:
 *   --output <dir>    Output directory for package (default: ./dist)
 *   --version <ver>   Package version (default: auto-detect from package.json)
 *   --format <fmt>    Package format: zip, tar.gz, or folder (default: zip)
 *   --clean           Clean output directory before packaging
 *   --validate        Validate package after creation
 *   --help            Show this help message
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  packageName: 'claude-code-linter-hook',
  defaultVersion: '1.0.0',
  defaultOutput: './dist',
  requiredFiles: [
    'post-tool-linter-hook.js',
    'setup-linter-hook.js', 
    'setup-post-tool-hook.js',
    'README.md',
    'package.json'
  ],
  optionalFiles: [
    'docs/',
    'development/modes/',
    'test-linter-hook.js',
    'eslint.config.js'
  ],
  platforms: ['windows', 'macos', 'linux'],
  supportedFormats: ['zip', 'tar.gz', 'folder']
};

class HookPackager {
  constructor(options = {}) {
    // Set up basic options first
    this.options = {
      output: options.output || CONFIG.defaultOutput,
      format: options.format || 'zip',
      clean: options.clean || false,
      validate: options.validate !== undefined ? options.validate : true,
      verbose: options.verbose === true // Only true if explicitly set to true
    };
        
    // Now we can safely call detectVersion which may use this.log
    this.options.version = options.version || this.detectVersion();
        
    this.packageDir = path.join(this.options.output, `${CONFIG.packageName}-v${this.options.version}`);
    this.startTime = Date.now();
        
    if (this.options.verbose) {
      this.log('Initializing Claude Code Linter Hook Packager');
      this.log(`Version: ${this.options.version}`);
      this.log(`Output: ${this.options.output}`);
      this.log(`Format: ${this.options.format}`);
    }
  }
    
  /**
     * Detect version from package.json or use default
     */
  detectVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version || CONFIG.defaultVersion;
    } catch {
      this.log(`Warning: Could not read package.json, using default version ${CONFIG.defaultVersion}`);
      return CONFIG.defaultVersion;
    }
  }
    
  /**
     * Main packaging workflow
     */
  async createPackage() {
    try {
      this.log('\n=== Starting Package Creation ===');
            
      // Step 1: Prepare output directory
      await this.prepareOutputDirectory();
            
      // Step 2: Copy required files
      await this.copyRequiredFiles();
            
      // Step 3: Copy optional files
      await this.copyOptionalFiles();
            
      // Step 4: Generate installation scripts
      await this.generateInstallationScripts();
            
      // Step 5: Create package metadata
      await this.createPackageMetadata();
            
      // Step 6: Generate documentation
      await this.generatePackageDocumentation();
            
      // Step 7: Create archive (if requested)
      if (this.options.format !== 'folder') {
        await this.createArchive();
      }
            
      // Step 8: Validate package
      if (this.options.validate) {
        await this.validatePackage();
      }
            
      // Step 9: Generate checksums
      await this.generateChecksums();
            
      const duration = (Date.now() - this.startTime) / 1000;
      this.log(`\n✅ Package created successfully in ${duration}s`);
      this.log(`📦 Package location: ${this.packageDir}`);
            
      return {
        success: true,
        packagePath: this.packageDir,
        version: this.options.version,
        duration: duration
      };
            
    } catch (error) {
      this.log(`\n❌ Package creation failed: ${error.message}`);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      throw error;
    }
  }
    
  /**
     * Prepare the output directory structure
     */
  async prepareOutputDirectory() {
    this.log('\n📁 Preparing output directory...');
        
    if (this.options.clean && fs.existsSync(this.options.output)) {
      this.log('Cleaning existing output directory');
      fs.rmSync(this.options.output, { recursive: true, force: true });
    }
        
    // Create directory structure
    const dirs = [
      this.packageDir,
      path.join(this.packageDir, 'bin'),
      path.join(this.packageDir, 'docs'),
      path.join(this.packageDir, 'examples'),
      path.join(this.packageDir, 'scripts')
    ];
        
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${path.relative(process.cwd(), dir)}`);
      }
    });
  }
    
  /**
     * Copy all required files to package directory
     */
  async copyRequiredFiles() {
    this.log('\n📋 Copying required files...');
        
    for (const file of CONFIG.requiredFiles) {
      if (fs.existsSync(file)) {
        const destPath = path.join(this.packageDir, 'bin', path.basename(file));
        fs.copyFileSync(file, destPath);
        this.log(`✓ Copied: ${file} → ${path.relative(process.cwd(), destPath)}`);
      } else {
        this.log(`⚠️  Missing required file: ${file}`);
      }
    }
  }
    
  /**
     * Copy optional files and directories
     */
  async copyOptionalFiles() {
    this.log('\n📄 Copying optional files...');
        
    for (const item of CONFIG.optionalFiles) {
      if (fs.existsSync(item)) {
        const stats = fs.statSync(item);
                
        if (stats.isDirectory()) {
          const destDir = path.join(this.packageDir, 'docs', path.basename(item));
          this.copyDirectory(item, destDir);
          this.log(`✓ Copied directory: ${item} → ${path.relative(process.cwd(), destDir)}`);
        } else {
          const destPath = path.join(this.packageDir, 'examples', path.basename(item));
          fs.copyFileSync(item, destPath);
          this.log(`✓ Copied file: ${item} → ${path.relative(process.cwd(), destPath)}`);
        }
      } else {
        this.log(`ℹ️  Optional file not found: ${item}`);
      }
    }
  }
    
  /**
     * Generate platform-specific installation scripts
     */
  async generateInstallationScripts() {
    this.log('\n🛠️  Generating installation scripts...');
        
    // Unix/Linux/macOS installer
    const unixInstaller = this.generateUnixInstaller();
    fs.writeFileSync(path.join(this.packageDir, 'install.sh'), unixInstaller);
    fs.chmodSync(path.join(this.packageDir, 'install.sh'), 0o755);
    this.log('✓ Created: install.sh');
        
    // Windows installer
    const windowsInstaller = this.generateWindowsInstaller();
    fs.writeFileSync(path.join(this.packageDir, 'install.bat'), windowsInstaller);
    this.log('✓ Created: install.bat');
        
    // Node.js cross-platform installer
    const nodeInstaller = this.generateNodeInstaller();
    fs.writeFileSync(path.join(this.packageDir, 'install.js'), nodeInstaller);
    this.log('✓ Created: install.js');
  }
    
  /**
     * Create package metadata and manifest
     */
  async createPackageMetadata() {
    this.log('\n📝 Creating package metadata...');
        
    const metadata = {
      name: CONFIG.packageName,
      version: this.options.version,
      description: 'Claude Code Post-Tool Linter Hook - Automatic linting after file modifications',
      created: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      files: this.getFileManifest(),
      installation: {
        requirements: [
          'Claude Code installed and configured',
          'Node.js (for running the hook)',
          'Python with ruff (for Python linting)',
          'ESLint (for JavaScript/TypeScript linting)'
        ],
        quickStart: [
          '1. Extract package to desired location',
          '2. Run installation script for your platform',
          '3. Verify installation with test command',
          '4. Hook will activate automatically for file modifications'
        ]
      }
    };
        
    fs.writeFileSync(
      path.join(this.packageDir, 'package-info.json'), 
      JSON.stringify(metadata, null, 2)
    );
    this.log('✓ Created: package-info.json');
        
    // Create simple manifest for validation
    const manifest = {
      version: this.options.version,
      files: this.getFileManifest().map(f => ({ path: f.path, checksum: f.checksum }))
    };
        
    fs.writeFileSync(
      path.join(this.packageDir, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2)
    );
    this.log('✓ Created: MANIFEST.json');
  }
    
  /**
     * Generate comprehensive package documentation
     */
  async generatePackageDocumentation() {
    this.log('\n📚 Generating package documentation...');
        
    const quickStart = this.generateQuickStartGuide();
    fs.writeFileSync(path.join(this.packageDir, 'QUICKSTART.md'), quickStart);
    this.log('✓ Created: QUICKSTART.md');
        
    const changelog = this.generateChangelog();
    fs.writeFileSync(path.join(this.packageDir, 'CHANGELOG.md'), changelog);
    this.log('✓ Created: CHANGELOG.md');
        
    const license = this.generateLicense();
    fs.writeFileSync(path.join(this.packageDir, 'LICENSE'), license);
    this.log('✓ Created: LICENSE');
  }
    
  /**
     * Create archive in specified format
     */
  async createArchive() {
    this.log(`\n📦 Creating ${this.options.format} archive...`);
        
    const archiveName = `${CONFIG.packageName}-v${this.options.version}`;
    const outputPath = path.join(this.options.output, archiveName);
        
    if (this.options.format === 'zip') {
      // Create ZIP archive
      try {
        execSync(`cd "${this.options.output}" && zip -r "${archiveName}.zip" "${path.basename(this.packageDir)}"`, 
          { stdio: 'pipe' });
        this.log(`✓ Created: ${archiveName}.zip`);
      } catch {
        this.log('⚠️  ZIP creation failed, trying alternative method...');
        // Alternative ZIP creation using Node.js (if available)
        try {
          await this.createZipAlternative(`${outputPath}.zip`);
        } catch {
          throw new Error('Archive creation failed: alternative method also failed');
        }
      }
    } else if (this.options.format === 'tar.gz') {
      // Create TAR.GZ archive
      try {
        execSync(`cd "${this.options.output}" && tar -czf "${archiveName}.tar.gz" "${path.basename(this.packageDir)}"`,
          { stdio: 'pipe' });
        this.log(`✓ Created: ${archiveName}.tar.gz`);
      } catch (error) {
        throw new Error(`Archive creation failed: ${error.message}`);
      }
    }
  }
    
  /**
     * Validate the created package
     */
  async validatePackage() {
    this.log('\n🔍 Validating package...');
        
    const issues = [];
        
    // Check required files
    for (const file of CONFIG.requiredFiles) {
      const filePath = path.join(this.packageDir, 'bin', path.basename(file));
      if (!fs.existsSync(filePath)) {
        issues.push(`Missing required file: ${path.basename(file)}`);
      }
    }
        
    // Check installation scripts
    const installers = ['install.sh', 'install.bat', 'install.js'];
    for (const installer of installers) {
      const installerPath = path.join(this.packageDir, installer);
      if (!fs.existsSync(installerPath)) {
        issues.push(`Missing installer: ${installer}`);
      }
    }
        
    // Check metadata files
    const metadataFiles = ['package-info.json', 'MANIFEST.json', 'QUICKSTART.md'];
    for (const file of metadataFiles) {
      const filePath = path.join(this.packageDir, file);
      if (!fs.existsSync(filePath)) {
        issues.push(`Missing metadata file: ${file}`);
      }
    }
        
    if (issues.length > 0) {
      this.log('❌ Package validation failed:');
      issues.forEach(issue => this.log(`   • ${issue}`));
      throw new Error(`Package validation failed with ${issues.length} issues`);
    }
        
    this.log('✅ Package validation passed');
  }
    
  /**
     * Generate checksums for package verification
     */
  async generateChecksums() {
    this.log('\n🔐 Generating checksums...');
        
    try {
      const checksums = {};
      const files = this.getAllFiles(this.packageDir);
          
      for (const file of files) {
        const content = fs.readFileSync(file);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const relativePath = path.relative(this.packageDir, file);
        checksums[relativePath] = hash;
      }
          
      fs.writeFileSync(
        path.join(this.packageDir, 'CHECKSUMS.json'),
        JSON.stringify(checksums, null, 2)
      );
      this.log(`✓ Generated checksums for ${Object.keys(checksums).length} files`);
    } catch (error) {
      this.log(`⚠️ Failed to generate checksums: ${error.message}`);
      // Handle errors gracefully - don't throw, just log and continue
    }
  }
    
  // Helper methods
    
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
        
    const entries = fs.readdirSync(src, { withFileTypes: true });
        
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
            
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
    
  getFileManifest() {
    const files = this.getAllFiles(this.packageDir);
    return files.map(file => {
      const stats = fs.statSync(file);
      const content = fs.readFileSync(file);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
            
      return {
        path: path.relative(this.packageDir, file),
        size: stats.size,
        checksum: checksum,
        modified: stats.mtime.toISOString()
      };
    });
  }
    
  getAllFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
        
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
        
    return files;
  }
    
  generateUnixInstaller() {
    return `#!/bin/bash
# Claude Code Linter Hook Installer (Unix/Linux/macOS)
# Version: ${this.options.version}

set -e

echo "🚀 Installing Claude Code Linter Hook v${this.options.version}"
echo "=================================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    echo "Please install Node.js and try again"
    exit 1
fi

# Check for Claude Code
CLAUDE_DIR="$HOME/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
    echo "❌ Claude Code configuration directory not found"
    echo "Please install and configure Claude Code first"
    exit 1
fi

# Run the Node.js setup script
echo "📦 Running setup script..."
node "./bin/setup-post-tool-hook.js" --global

echo ""
echo "✅ Installation completed successfully!"
echo "The linter hook will now run automatically after file modifications."
echo ""
echo "Next steps:"
echo "1. Ensure your projects have appropriate linter configurations"
echo "2. Install ruff for Python projects: pip install ruff"
echo "3. Install ESLint for JavaScript projects: npm install -D eslint"
echo ""
echo "For help and documentation, see QUICKSTART.md"
`;
  }
    
  generateWindowsInstaller() {
    return `@echo off
REM Claude Code Linter Hook Installer (Windows)
REM Version: ${this.options.version}

echo 🚀 Installing Claude Code Linter Hook v${this.options.version}
echo ==================================================

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required but not installed
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Check for Claude Code
if not exist "%USERPROFILE%\\.claude" (
    echo ❌ Claude Code configuration directory not found
    echo Please install and configure Claude Code first
    pause
    exit /b 1
)

REM Run the Node.js setup script
echo 📦 Running setup script...
node ".\\bin\\setup-post-tool-hook.js" --global

echo.
echo ✅ Installation completed successfully!
echo The linter hook will now run automatically after file modifications.
echo.
echo Next steps:
echo 1. Ensure your projects have appropriate linter configurations
echo 2. Install ruff for Python projects: pip install ruff
echo 3. Install ESLint for JavaScript projects: npm install -D eslint
echo.
echo For help and documentation, see QUICKSTART.md
echo.
pause
`;
  }
    
  generateNodeInstaller() {
    return `#!/usr/bin/env node
/**
 * Claude Code Linter Hook Cross-Platform Installer
 * Version: ${this.options.version}
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Installing Claude Code Linter Hook v\${this.options.version}');
console.log('==================================================');

// Check Node.js version
const nodeVersion = process.version;
console.log(\`Node.js version: \${nodeVersion}\`);

// Check for Claude Code
const claudeDir = path.join(require('os').homedir(), '.claude');
if (!fs.existsSync(claudeDir)) {
    console.error('❌ Claude Code configuration directory not found');
    console.error('Please install and configure Claude Code first');
    process.exit(1);
}

// Run setup script
try {
    console.log('📦 Running setup script...');
    const setupScript = path.join(__dirname, 'bin', 'setup-post-tool-hook.js');
    execSync(\`node "\${setupScript}" --global\`, { stdio: 'inherit' });
    
    console.log('');
    console.log('✅ Installation completed successfully!');
    console.log('The linter hook will now run automatically after file modifications.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Ensure your projects have appropriate linter configurations');
    console.log('2. Install ruff for Python projects: pip install ruff');
    console.log('3. Install ESLint for JavaScript projects: npm install -D eslint');
    console.log('');
    console.log('For help and documentation, see QUICKSTART.md');
    
} catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
}
`;
  }
    
  generateQuickStartGuide() {
    return `# Claude Code Linter Hook - Quick Start Guide

Version: ${this.options.version}

## Overview

The Claude Code Linter Hook automatically runs appropriate linters (ruff for Python, ESLint for JavaScript/TypeScript) after file modifications and prompts Claude to fix any linting errors before continuing.

## Installation

### Prerequisites

1. **Claude Code** installed and configured
2. **Node.js** (for running the hook)
3. **Linters** installed in your projects:
   - Python: \`pip install ruff\`
   - JavaScript: \`npm install -D eslint\`

### Quick Installation

1. Extract this package to a directory of your choice
2. Run the appropriate installer for your platform:
   - **Unix/Linux/macOS**: \`./install.sh\`
   - **Windows**: \`install.bat\`
   - **Cross-platform**: \`node install.js\`

### Manual Installation

If the automated installers don't work, you can set up the hook manually:

1. Copy \`bin/post-tool-linter-hook.js\` to a permanent location
2. Run: \`node bin/setup-post-tool-hook.js --global\`
3. This will configure your \`~/.claude/settings.json\`

## Verification

Test the installation by creating a file with linting errors:

\`\`\`python
# test.py
import   os    # Multiple spaces - will trigger ruff
print("hello world")
\`\`\`

Then use Claude Code to edit the file. The hook should detect linting errors and prompt Claude to fix them.

## Configuration

The hook automatically detects project types by looking for configuration files:

**Python Projects**: \`pyproject.toml\`, \`setup.py\`, \`requirements.txt\`, etc.
**JavaScript Projects**: \`package.json\`, \`tsconfig.json\`, \`.eslintrc.json\`, etc.

## Troubleshooting

### Hook Not Triggering
1. Verify hook is in \`~/.claude/settings.json\`
2. Check hook script path is absolute and correct
3. Ensure script is executable (\`chmod +x\`)

### Linter Not Found
- Python: \`pip install ruff\`
- JavaScript: \`npm install -D eslint\`

### No Linting Feedback
1. Ensure project has required config files
2. Check that files being edited have appropriate extensions
3. Verify linters are installed and accessible

For detailed documentation, see the included \`docs/\` directory.

## Support

For issues and questions, refer to the main README.md or create an issue in the project repository.
`;
  }
    
  generateChangelog() {
    return `# Changelog

## [${this.options.version}] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial distribution package
- Cross-platform installation scripts
- Comprehensive documentation and examples
- Package validation and checksums
- Version management system

### Features
- Automatic linting after Edit, Write, or MultiEdit tools
- Smart project type detection
- Intelligent task placement in TODO.json
- Support for Python (ruff) and JavaScript/TypeScript (ESLint)
- Comprehensive error reporting and logging

### Installation
- Unix/Linux/macOS installer script
- Windows batch installer
- Cross-platform Node.js installer
- Manual setup options

### Documentation
- Quick start guide
- Comprehensive README
- API documentation
- Troubleshooting guide
`;
  }
    
  generateLicense() {
    return `MIT License

Copyright (c) ${new Date().getFullYear()} Claude Code Linter Hook

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
  }
    
  async createZipAlternative(_outputPath) {
    // Alternative ZIP creation method if system zip is not available
    this.log('Using alternative ZIP creation method...');
    // This would require a ZIP library like 'archiver' but keeping simple for now
    this.log('⚠️  ZIP creation requires system zip command or additional dependencies');
    throw new Error('Alternative ZIP creation not implemented');
  }
    
  log(message) {
    // Only log if verbose mode is explicitly enabled
    if (this.options && this.options.verbose === true) {
      console.log(message);
    }
    // If verbose is false or undefined, don't log anything
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
    
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
        
    switch (arg) {
      case '--output':
        options.output = args[++i];
        break;
      case '--version':
        options.version = args[++i];
        break;
      case '--format':
        const format = args[++i];
        if (!CONFIG.supportedFormats.includes(format)) {
          console.error(`Error: Unsupported format '${format}'. Supported: ${CONFIG.supportedFormats.join(', ')}`);
          process.exit(1);
        }
        options.format = format;
        break;
      case '--clean':
        options.clean = true;
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown option '${arg}'`);
        process.exit(1);
    }
  }
    
  return options;
}

function showHelp() {
  console.log(`
Claude Code Post-Tool Linter Hook Distribution Packager

Usage: node package-hook.js [options]

Options:
  --output <dir>    Output directory for package (default: ./dist)
  --version <ver>   Package version (default: auto-detect from package.json)
  --format <fmt>    Package format: zip, tar.gz, or folder (default: zip)
  --clean           Clean output directory before packaging
  --no-validate     Skip package validation
  --verbose         Enable verbose logging
  --help            Show this help message

Examples:
  node package-hook.js
  node package-hook.js --output ./release --format tar.gz
  node package-hook.js --version 2.0.0 --clean --verbose

Supported formats: ${CONFIG.supportedFormats.join(', ')}
`);
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const packager = new HookPackager(options);
    const result = await packager.createPackage();
        
    console.log('\\n🎉 Packaging completed successfully!');
    console.log(`📦 Package: ${result.packagePath}`);
    console.log(`⏱️  Duration: ${result.duration}s`);
        
    process.exit(0);
        
  } catch (error) {
    console.error(`\n❌ Packaging failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { HookPackager, CONFIG };