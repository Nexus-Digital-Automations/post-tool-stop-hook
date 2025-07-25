#!/usr/bin/env node
/**
 * Claude Code Linter Hook Cross-Platform Installer
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Installing Claude Code Linter Hook v${this.options.version}');
console.log('==================================================');

// Check Node.js version
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);

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
    execSync(`node "${setupScript}" --global`, { stdio: 'inherit' });
    
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
