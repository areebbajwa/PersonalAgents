#!/usr/bin/env python3
"""
E2E tests for record-cli full workflow
"""

import subprocess
import sys
import os
import tempfile


def test_full_workflow_with_compression():
    """Test the complete workflow: record, compress, save."""
    print("Testing full workflow with compression...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        output_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Run full workflow (skip Gemini for speed)
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", output_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=60)
        
        # Check return code
        assert process.returncode == 0, f"Process failed with code {process.returncode}"
        
        # Check expected log messages
        assert "[Recording] Starting fullscreen recording" in stdout
        assert "[Recording] Saved to:" in stdout
        assert "[Compression] Compressing video to 480p" in stdout
        assert "[Compression] Success!" in stdout
        assert "[Output] Video saved to:" in stdout
        
        # Check output file exists and is MP4
        assert os.path.exists(output_file), "Output file was not created"
        assert output_file.endswith(".mp4"), "Output should be MP4 format"
        
        # Check file size
        file_size = os.path.getsize(output_file)
        assert file_size > 0, "Output file is empty"
        
        # Check cleanup happened
        assert "[Cleanup] Removed temporary file" in stdout
        
        print(f"✓ Full workflow completed successfully (output: {file_size} bytes)")
        
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)


def test_window_mode_workflow():
    """Test workflow with window mode flag."""
    print("Testing window mode workflow...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        output_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Run with window mode
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-w", "-o", output_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=60)
        
        # Check return code
        assert process.returncode == 0, f"Process failed with code {process.returncode}"
        
        # Check window mode messages
        assert "[Recording] Note: Window-specific recording not available" in stdout
        assert "[Recording] Starting fullscreen recording" in stdout
        
        # Check file was created
        assert os.path.exists(output_file), "Output file was not created"
        
        print("✓ Window mode workflow works correctly")
        
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)


def test_no_output_path():
    """Test workflow without specifying output path."""
    print("Testing workflow without output path...")
    
    # Set test mode
    env = os.environ.copy()
    env['RECORD_CLI_TEST_MODE'] = '1'
    
    # Run without output path
    process = subprocess.Popen(
        ["python3", "cli_tools/record-cli/record-cli", "--skip-gemini", "--no-compress"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )
    
    stdout, stderr = process.communicate(timeout=60)
    
    # Should succeed
    assert process.returncode == 0, f"Process failed with code {process.returncode}"
    
    # Should save to temp directory
    assert "[Recording] Saved to:" in stdout
    assert "/var/folders/" in stdout or "/tmp/" in stdout
    
    # Should clean up since no output was specified
    assert "[Cleanup] Removed temporary file" in stdout
    
    print("✓ Default output path workflow works correctly")


def test_keep_original_workflow():
    """Test workflow with --keep-original flag."""
    print("Testing --keep-original workflow...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        output_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Run with keep-original
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", output_file, "--keep-original", "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=60)
        
        # Check return code
        assert process.returncode == 0, f"Process failed with code {process.returncode}"
        
        # Should NOT have cleanup messages
        assert "[Cleanup]" not in stdout, "Should not clean up with --keep-original"
        
        # Output file should exist
        assert os.path.exists(output_file), "Output file was not created"
        
        print("✓ Keep-original workflow works correctly")
        
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)


def test_error_handling():
    """Test error handling for various failure scenarios."""
    print("Testing error handling...")
    
    # Test with invalid output directory
    output_path = "/invalid/directory/path/video.mp4"
    
    # Set test mode
    env = os.environ.copy()
    env['RECORD_CLI_TEST_MODE'] = '1'
    
    # This should handle the error gracefully
    process = subprocess.Popen(
        ["python3", "cli_tools/record-cli/record-cli", "-o", output_path, "--skip-gemini"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )
    
    stdout, stderr = process.communicate(timeout=60)
    
    # Should show error message
    assert "[Error]" in stdout or "Error" in stderr, "Should show error for invalid path"
    
    print("✓ Error handling works correctly")


def test_progress_logging():
    """Test that progress logging shows all expected stages."""
    print("Testing progress logging...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        output_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Run full workflow
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", output_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=60)
        
        # Check all progress stages are logged
        expected_stages = [
            "[Recording]",
            "[Compression]",
            "[Output]",
            "[Cleanup]"
        ]
        
        for stage in expected_stages:
            assert stage in stdout, f"Missing progress stage: {stage}"
        
        # Check file sizes are reported
        assert "MB" in stdout, "Should report file sizes"
        assert "reduced by" in stdout, "Should report compression ratio"
        
        print("✓ Progress logging shows all stages correctly")
        
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli full workflow...\n")
    
    try:
        test_full_workflow_with_compression()
        test_window_mode_workflow()
        test_no_output_path()
        test_keep_original_workflow()
        test_error_handling()
        test_progress_logging()
        
        print("\n✅ All full workflow tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())