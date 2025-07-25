@echo off
REM Claude Code Linter Hook Installer (Windows)
REM Version: 1.0.0

echo 🚀 Installing Claude Code Linter Hook v1.0.0
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
if not exist "%USERPROFILE%\.claude" (
    echo ❌ Claude Code configuration directory not found
    echo Please install and configure Claude Code first
    pause
    exit /b 1
)

REM Run the Node.js setup script
echo 📦 Running setup script...
node ".\bin\setup-post-tool-hook.js" --global

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
