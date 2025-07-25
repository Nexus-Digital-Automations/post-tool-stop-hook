#!/usr/bin/env node

/**
 * Post-Tool Linter Hook Setup Script
 * 
 * Configures the post-tool linter hook in Claude Code settings for automatic
 * linting after Edit, Write, and MultiEdit tool execution.
 * 
 * Features:
 * - Automatic Claude Code settings directory detection
 * - Proper hooks.json configuration with validation
 * - Cross-platform compatibility (Windows, macOS, Linux)
 * - Hook installation validation and troubleshooting
 * - Support for both global and project-specific configurations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Configuration constants
const HOOK_SCRIPT_NAME = 'post-tool-linter-hook.js';
const HOOK_PATH = path.resolve(__dirname, HOOK_SCRIPT_NAME);

// Claude Code settings paths for different platforms
const CLAUDE_SETTINGS_PATHS = {
  win32: path.join(os.homedir(), 'AppData', 'Roaming', 'claude', 'settings.json'),
  darwin: path.join(os.homedir(), '.claude', 'settings.json'),
  linux: path.join(os.homedir(), '.claude', 'settings.json')
};

const SETTINGS_PATH = CLAUDE_SETTINGS_PATHS[os.platform()] || CLAUDE_SETTINGS_PATHS.linux;

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  global: args.includes('--global'),
  local: args.includes('--local'),
  force: args.includes('--force'),
  validate: args.includes('--validate'),
  uninstall: args.includes('--uninstall'),
  help: args.includes('--help') || args.includes('-h'),
  timeout: getArgValue('--timeout', 15000),
  projectPath: getArgValue('--project') || process.cwd()
};

function getArgValue(flag, defaultValue = null) {
  const index = args.indexOf(flag);
  if (index > -1 && index < args.length - 1) {
    return args[index + 1];
  }
  return defaultValue;
}

function showHelp() {
  console.log(`
Post-Tool Linter Hook Setup Script

USAGE:
  node setup-post-tool-hook.js [options]

OPTIONS:
  --global              Install hook globally (default)
  --local               Install hook for current project only
  --project PATH        Specify project path for local installation
  --timeout MS          Set hook timeout in milliseconds (default: 15000)
  --force               Overwrite existing configuration
  --validate            Validate existing hook configuration
  --uninstall           Remove hook configuration
  --help, -h            Show this help message

EXAMPLES:
  # Install globally
  node setup-post-tool-hook.js --global

  # Install for specific project
  node setup-post-tool-hook.js --local --project /path/to/project

  # Validate existing installation
  node setup-post-tool-hook.js --validate

  # Uninstall hook
  node setup-post-tool-hook.js --uninstall

SUPPORTED LINTERS:
  - Python: ruff (install with: pip install ruff)
  - JavaScript/TypeScript: ESLint (install with: npm install -D eslint)

The hook will automatically run after Edit, Write, and MultiEdit tools,
detecting linting errors and prompting Claude to fix them immediately.
`);
}

function ensureSettingsDirectory() {
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
    console.log(`✓ Created Claude settings directory: ${settingsDir}`);
    return true;
  }
  return false;
}

function loadSettings() {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error parsing settings.json: ${error.message}`);
      console.error('Please fix the JSON syntax errors and try again.');
            
      // Create backup of corrupted file
      const backupPath = `${SETTINGS_PATH}.backup.${Date.now()}`;
      fs.copyFileSync(SETTINGS_PATH, backupPath);
      console.log(`📁 Corrupted settings backed up to: ${backupPath}`);
            
      process.exit(1);
    }
  }
  return {};
}

function saveSettings(settings) {
  try {
    // Create backup before modifying
    if (fs.existsSync(SETTINGS_PATH)) {
      const backupPath = `${SETTINGS_PATH}.backup.${Date.now()}`;
      fs.copyFileSync(SETTINGS_PATH, backupPath);
      console.log(`📁 Created backup: ${path.basename(backupPath)}`);
    }
        
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Error saving settings: ${error.message}`);
    return false;
  }
}

function validateHookScript() {
  if (!fs.existsSync(HOOK_PATH)) {
    console.error(`❌ Hook script not found: ${HOOK_PATH}`);
    console.error('\nPlease ensure the post-tool-linter-hook.js file is in the same directory as this setup script.');
    return false;
  }
    
  // Verify the hook script is executable
  try {
    fs.accessSync(HOOK_PATH, fs.constants.R_OK);
  } catch (error) {
    console.error(`❌ Hook script is not readable: ${error.message}`);
    return false;
  }
    
  console.log(`✓ Hook script found: ${HOOK_PATH}`);
  return true;
}

function createLocalSettings(projectPath) {
  const localSettingsPath = path.join(projectPath, '.claude', 'settings.local.json');
  const localSettingsDir = path.dirname(localSettingsPath);
    
  // Create .claude directory if it doesn't exist
  if (!fs.existsSync(localSettingsDir)) {
    fs.mkdirSync(localSettingsDir, { recursive: true });
    console.log(`✓ Created project settings directory: ${localSettingsDir}`);
  }
    
  let localSettings = {};
  if (fs.existsSync(localSettingsPath)) {
    try {
      localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    } catch (error) {
      console.warn(`⚠️  Could not parse existing local settings: ${error.message}`);
      localSettings = {};
    }
  }
    
  // Initialize hooks structure
  if (!localSettings.hooks) {
    localSettings.hooks = {};
  }
  if (!localSettings.hooks.PostToolUse) {
    localSettings.hooks.PostToolUse = [];
  }
    
  // Remove existing linter hook configuration
  localSettings.hooks.PostToolUse = localSettings.hooks.PostToolUse.filter(hook => 
    !(hook.hooks && hook.hooks.some(h => 
      h.command && h.command.includes('post-tool-linter-hook')
    ))
  );
    
  // Add new hook configuration
  const hookConfig = {
    matcher: 'Edit|Write|MultiEdit',
    hooks: [
      {
        type: 'command',
        command: HOOK_PATH,
        timeout: parseInt(flags.timeout)
      }
    ]
  };
    
  localSettings.hooks.PostToolUse.push(hookConfig);
    
  // Save local settings
  try {
    fs.writeFileSync(localSettingsPath, JSON.stringify(localSettings, null, 2));
    console.log(`✓ Local hook configuration saved: ${localSettingsPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving local settings: ${error.message}`);
    return false;
  }
}

function installHook() {
  console.log('=== Post-Tool Linter Hook Installation ===\n');
    
  // Validate hook script exists
  if (!validateHookScript()) {
    return false;
  }
    
  if (flags.local) {
    // Local installation
    console.log(`Installing hook locally for project: ${flags.projectPath}`);
        
    if (!fs.existsSync(flags.projectPath)) {
      console.error(`❌ Project path does not exist: ${flags.projectPath}`);
      return false;
    }
        
    return createLocalSettings(flags.projectPath);
  } else {
    // Global installation
    console.log('Installing hook globally...');
        
    // Ensure settings directory exists
    ensureSettingsDirectory();
        
    // Load existing settings
    const settings = loadSettings();
        
    // Initialize hooks structure
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.PostToolUse) {
      settings.hooks.PostToolUse = [];
    }
        
    // Check for existing hook configuration
    const existingHookIndex = settings.hooks.PostToolUse.findIndex(hook =>
      hook.hooks && hook.hooks.some(h => 
        h.command && h.command.includes('post-tool-linter-hook')
      )
    );
        
    if (existingHookIndex > -1) {
      if (!flags.force) {
        console.log('⚠️  Linter hook is already configured.');
        console.log('Use --force to overwrite existing configuration.\n');
        showCurrentConfig(settings);
        return true;
      }
            
      console.log('🔄 Updating existing hook configuration...');
      settings.hooks.PostToolUse.splice(existingHookIndex, 1);
    }
        
    // Add new hook configuration
    const hookConfig = {
      matcher: 'Edit|Write|MultiEdit',
      hooks: [
        {
          type: 'command',
          command: HOOK_PATH,
          timeout: parseInt(flags.timeout)
        }
      ]
    };
        
    settings.hooks.PostToolUse.push(hookConfig);
        
    // Save settings
    if (saveSettings(settings)) {
      console.log(`✅ Hook installed successfully!\n`);
      console.log(`Settings saved to: ${SETTINGS_PATH}\n`);
      showHookInfo();
      return true;
    } else {
      return false;
    }
  }
}

function validateConfiguration() {
  console.log('=== Hook Configuration Validation ===\n');
    
  // Check if hook script exists
  if (!validateHookScript()) {
    return false;
  }
    
  // Check global settings
  console.log('Checking global configuration...');
  const settings = loadSettings();
    
  if (!settings.hooks || !settings.hooks.PostToolUse) {
    console.log('❌ No PostToolUse hooks configured globally');
  } else {
    const linterHooks = settings.hooks.PostToolUse.filter(hook =>
      hook.hooks && hook.hooks.some(h => 
        h.command && h.command.includes('post-tool-linter-hook')
      )
    );
        
    if (linterHooks.length === 0) {
      console.log('❌ No linter hooks found in global configuration');
    } else {
      console.log(`✅ Found ${linterHooks.length} linter hook(s) in global configuration`);
      linterHooks.forEach((hook, index) => {
        console.log(`  Hook ${index + 1}:`);
        console.log(`    Matcher: ${hook.matcher}`);
        hook.hooks.forEach((h, hIndex) => {
          console.log(`    Command ${hIndex + 1}: ${h.command}`);
          console.log(`    Timeout: ${h.timeout}ms`);
        });
      });
    }
  }
    
  // Check local settings if in a project
  const localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  if (fs.existsSync(localSettingsPath)) {
    console.log('\nChecking local configuration...');
    try {
      const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      if (localSettings.hooks && localSettings.hooks.PostToolUse) {
        const localLinterHooks = localSettings.hooks.PostToolUse.filter(hook =>
          hook.hooks && hook.hooks.some(h => 
            h.command && h.command.includes('post-tool-linter-hook')
          )
        );
                
        if (localLinterHooks.length > 0) {
          console.log(`✅ Found ${localLinterHooks.length} linter hook(s) in local configuration`);
        } else {
          console.log('❌ No linter hooks found in local configuration');
        }
      } else {
        console.log('❌ No PostToolUse hooks in local configuration');
      }
    } catch (error) {
      console.log(`❌ Error reading local settings: ${error.message}`);
    }
  }
    
  // Check linter availability
  console.log('\nChecking linter availability...');
  checkLinterAvailability();
    
  return true;
}

function checkLinterAvailability() {
  // Check ESLint
  try {
    execSync('npx eslint --version', { stdio: 'pipe' });
    console.log('✅ ESLint is available');
  } catch {
    console.log('⚠️  ESLint not found - install with: npm install -D eslint');
  }
    
  // Check Ruff
  try {
    execSync('ruff --version', { stdio: 'pipe' });
    console.log('✅ Ruff is available');
  } catch {
    console.log('⚠️  Ruff not found - install with: pip install ruff');
  }
}

function uninstallHook() {
  console.log('=== Post-Tool Linter Hook Uninstallation ===\n');
    
  let removed = false;
    
  // Remove from global settings
  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = loadSettings();
        
    if (settings.hooks && settings.hooks.PostToolUse) {
      const originalLength = settings.hooks.PostToolUse.length;
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(hook =>
        !(hook.hooks && hook.hooks.some(h => 
          h.command && h.command.includes('post-tool-linter-hook')
        ))
      );
            
      if (settings.hooks.PostToolUse.length < originalLength) {
        if (saveSettings(settings)) {
          console.log('✅ Hook removed from global configuration');
          removed = true;
        } else {
          console.log('❌ Failed to save global settings');
        }
      } else {
        console.log('ℹ️  No linter hooks found in global configuration');
      }
    }
  }
    
  // Remove from local settings
  const localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  if (fs.existsSync(localSettingsPath)) {
    try {
      const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
            
      if (localSettings.hooks && localSettings.hooks.PostToolUse) {
        const originalLength = localSettings.hooks.PostToolUse.length;
        localSettings.hooks.PostToolUse = localSettings.hooks.PostToolUse.filter(hook =>
          !(hook.hooks && hook.hooks.some(h => 
            h.command && h.command.includes('post-tool-linter-hook')
          ))
        );
                
        if (localSettings.hooks.PostToolUse.length < originalLength) {
          fs.writeFileSync(localSettingsPath, JSON.stringify(localSettings, null, 2));
          console.log('✅ Hook removed from local configuration');
          removed = true;
        } else {
          console.log('ℹ️  No linter hooks found in local configuration');
        }
      }
    } catch (error) {
      console.log(`❌ Error processing local settings: ${error.message}`);
    }
  }
    
  if (removed) {
    console.log('\n✅ Hook uninstallation completed');
  } else {
    console.log('\nℹ️  No hooks were removed');
  }
    
  return true;
}

function showCurrentConfig(settings = null) {
  if (!settings) {
    settings = loadSettings();
  }
    
  console.log('Current Hook Configuration:');
    
  if (settings.hooks && settings.hooks.PostToolUse) {
    const linterHooks = settings.hooks.PostToolUse.filter(hook =>
      hook.hooks && hook.hooks.some(h => 
        h.command && h.command.includes('post-tool-linter-hook')
      )
    );
        
    if (linterHooks.length > 0) {
      console.log(JSON.stringify(linterHooks, null, 2));
    } else {
      console.log('No linter hooks configured');
    }
  } else {
    console.log('No hooks configured');
  }
}

function showHookInfo() {
  console.log('Hook Configuration Details:');
  console.log('• Triggers: Edit, Write, MultiEdit tools');
  console.log('• Supported languages: Python (Ruff), JavaScript/TypeScript (ESLint)');
  console.log(`• Timeout: ${flags.timeout}ms`);
  console.log('• Detection: Automatic based on file extensions and project structure\n');
    
  console.log('Next Steps:');
  console.log('1. Install linters in your projects:');
  console.log('   • Python: pip install ruff');
  console.log('   • JavaScript: npm install -D eslint');
  console.log('2. Configure linters (.ruff.toml, .eslintrc.json, etc.)');
  console.log('3. Hook will run automatically after file edits\n');
    
  console.log('Testing:');
  console.log('1. Open a project with Claude Code');
  console.log('2. Edit a Python or JavaScript file with linting issues');
  console.log('3. Claude will be prompted to fix linting errors immediately\n');
}

function main() {
  if (flags.help) {
    showHelp();
    return;
  }
    
  if (flags.validate) {
    validateConfiguration();
    return;
  }
    
  if (flags.uninstall) {
    uninstallHook();
    return;
  }
    
  // Default action: install hook
  const success = installHook();
    
  if (success) {
    console.log('🎉 Post-tool linter hook setup completed successfully!');
    console.log('\nThe hook will now automatically detect linting errors after file edits');
    console.log('and prompt Claude to fix them immediately.\n');
  } else {
    console.log('❌ Hook setup failed. Please check the errors above and try again.');
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('\n❌ Unexpected error:', error.message);
  console.error('Please report this issue with the full error details.');
  process.exit(1);
});

// Run main function
main();