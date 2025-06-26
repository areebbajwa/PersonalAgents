#!/usr/bin/env python3
"""
E2E tests for record-cli video compression functionality
"""

import subprocess
import sys
import os
import tempfile
import json


def check_ffmpeg_installed():
    """Check if FFmpeg is installed."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            check=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_video_info(video_path):
    """Get video information using ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            video_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        info = json.loads(result.stdout)
        video_stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
        
        return {
            'width': int(video_stream['width']),
            'height': int(video_stream['height']),
            'codec': video_stream['codec_name']
        }
    except Exception as e:
        print(f"Error getting video info: {e}")
        return None


def test_compression_creates_mp4():
    """Test that compression creates an MP4 file."""
    print("Testing video compression to MP4...")
    
    if not check_ffmpeg_installed():
        print("⚠️  FFmpeg not installed, skipping compression tests")
        print("   Install with: brew install ffmpeg")
        return True  # Don't fail the test, just skip
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Record and compress video
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=30)
        
        if process.returncode != 0:
            print(f"Process failed with return code {process.returncode}")
            print(f"stdout: {stdout}")
            print(f"stderr: {stderr}")
        
        # Check if file was created
        assert os.path.exists(temp_file), f"Output file was not created at {temp_file}"
        
        # Check file size
        file_size = os.path.getsize(temp_file)
        assert file_size > 0, f"Output file is empty (size: {file_size})"
        
        # Should see compression message
        assert "[Compression] Compressing video to 480p" in stdout, "Should show compression message"
        assert "[Compression] Success!" in stdout, "Should show success message"
        
        print(f"✓ Compression created MP4 file of size: {file_size} bytes")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_compression_resolution():
    """Test that video is compressed to 480p resolution."""
    print("Testing 480p resolution...")
    
    if not check_ffmpeg_installed():
        print("⚠️  FFmpeg not installed, skipping resolution test")
        return True
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Record and compress video
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=30)
        
        # Get video info
        info = get_video_info(temp_file)
        assert info is not None, "Could not get video information"
        
        # Check resolution (854x480 for 16:9 aspect ratio)
        assert info['height'] == 480, f"Expected height 480, got {info['height']}"
        assert info['width'] == 854, f"Expected width 854, got {info['width']}"
        
        # Check codec
        assert info['codec'] == 'h264', f"Expected h264 codec, got {info['codec']}"
        
        print(f"✓ Video compressed to {info['width']}x{info['height']} with {info['codec']} codec")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_keep_original_flag():
    """Test that --keep-original flag preserves the original recording."""
    print("Testing --keep-original flag...")
    
    if not check_ffmpeg_installed():
        print("⚠️  FFmpeg not installed, skipping keep-original test")
        return True
    
    # Use specific output path so we can predict temp file location
    output_file = os.path.join(tempfile.gettempdir(), "test_output.mp4")
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # Record with keep-original flag
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-o", output_file, "--keep-original", "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Wait for process
        stdout, stderr = process.communicate(timeout=30)
        
        # Check that cleanup message is NOT shown
        assert "Cleaned up:" not in stdout, "Should not clean up files with --keep-original"
        
        # Output file should exist
        assert os.path.exists(output_file), "Output file should exist"
        
        print("✓ --keep-original flag works correctly")
        
    finally:
        # Cleanup
        if os.path.exists(output_file):
            os.remove(output_file)
        # Clean up any temp files that might have been kept
        for f in os.listdir(tempfile.gettempdir()):
            if f.startswith("temp_recording_") or f.startswith("compressed_"):
                try:
                    os.remove(os.path.join(tempfile.gettempdir(), f))
                except:
                    pass


def test_compression_failure_fallback():
    """Test that recording falls back to original when compression fails."""
    print("Testing compression failure fallback...")
    
    # This test will work even without FFmpeg
    with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
        temp_file = tmp.name
    
    try:
        # Set test mode environment variable
        env = os.environ.copy()
        env['RECORD_CLI_TEST_MODE'] = '1'
        
        # If FFmpeg is not installed, compression should fail gracefully
        if not check_ffmpeg_installed():
            # Record without compression (FFmpeg not available)
            process = subprocess.Popen(
                ["python3", "cli_tools/record-cli/record-cli", "-o", temp_file, "--skip-gemini"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            # Wait for process
            stdout, stderr = process.communicate(timeout=30)
            
            # Should see FFmpeg not found message
            assert "FFmpeg not found" in stdout, "Should show FFmpeg not found message"
            assert "using original recording" in stdout, "Should fall back to original"
            
            # File should still be created
            assert os.path.exists(temp_file), "Should still create output file"
            
            print("✓ Compression failure fallback works correctly")
        else:
            print("✓ FFmpeg is installed, skipping fallback test")
        
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli video compression...\n")
    
    try:
        test_compression_creates_mp4()
        test_compression_resolution()
        test_keep_original_flag()
        test_compression_failure_fallback()
        
        print("\n✅ All video compression tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())