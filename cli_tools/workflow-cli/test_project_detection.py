#!/usr/bin/env python3
"""Test project auto-detection from worktree directories"""

import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path to import workflow-cli
sys.path.insert(0, str(Path(__file__).parent))

# Import after adding to path
import importlib.util
spec = importlib.util.spec_from_file_location("workflow_cli", "workflow-cli.py")
workflow_cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow_cli)

def test_project_detection():
    """Test that project name is auto-detected from worktree directory"""
    print("Testing project auto-detection from worktree directories...")
    
    # Create a temporary directory structure
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a mock worktree structure
        worktree_path = Path(temp_dir) / "worktrees" / "test-project-20250101"
        worktree_path.mkdir(parents=True)
        
        # Create rules directory
        rules_dir = worktree_path / "rules"
        rules_dir.mkdir()
        
        # Test 1: Auto-detection when in worktree directory
        print("\nTest 1: Auto-detection in worktree directory")
        original_cwd = os.getcwd()
        try:
            os.chdir(worktree_path)
            manager = workflow_cli.WorkflowManager(rules_dir)
            assert manager.project == "test-project-20250101", f"Expected 'test-project-20250101', got '{manager.project}'"
            print("✅ PASS: Project auto-detected correctly")
        finally:
            os.chdir(original_cwd)
        
        # Test 2: Explicit project overrides auto-detection
        print("\nTest 2: Explicit project overrides auto-detection")
        try:
            os.chdir(worktree_path)
            manager = workflow_cli.WorkflowManager(rules_dir, project="explicit-project")
            assert manager.project == "explicit-project", f"Expected 'explicit-project', got '{manager.project}'"
            print("✅ PASS: Explicit project name takes precedence")
        finally:
            os.chdir(original_cwd)
        
        # Test 3: No auto-detection outside worktree
        print("\nTest 3: No auto-detection outside worktree")
        # Change to temp directory (outside worktree) for this test
        try:
            os.chdir(temp_dir)
            manager = workflow_cli.WorkflowManager(rules_dir)
            assert manager.project is None, f"Expected None, got '{manager.project}'"
            print("✅ PASS: No auto-detection outside worktree")
        finally:
            os.chdir(original_cwd)
        
        # Test 4: State file uses detected project name
        print("\nTest 4: State file uses detected project name")
        try:
            os.chdir(worktree_path)
            manager = workflow_cli.WorkflowManager(rules_dir)
            expected_state_file = "workflow_state_test-project-20250101.json"
            assert manager.state_file.name == expected_state_file, f"Expected '{expected_state_file}', got '{manager.state_file.name}'"
            print("✅ PASS: State file named correctly with auto-detected project")
        finally:
            os.chdir(original_cwd)
    
    print("\n🎉 All tests passed!")
    return True

if __name__ == "__main__":
    success = test_project_detection()
    sys.exit(0 if success else 1)