#!/bin/bash
# Claude Code Linter Hook Installer (Unix/Linux/macOS)
# Version: 1.0.0

set -e

echo "🚀 Installing Claude Code Linter Hook v1.0.0"
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
