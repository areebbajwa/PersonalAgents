#!/usr/bin/env python3
"""
E2E tests for record-cli duration and start/stop functionality
"""

import subprocess
import sys
import os
import time
import tempfile


def test_duration_flag():
    """Test recording with fixed duration."""
    print("Testing duration flag...")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        output_file = tmp.name
    
    try:
        # Record for 2 seconds
        start_time = time.time()
        process = subprocess.Popen(
            ["python3", "cli_tools/record-cli/record-cli", "-d", "2", "-o", output_file, "--skip-gemini"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(timeout=10)
        duration = time.time() - start_time
        
        # Check return code
        assert process.returncode == 0, f"Process failed with code {process.returncode}"
        
        # Check that it recorded for approximately 2 seconds (allow some overhead)
        assert 2 <= duration <= 5, f"Recording took {duration} seconds, expected ~2"
        
        # Check output messages
        assert "[Recording] Recording for 2 seconds" in stdout
        assert "[Recording] Saved to:" in stdout
        
        # Check file was created
        assert os.path.exists(output_file), "Output file was not created"
        assert os.path.getsize(output_file) > 0, "Output file is empty"
        
        print(f"✓ Duration recording completed in {duration:.1f} seconds")
        
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)


def test_start_stop_commands():
    """Test background recording with start/stop commands."""
    print("Testing start/stop commands...")
    
    output_file = "test_background.mp4"
    
    try:
        # Start recording
        process = subprocess.run(
            ["python3", "cli_tools/record-cli/record-cli", "start", "-o", output_file],
            capture_output=True,
            text=True
        )
        
        assert process.returncode == 0, "Start command failed"
        assert "[Recording] Started recording in background" in process.stdout
        assert "Use 'record-cli stop' to stop recording" in process.stdout
        
        # Extract PID from output
        pid_line = [line for line in process.stdout.split('\n') if 'PID:' in line][0]
        pid = int(pid_line.split('PID: ')[1].split(')')[0])
        print(f"✓ Started recording with PID: {pid}")
        
        # Let it record for 2 seconds
        time.sleep(2)
        
        # Stop recording
        process = subprocess.run(
            ["python3", "cli_tools/record-cli/record-cli", "stop"],
            capture_output=True,
            text=True
        )
        
        # Stop command should succeed even if process already finished
        assert process.returncode == 0, "Stop command failed"
        
        # Check for expected output files
        # The tool might create a temp file or the final file
        files_created = []
        for pattern in [output_file, output_file.replace('.mp4', '_temp.mp4'), 
                       output_file.replace('.mp4', '_temp.mov')]:
            if os.path.exists(pattern):
                files_created.append(pattern)
        
        assert len(files_created) > 0, "No output files were created"
        print(f"✓ Created files: {files_created}")
        
        # Clean up
        for f in files_created:
            os.remove(f)
        
    except Exception as e:
        # Clean up on error
        for pattern in [output_file, output_file.replace('.mp4', '_temp.mp4'), 
                       output_file.replace('.mp4', '_temp.mov')]:
            if os.path.exists(pattern):
                os.remove(pattern)
        raise e


def test_multiple_durations():
    """Test various duration values."""
    print("Testing multiple duration values...")
    
    durations = [1, 3, 5]
    
    for duration in durations:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            output_file = tmp.name
        
        try:
            # Set test mode for faster execution
            env = os.environ.copy()
            env['RECORD_CLI_TEST_MODE'] = '1'
            
            process = subprocess.Popen(
                ["python3", "cli_tools/record-cli/record-cli", 
                 "-d", str(duration), "-o", output_file, "--skip-gemini"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            stdout, stderr = process.communicate(timeout=10)
            
            # In test mode it should still work
            assert process.returncode == 0, f"Failed for duration {duration}"
            assert os.path.exists(output_file), f"No output for duration {duration}"
            
            print(f"✓ Duration {duration}s test passed")
            
        finally:
            if os.path.exists(output_file):
                os.remove(output_file)


def test_start_while_recording():
    """Test that start command fails if already recording."""
    print("Testing start while already recording...")
    
    # Create a fake PID file to simulate active recording
    pid_file = os.path.join(tempfile.gettempdir(), '.record_cli.pid')
    
    try:
        with open(pid_file, 'w') as f:
            f.write("99999")  # Fake PID
        
        # Try to start recording
        process = subprocess.run(
            ["python3", "cli_tools/record-cli/record-cli", "start"],
            capture_output=True,
            text=True
        )
        
        assert process.returncode != 0, "Start should fail when already recording"
        assert "[Error] Recording already in progress" in process.stdout
        
        print("✓ Correctly prevented duplicate recording")
        
    finally:
        if os.path.exists(pid_file):
            os.remove(pid_file)


def test_stop_without_recording():
    """Test that stop command handles no active recording."""
    print("Testing stop without active recording...")
    
    # Make sure no PID file exists
    pid_file = os.path.join(tempfile.gettempdir(), '.record_cli.pid')
    if os.path.exists(pid_file):
        os.remove(pid_file)
    
    # Try to stop recording
    process = subprocess.run(
        ["python3", "cli_tools/record-cli/record-cli", "stop"],
        capture_output=True,
        text=True
    )
    
    assert process.returncode != 0, "Stop should fail when not recording"
    assert "[Error] No active recording found" in process.stdout
    
    print("✓ Correctly handled stop without active recording")


def main():
    """Run all tests."""
    print("Running E2E tests for record-cli duration and start/stop...\n")
    
    try:
        test_duration_flag()
        test_start_stop_commands()
        test_multiple_durations()
        test_start_while_recording()
        test_stop_without_recording()
        
        print("\n✅ All duration and start/stop tests passed!")
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())