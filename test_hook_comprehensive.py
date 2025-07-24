#!/usr/bin/env python3

"""
Comprehensive Python Test Suite for Post-Tool Linter Hook

This test suite provides additional coverage for the linter hook functionality
from a Python perspective, complementing the JavaScript tests.
"""

import unittest
import subprocess
import json
import tempfile
import os
import shutil
from pathlib import Path


class TestPostToolLinterHook(unittest.TestCase):
    """Test cases for the post-tool linter hook"""

    def setUp(self):
        """Set up test environment"""
        self.test_dir = tempfile.mkdtemp(prefix='hook_test_')
        self.hook_path = Path(__file__).parent / 'post-tool-linter-hook.js'
        self.maxDiff = None

    def tearDown(self):
        """Clean up test environment"""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def run_hook(self, input_data, timeout=10):
        """Helper method to run the hook with given input"""
        try:
            result = subprocess.run(
                ['node', str(self.hook_path)],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                timeout=timeout
            )
            return {
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr
            }
        except subprocess.TimeoutExpired:
            return {
                'returncode': -1,
                'stdout': '',
                'stderr': 'TIMEOUT'
            }

    def test_python_file_with_violations(self):
        """Test hook processing of Python files with linting violations"""
        test_file = os.path.join(self.test_dir, 'test_violations.py')
        with open(test_file, 'w') as f:
            f.write('import os\nimport sys\ndef bad_function(x,y):\n    z=x+y\n    return z\n')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])  # 0 = success, 2 = linting issues

    def test_clean_python_file(self):
        """Test hook processing of clean Python files"""
        test_file = os.path.join(self.test_dir, 'clean_test.py')
        with open(test_file, 'w') as f:
            f.write('def clean_function(x, y):\n    """A clean function."""\n    return x + y\n')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)

    def test_javascript_file_processing(self):
        """Test hook processing of JavaScript files"""
        test_file = os.path.join(self.test_dir, 'test.js')
        with open(test_file, 'w') as f:
            f.write('function testFunction() {\n  console.log("test");\n  return true;\n}')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_unsupported_file_type(self):
        """Test hook handling of unsupported file types"""
        test_file = os.path.join(self.test_dir, 'test.txt')
        with open(test_file, 'w') as f:
            f.write('This is a text file')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)  # Should skip and exit successfully

    def test_nonexistent_file(self):
        """Test hook handling of nonexistent files"""
        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': '/nonexistent/file.py'},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)  # Should handle gracefully

    def test_malformed_json_input(self):
        """Test hook handling of malformed JSON input"""
        try:
            result = subprocess.run(
                ['node', str(self.hook_path)],
                input='invalid json',
                text=True,
                capture_output=True,
                timeout=5
            )
            self.assertEqual(result.returncode, 0)  # Should handle gracefully
        except subprocess.TimeoutExpired:
            self.fail("Hook should handle malformed JSON without hanging")

    def test_tool_execution_failure(self):
        """Test hook handling when tool execution fails"""
        input_data = {
            'tool_name': 'Edit',
            'tool_output': {'success': False, 'error': 'Tool execution failed'},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)  # Should skip linting

    def test_disabled_tool(self):
        """Test hook handling of disabled tools"""
        input_data = {
            'tool_name': 'Read',  # Not in enabled tools list
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)  # Should skip processing

    def test_multiedit_processing(self):
        """Test hook processing of MultiEdit operations"""
        test_file = os.path.join(self.test_dir, 'multiedit_test.py')
        with open(test_file, 'w') as f:
            f.write('import os\ndef test():\n    pass\n')

        input_data = {
            'tool_name': 'MultiEdit',
            'tool_input': {
                'file_path': test_file,
                'edits': [{'old_string': 'import os', 'new_string': 'import os\nimport sys'}]
            },
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_write_operation(self):
        """Test hook processing of Write operations"""
        test_file = os.path.join(self.test_dir, 'write_test.py')

        input_data = {
            'tool_name': 'Write',
            'tool_input': {
                'file_path': test_file,
                'content': 'def new_function():\n    return "Hello, World!"\n'
            },
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_project_type_detection_python(self):
        """Test project type detection for Python projects"""
        # Create pyproject.toml to indicate Python project
        pyproject_file = os.path.join(self.test_dir, 'pyproject.toml')
        with open(pyproject_file, 'w') as f:
            f.write('[tool.ruff]\nselect = ["E", "F"]\n')

        test_file = os.path.join(self.test_dir, 'project_test.py')
        with open(test_file, 'w') as f:
            f.write('def test():\n    pass\n')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_project_type_detection_javascript(self):
        """Test project type detection for JavaScript projects"""
        # Create package.json to indicate JavaScript project
        package_file = os.path.join(self.test_dir, 'package.json')
        with open(package_file, 'w') as f:
            json.dump({'name': 'test-project', 'scripts': {'test': 'jest'}}, f)

        test_file = os.path.join(self.test_dir, 'project_test.js')
        with open(test_file, 'w') as f:
            f.write('function test() {\n  return true;\n}')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_logging_functionality(self):
        """Test that logging works correctly"""
        test_file = os.path.join(self.test_dir, 'logging_test.py')
        with open(test_file, 'w') as f:
            f.write('def test():\n    pass\n')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

        # Check if log file was created
        log_file = os.path.join(self.test_dir, 'post-tool-linter-hook.log')
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                log_content = f.read()
                self.assertIn('POST-TOOL LINTER HOOK LOG', log_content)

    def test_security_path_traversal(self):
        """Test security handling of path traversal attempts"""
        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': '../../../etc/passwd'},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertEqual(result['returncode'], 0)  # Should handle safely

    def test_large_file_handling(self):
        """Test hook handling of large files"""
        test_file = os.path.join(self.test_dir, 'large_test.py')
        with open(test_file, 'w') as f:
            # Create a reasonably large Python file
            f.write('# Large test file\n')
            for i in range(100):
                f.write(f'def function_{i}():\n    """Function {i}"""\n    return {i}\n\n')

        input_data = {
            'tool_name': 'Edit',
            'tool_input': {'file_path': test_file},
            'tool_output': {'success': True},
            'cwd': self.test_dir
        }

        result = self.run_hook(input_data)
        self.assertIn(result['returncode'], [0, 2])

    def test_concurrent_safety(self):
        """Test that hook handles concurrent-like scenarios"""
        # Create multiple test files
        test_files = []
        for i in range(3):
            test_file = os.path.join(self.test_dir, f'concurrent_test_{i}.py')
            with open(test_file, 'w') as f:
                f.write(f'def test_{i}():\n    return {i}\n')
            test_files.append(test_file)

        # Test each file separately (simulating concurrent tool uses)
        for test_file in test_files:
            input_data = {
                'tool_name': 'Edit',
                'tool_input': {'file_path': test_file},
                'tool_output': {'success': True},
                'cwd': self.test_dir
            }

            result = self.run_hook(input_data)
            self.assertIn(result['returncode'], [0, 2])


class TestHookUtilities(unittest.TestCase):
    """Test utility functions and edge cases"""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix='hook_util_test_')
        self.hook_path = Path(__file__).parent / 'post-tool-linter-hook.js'

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_empty_input_handling(self):
        """Test hook handling of empty input"""
        try:
            result = subprocess.run(
                ['node', str(self.hook_path)],
                input='',
                text=True,
                capture_output=True,
                timeout=5
            )
            self.assertEqual(result.returncode, 0)
        except subprocess.TimeoutExpired:
            self.fail("Hook should handle empty input without hanging")

    def test_minimal_valid_json(self):
        """Test hook with minimal valid JSON"""
        input_data = {}
        
        try:
            result = subprocess.run(
                ['node', str(self.hook_path)],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                timeout=5
            )
            self.assertEqual(result.returncode, 0)
        except subprocess.TimeoutExpired:
            self.fail("Hook should handle minimal JSON without hanging")

    def test_hook_executable_permissions(self):
        """Test that hook file has proper executable permissions"""
        self.assertTrue(os.access(self.hook_path, os.X_OK), 
                       "Hook file should be executable")

    def test_hook_file_exists(self):
        """Test that hook file exists and is readable"""
        self.assertTrue(self.hook_path.exists(), "Hook file should exist")
        self.assertTrue(os.access(self.hook_path, os.R_OK), 
                       "Hook file should be readable")


if __name__ == '__main__':
    unittest.main(verbosity=2)