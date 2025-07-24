# Task 1: Post-Tool Stop Hook Implementation Research

## Executive Summary
- **Research Question**: How to create a post-tool hook for Claude Code that runs linters after file modifications
- **Recommendation**: Implement PostToolUse hooks with tool matchers for Edit/Write/MultiEdit, executing project-aware linter commands
- **Key Findings**: 
  - Claude Code supports PostToolUse hooks with tool-specific matchers
  - Hook configuration in `~/.claude/settings.json` for global behavior
  - Hooks receive JSON input via stdin with tool information
  - Exit codes control Claude's behavior (0=continue, 2=force continue with prompt)
- **Implementation Timeline**: 2-3 hours for basic implementation, 4-5 hours for full feature set
- **Estimated Cost**: Minimal runtime overhead (~100-500ms per file edit)

## Detailed Analysis

### Claude Code Hook Architecture

#### Hook Event Types
1. **PreToolUse**: Runs before tool execution (can block tools)
2. **PostToolUse**: Runs after successful tool completion
3. **Stop**: Runs when Claude finishes responding
4. **SubagentStop**: Runs when subagents finish
5. **UserPromptSubmit**: Runs on user prompt submission
6. **Notification**: Runs when Claude needs permission
7. **PreCompact**: Runs before context compaction

#### Hook Configuration Structure
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/linter-hook.js",
            "timeout": 60000
          }
        ]
      }
    ]
  }
}
```

### Hook Input/Output Protocol

#### Input Format (via stdin)
```json
{
  "session_id": "unique-session-id",
  "transcript_path": "/path/to/transcript.jsonl",
  "hook_event_name": "PostToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/edited/file.py",
    "old_string": "...",
    "new_string": "..."
  },
  "tool_output": {
    "success": true,
    "message": "File edited successfully"
  },
  "cwd": "/project/directory",
  "stop_hook_active": false
}
```

#### Output Requirements
- **stdout**: General output (visible to user)
- **stderr**: Prompts/instructions for Claude
- **Exit codes**:
  - `0`: Continue normally
  - `1`: Error occurred
  - `2`: Force continuation with stderr prompt

### Project Type Detection Strategies

#### 1. Configuration File Detection
```javascript
function detectProjectType(projectPath) {
  const indicators = {
    python: ['pyproject.toml', 'setup.py', 'requirements.txt', '.python-version', 'Pipfile'],
    javascript: ['package.json', '.nvmrc'],
    typescript: ['tsconfig.json'],
    ruby: ['Gemfile', '.ruby-version'],
    go: ['go.mod'],
    rust: ['Cargo.toml']
  };
  
  // Check for presence of indicator files
  for (const [type, files] of Object.entries(indicators)) {
    if (files.some(file => fs.existsSync(path.join(projectPath, file)))) {
      return type;
    }
  }
  
  return null;
}
```

#### 2. File Extension Analysis
```javascript
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.py': 'python',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust'
  };
  
  return typeMap[ext] || null;
}
```

### Linter Integration Patterns

#### Python (ruff)
```javascript
async function runRuff(filePath, projectPath) {
  try {
    const result = await execAsync(`ruff check "${filePath}" --format json`, {
      cwd: projectPath,
      timeout: 10000
    });
    
    const violations = JSON.parse(result.stdout || '[]');
    return {
      success: violations.length === 0,
      violations: violations.map(v => ({
        file: v.filename,
        line: v.location.row,
        column: v.location.column,
        code: v.code,
        message: v.message,
        fixable: v.fix !== null
      }))
    };
  } catch (error) {
    // Handle non-zero exit codes (violations found)
    if (error.code === 1 && error.stdout) {
      return parseRuffOutput(error.stdout);
    }
    throw error;
  }
}
```

#### JavaScript/TypeScript (ESLint)
```javascript
async function runEslint(filePath, projectPath) {
  try {
    const eslintPath = await findExecutable(['npx', 'eslint'], projectPath);
    const result = await execAsync(
      `${eslintPath} "${filePath}" --format json`,
      { cwd: projectPath, timeout: 15000 }
    );
    
    const reports = JSON.parse(result.stdout || '[]');
    const fileReport = reports[0] || { messages: [] };
    
    return {
      success: fileReport.errorCount === 0 && fileReport.warningCount === 0,
      violations: fileReport.messages.map(m => ({
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? 'error' : 'warning',
        message: m.message,
        rule: m.ruleId,
        fixable: m.fix !== undefined
      }))
    };
  } catch (error) {
    return handleEslintError(error);
  }
}
```

### Hook Implementation Architecture

#### Main Hook Script Structure
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { detectProjectType, runLinter } = require('./lib/linters');
const { formatViolations } = require('./lib/formatters');

// Read stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);

process.stdin.on('end', async () => {
  try {
    const hookData = JSON.parse(inputData);
    
    // Skip if not a file modification tool
    if (!['Edit', 'Write', 'MultiEdit'].includes(hookData.tool_name)) {
      process.exit(0);
    }
    
    // Extract file path(s)
    const filePaths = extractFilePaths(hookData);
    
    // Run linters
    const results = await Promise.all(
      filePaths.map(fp => lintFile(fp, hookData.cwd))
    );
    
    // Check for violations
    const hasViolations = results.some(r => !r.success);
    
    if (hasViolations) {
      // Format prompt for Claude
      const prompt = formatLinterPrompt(results, hookData.cwd);
      console.error(prompt);
      process.exit(2); // Force continuation with prompt
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error.message}`);
    process.exit(0); // Don't block on errors
  }
});
```

### Claude Prompt Formatting

#### Effective Prompt Structure
```javascript
function formatLinterPrompt(results, projectPath) {
  const violations = results.flatMap(r => r.violations || []);
  
  if (violations.length === 0) return '';
  
  return `
## 🔍 Linting Issues Detected

The following linting issues were found in your recent changes:

${formatViolationsList(violations)}

### Required Actions:
1. Fix all linting errors before proceeding with other tasks
2. Use the Edit tool to correct each issue
3. Ensure the fixes maintain code functionality
4. Re-run linter after fixes to confirm resolution

**Priority**: High - Clean code standards must be maintained

Remember: A clean codebase is a maintainable codebase. Fix these issues now.
`;
}
```

### Error Handling Strategies

#### 1. Graceful Degradation
```javascript
async function lintFile(filePath, projectPath) {
  try {
    const fileType = getFileType(filePath);
    const projectType = detectProjectType(projectPath);
    
    // Determine which linter to use
    const linterType = fileType || projectType;
    
    if (!linterType) {
      return { success: true, reason: 'No linter configured' };
    }
    
    return await runLinter(linterType, filePath, projectPath);
  } catch (error) {
    // Log but don't fail
    console.error(`Linter error for ${filePath}: ${error.message}`);
    return { success: true, reason: 'Linter unavailable' };
  }
}
```

#### 2. Timeout Handling
```javascript
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}
```

## Recommendations

### Primary Recommendation
Implement a PostToolUse hook that:
1. Detects project type automatically based on configuration files
2. Runs appropriate linters (ruff for Python, ESLint for JS/TS)
3. Captures and formats linter output for Claude
4. Uses exit code 2 to prompt Claude to fix issues immediately
5. Maintains a cache of project types to avoid repeated detection

### Alternative Options

#### Option 1: Pre-commit Integration
- Use existing pre-commit hooks if available
- Pros: Leverages existing configuration
- Cons: May not cover all files, requires pre-commit setup

#### Option 2: Language Server Protocol
- Integrate with LSP servers for real-time checking
- Pros: More comprehensive analysis
- Cons: Complex implementation, higher resource usage

#### Option 3: CI/CD Integration
- Trigger CI linting jobs and report results
- Pros: Centralized configuration
- Cons: Slower feedback, requires CI access

## Implementation Plan

### Phase 1: Core Hook Infrastructure (1 hour)
1. Create hook script with stdin parsing
2. Implement tool matcher for Edit/Write/MultiEdit
3. Set up basic logging and error handling
4. Configure in ~/.claude/settings.json

### Phase 2: Project Detection (1 hour)
1. Implement configuration file detection
2. Add file extension mapping
3. Create project type cache
4. Handle edge cases (monorepos, mixed projects)

### Phase 3: Linter Integration (2 hours)
1. Implement ruff integration for Python
2. Implement ESLint integration for JavaScript
3. Add timeout and error handling
4. Parse linter outputs to common format

### Phase 4: Claude Communication (1 hour)
1. Design effective prompt format
2. Implement violation formatting
3. Add contextual fix suggestions
4. Test with various violation types

### Phase 5: Testing & Refinement (1 hour)
1. Test with real projects
2. Optimize performance
3. Handle edge cases
4. Document configuration options

## Risk Assessment

### Technical Risks
1. **Linter Availability**: Linters may not be installed
   - Mitigation: Graceful fallback, suggest installation
2. **Performance Impact**: Linting large files may be slow
   - Mitigation: Implement timeouts, async execution
3. **Configuration Conflicts**: Project-specific linter configs
   - Mitigation: Respect project settings, use defaults carefully

### User Experience Risks
1. **Interruption Fatigue**: Too many linting prompts
   - Mitigation: Batch violations, prioritize errors over warnings
2. **Context Switching**: Breaking flow for minor issues
   - Mitigation: Threshold for interruption, smart grouping

## Next Steps

1. Create basic hook script following the architecture above
2. Test with a Python project using ruff
3. Expand to JavaScript/TypeScript with ESLint
4. Add configuration options for customization
5. Create installation script for easy setup
6. Document usage and configuration options

## References

### Official Documentation
- [Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Hook Implementation Guide](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)

### Example Implementations
- [Infinite Continue Stop Hook](https://github.com/example/infinite-continue-stop-hook)
- [Claude Code Multi-Agent Observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)

### Linter Documentation
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [ESLint Documentation](https://eslint.org/docs/latest/)

### Code Examples
- Working hook configuration in `~/.claude/settings.json`
- Example PostToolUse hook from infinite-continue-stop-hook project
- Linter output parsing examples from various projects