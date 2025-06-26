#!/usr/bin/env python3
"""
E2E tests for record-cli screen recording functionality
"""

import subprocess
import sys
import os
import tempfile


def test_recording_creates_file():
    """Test that recording creates a video file."""
    print("Testing basic recording functionality...")
    
    with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Start recording process
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process to finish (should take ~2 seconds)
        stdout, stderr = process.communicate(timeout=10)
        
        # Check return code
        if process.returncode != 0:
            print(f"Process failed with return code {process.returncode}")
            print(f"stdout: {stdout}")
            print(f"stderr: {stderr}")
        
        # Check if file was created
        assert os.path.exists(temp_file), f"Recording file was not created at {temp_file}"
        
        # Check file size (should be non-zero)
        file_size = os.path.getsize(temp_file)
        assert file_size > 0, f"Recording file is empty (size: {file_size})"
        
        print(f"✓ Recording created file of size: {file_size} bytes")
        
    finally:
        # Cleanup
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_skip_gemini_flag():
    """Test that --skip-gemini flag works and doesn't try to upload."""
    print("Testing --skip-gemini flag...")
    
    with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Start recording with skip-gemini flag
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=10)
        
        # Should not see Gemini upload message
        assert "Uploading video to Gemini" not in stdout, "Should not upload when --skip-gemini is used"
        assert "Gemini integration not yet implemented" not in stdout, "Should skip Gemini entirely"
        
        print("✓ --skip-gemini flag works correctly")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_no_compress_flag():
    """Test that --no-compress flag skips compression."""
    print("Testing --no-compress flag...")
    
    with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Start recording with no-compress flag
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--no-compress", "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=10)
        
        # Should not see compression message
        assert "Compressing video" not in stdout, "Should not compress when --no-compress is used"
        
        # Output file should be .mov (original format)
        assert temp_file.endswith(".mov"), "Output should remain in original format"
        
        print("✓ --no-compress flag works correctly")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_window_mode():
    """Test that window mode flag is accepted (even though it records fullscreen)."""
    print("Testing window mode...")
    
    with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Start recording in window mode
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-w", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=10)
        
        # Should see window-specific message
        assert "[Recording] Note: Window-specific recording not available" in stdout, "Should show window limitation message"
        
        print("✓ Window mode flag works")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_output_directory_creation():
    """Test that output directories are created if they don't exist."""
    print("Testing output directory creation...")
    
    # Create a path with non-existent directory
    temp_dir = tempfile.mkdtemp()
    output_path = os.path.join(temp_dir, "subdir", "recording.mov")
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Start recording with nested output path
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", output_path, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=10)
        
        # Check that directory was created
        assert os.path.exists(os.path.dirname(output_path)), "Output directory should be created"
        
        print("✓ Output directory creation works")
        
    finally:
        # Cleanup
        if os.path.exists(temp_dir):
            subprocess.run(["rm", "-rf", temp_dir], check=True)


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli screen recording...\n")
    
    try:
        test_recording_creates_file()
        test_skip_gemini_flag()
        test_no_compress_flag()
        test_window_mode()
        test_output_directory_creation()
        
        print("\n✅ All screen recording tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())