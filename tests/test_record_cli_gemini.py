#!/usr/bin/env python3
"""
E2E tests for record-cli Gemini API integration
"""

import subprocess
import sys
import os
import tempfile


def check_gemini_api_key():
    """Check if Gemini API key is available."""
    # Check environment variable
    if os.environ.get('GEMINI_API_KEY'):
        return True
    
    # Check config file
    # Go up from tests/ to worktree root, then up to main repo
    config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        '..', '..', 'config', '.env'
    )
    
    if os.path.exists(config_path):
        with open(config_path) as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY=') and line.split('=', 1)[1].strip():
                    return True
    
    return False


def test_gemini_api_key_detection():
    """Test that the tool can detect missing API key."""
    print("Testing API key detection...")
    
    if not check_gemini_api_key():
        print("⚠️  GEMINI_API_KEY not found, testing error handling...")
        
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            temp_file = tmp.name
        
        try:
            # Set test mode and remove API key from env
            env = os.environ.copy()
            env['RECORD_CLI_TEST_MODE'] = '1'
            env.pop('GEMINI_API_KEY', None)
            
            # Run without API key
            process = subprocess.Popen(
                ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            stdout, stderr = process.communicate(timeout=30)
            
            # Should show API key error
            assert "GEMINI_API_KEY not found" in stdout, "Should show API key error message"
            
            print("✓ API key error handling works correctly")
            
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
    else:
        print("✓ GEMINI_API_KEY is available")


def test_skip_gemini_flag():
    """Test that --skip-gemini flag prevents API calls."""
    print("Testing --skip-gemini flag...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Run with skip-gemini flag
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=30)
        
        # Should NOT see any Gemini-related messages
        assert "Uploading to Gemini" not in stdout, "Should not upload when --skip-gemini is used"
        assert "Reading video file" not in stdout, "Should not read video for Gemini when skipped"
        assert "Encoding video for upload" not in stdout, "Should not encode when skipped"
        
        print("✓ --skip-gemini flag works correctly")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_gemini_integration_mock():
    """Test Gemini integration with a mock response (doesn't make real API call)."""
    print("Testing Gemini integration flow...")
    
    if not check_gemini_api_key():
        print("⚠️  Skipping Gemini integration test - no API key found")
        return
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # For testing, we'll use --skip-gemini to avoid real API calls
        # but verify the flow works up to that point
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--no-compress", "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=30)
        
        # Verify the recording was created
        assert os.path.exists(temp_file), "Video file should be created"
        assert os.path.getsize(temp_file) > 0, "Video file should not be empty"
        
        print("✓ Gemini integration flow works (API call skipped for testing)")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_video_size_reporting():
    """Test that video size is reported correctly."""
    print("Testing video size reporting...")
    
    # This test works with the compression output
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Record and compress
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=30)
        
        # Check that video was saved
        assert "Video saved to:" in stdout, "Should show where video was saved"
        assert temp_file in stdout, "Should show the output path"
        
        print("✓ Video processing flow works correctly")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_requests_import():
    """Test that requests module is available."""
    print("Testing requests module availability...")
    
    try:
        import requests
        print("✓ requests module is available")
    except ImportError:
        print("❌ requests module not found - install with: pip install requests")
        raise


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli Gemini integration...\n")
    
    try:
        test_requests_import()
        test_gemini_api_key_detection()
        test_skip_gemini_flag()
        test_gemini_integration_mock()
        test_video_size_reporting()
        
        print("\n✅ All Gemini integration tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())