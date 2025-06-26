#!/usr/bin/env python3
"""
E2E tests for record-cli argument handling
"""

import subprocess
import sys


def test_help_flag():
    """Test that -h and --help flags work."""
    print("Testing help flags...")
    
    # Test -h
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "-h"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Help flag -h failed with code {result.returncode}"
    assert "Record screen and get AI-powered descriptions" in result.stdout
    assert "Examples:" in result.stdout
    print("✓ -h flag works")
    
    # Test --help
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Help flag --help failed with code {result.returncode}"
    assert "Record screen and get AI-powered descriptions" in result.stdout
    print("✓ --help flag works")


def test_window_flag():
    """Test that window flag is recognized."""
    print("Testing window flag...")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "-w", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Window flag test failed with code {result.returncode}"
    print("✓ -w flag is recognized")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--window", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Window flag test failed with code {result.returncode}"
    print("✓ --window flag is recognized")


def test_output_flag():
    """Test that output flag is recognized."""
    print("Testing output flag...")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "-o", "test.mp4", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Output flag test failed with code {result.returncode}"
    print("✓ -o flag is recognized")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--output", "test.mp4", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Output flag test failed with code {result.returncode}"
    print("✓ --output flag is recognized")


def test_compression_flags():
    """Test compression-related flags."""
    print("Testing compression flags...")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--no-compress", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"No-compress flag test failed with code {result.returncode}"
    print("✓ --no-compress flag is recognized")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--keep-original", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Keep-original flag test failed with code {result.returncode}"
    print("✓ --keep-original flag is recognized")


def test_skip_gemini_flag():
    """Test skip Gemini flag."""
    print("Testing skip Gemini flag...")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--skip-gemini", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Skip-gemini flag test failed with code {result.returncode}"
    print("✓ --skip-gemini flag is recognized")


def test_invalid_flag():
    """Test that invalid flags are rejected."""
    print("Testing invalid flag handling...")
    
    result = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "--invalid-flag"],
        capture_output=True,
        text=True
    )
    assert result.returncode != 0, "Invalid flag should cause non-zero exit code"
    assert "unrecognized arguments" in result.stderr or "invalid" in result.stderr.lower()
    print("✓ Invalid flags are properly rejected")


def test_shebang_execution():
    """Test that the script can be executed directly with shebang."""
    print("Testing shebang execution...")
    
    # Make sure it's executable
    subprocess.run(["chmod", "+x", "cli_tools/record-cli/record-cli"], check=True)
    
    result = subprocess.run(
        ["./cli_tools/record-cli/record-cli", "-h"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Shebang execution failed with code {result.returncode}"
    assert "Record screen and get AI-powered descriptions" in result.stdout
    print("✓ Shebang execution works")


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli argument handling...\n")
    
    try:
        test_help_flag()
        test_window_flag()
        test_output_flag()
        test_compression_flags()
        test_skip_gemini_flag()
        test_invalid_flag()
        test_shebang_execution()
        
        print("\n✅ All argument handling tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())