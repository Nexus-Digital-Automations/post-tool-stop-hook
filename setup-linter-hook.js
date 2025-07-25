#!/usr/bin/env node

/**
 * Setup script for Post-Tool Linter Hook
 * 
 * This script helps configure the linter hook in Claude Code settings
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK_PATH = path.resolve(__dirname, 'post-tool-linter-hook.js');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function ensureSettingsDirectory() {
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
    console.log(`✓ Created settings directory: ${settingsDir}`);
  }
}

function loadSettings() {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Error parsing existing settings.json:', error.message);
      console.log('Please fix the JSON syntax errors and try again.');
      process.exit(1);
    }
  }
  return {};
}

function setupHook() {
  console.log('=== Post-Tool Linter Hook Setup ===\n');
  
  // Check if hook script exists
  if (!fs.existsSync(HOOK_PATH)) {
    console.error(`❌ Hook script not found at: ${HOOK_PATH}`);
    process.exit(1);
  }
  
  // Ensure settings directory exists
  ensureSettingsDirectory();
  
  // Load existing settings
  const settings = loadSettings();
  
  // Initialize hooks object if it doesn't exist
  if (!settings.hooks) {
    settings.hooks = {};
  }
  
  // Initialize PostToolUse array if it doesn't exist
  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [];
  }
  
  // Check if hook is already configured
  const existingHook = settings.hooks.PostToolUse.find(hook => 
    hook.hooks && hook.hooks.some(h => 
      h.command && h.command.includes('post-tool-linter-hook')
    )
  );
  
  if (existingHook) {
    console.log('⚠️  Linter hook is already configured in settings.json');
    console.log('Updating configuration...\n');
    
    // Remove existing hook
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(hook => 
      hook !== existingHook
    );
  }
  
  // Add the linter hook configuration
  const hookConfig = {
    matcher: 'Edit|Write|MultiEdit',
    hooks: [
      {
        type: 'command',
        command: HOOK_PATH,
        timeout: 15000
      }
    ]
  };
  
  settings.hooks.PostToolUse.push(hookConfig);
  
  // Save updated settings
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log(`✅ Hook configured successfully!\n`);
    console.log(`Settings saved to: ${SETTINGS_PATH}\n`);
    
    // Display configuration
    console.log('Hook Configuration:');
    console.log('- Triggers on: Edit, Write, MultiEdit tools');
    console.log('- Supported languages: Python (ruff), JavaScript/TypeScript (ESLint)');
    console.log('- Timeout: 15 seconds\n');
    
    console.log('Next Steps:');
    console.log('1. Make sure linters are installed:');
    console.log('   - Python: pip install ruff');
    console.log('   - JavaScript: npm install -D eslint');
    console.log('2. Configure linters in your projects (.ruff.toml, .eslintrc.json)');
    console.log('3. The hook will run automatically after file edits\n');
    
    console.log('To test the hook:');
    console.log('1. Open a project with Claude Code');
    console.log('2. Edit a Python or JavaScript file');
    console.log('3. If there are linting errors, Claude will be prompted to fix them\n');
    
  } catch (error) {
    console.error('❌ Error saving settings:', error.message);
    process.exit(1);
  }
}

function showCurrentConfig() {
  const settings = loadSettings();
  
  if (settings.hooks && settings.hooks.PostToolUse) {
    const linterHooks = settings.hooks.PostToolUse.filter(hook =>
      hook.hooks && hook.hooks.some(h => 
        h.command && h.command.includes('post-tool-linter-hook')
      )
    );
    
    if (linterHooks.length > 0) {
      console.log('\nCurrent Linter Hook Configuration:');
      console.log(JSON.stringify(linterHooks, null, 2));
    } else {
      console.log('\nNo linter hook currently configured.');
    }
  } else {
    console.log('\nNo hooks configured in settings.json');
  }
}

// Export functions for testing
if (require.main === module) {
  // Run setup when executed directly
  setupHook();
  showCurrentConfig();
} else {
  // Export functions for testing
  module.exports = {
    ensureSettingsDirectory,
    loadSettings,
    setupHook,
    showCurrentConfig,
    HOOK_PATH,
    SETTINGS_PATH
  };
}