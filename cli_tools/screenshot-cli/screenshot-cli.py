#!/usr/bin/env python3
"""
Screenshot CLI Tool for macOS
A command-line interface for taking screenshots of windows, regions, or the entire screen on macOS.
"""

import argparse
import subprocess
import sys
import os
import time
from datetime import datetime


class ScreenshotCLI:
    def __init__(self):
        self.default_format = "png"
        self.default_output_dir = os.path.expanduser("~/Desktop")
    
    def generate_filename(self, prefix="screenshot", format_ext="png"):
        """Generate a timestamped filename."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}.{format_ext}"
    
    def take_fullscreen(self, output_path, format_type="png", include_cursor=False, delay=0):
        """Take a screenshot of the entire screen."""
        cmd = ["screencapture"]
        
        if include_cursor:
            cmd.append("-C")
        
        if delay > 0:
            cmd.extend(["-T", str(delay)])
        
        if format_type != "png":
            cmd.extend(["-t", format_type])
        
        cmd.append(output_path)
        
        return self._execute_command(cmd)
    
    def take_window_interactive(self, output_path, format_type="png", include_shadow=True):
        """Take a screenshot of a specific window interactively."""
        cmd = ["screencapture", "-i"]
        
        if not include_shadow:
            cmd.append("-o")
        
        if format_type != "png":
            cmd.extend(["-t", format_type])
        
        cmd.append(output_path)
        
        print("Click on a window to capture it, or press Space to select window mode, or Esc to cancel.")
        return self._execute_command(cmd)
    
    def take_region_interactive(self, output_path, format_type="png"):
        """Take a screenshot of a selected region interactively."""
        cmd = ["screencapture", "-s"]
        
        if format_type != "png":
            cmd.extend(["-t", format_type])
        
        cmd.append(output_path)
        
        print("Drag to select the area to capture, or press Esc to cancel.")
        return self._execute_command(cmd)
    
    def take_window_by_id(self, window_id, output_path, format_type="png"):
        """Take a screenshot of a specific window by ID."""
        cmd = ["screencapture", "-l", str(window_id)]
        
        if format_type != "png":
            cmd.extend(["-t", format_type])
        
        cmd.append(output_path)
        
        return self._execute_command(cmd)
    
    def list_windows(self):
        """List all available windows with their IDs."""
        try:
            # Use AppleScript to get window information
            applescript = '''
            tell application "System Events"
                set windowList to {}
                set processList to every process where background only is false
                repeat with proc in processList
                    try
                        set procName to name of proc
                        set windowTitles to name of every window of proc
                        repeat with winTitle in windowTitles
                            set end of windowList to (procName & " - " & winTitle)
                        end repeat
                    end try
                end repeat
                return windowList
            end tell
            '''
            
            result = subprocess.run(
                ["osascript", "-e", applescript],
                capture_output=True,
                text=True,
                check=True
            )
            
            windows = result.stdout.strip().split(", ")
            print("Available windows:")
            for i, window in enumerate(windows, 1):
                if window.strip():
                    print(f"{i:2d}. {window.strip()}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"Error listing windows: {e}")
            return False
    
    def to_clipboard(self, format_type="png", mode="fullscreen", include_cursor=False):
        """Take a screenshot and copy to clipboard."""
        cmd = ["screencapture", "-c"]
        
        if include_cursor:
            cmd.append("-C")
        
        if mode == "window":
            cmd.append("-i")
            print("Click on a window to capture it to clipboard, or press Esc to cancel.")
        elif mode == "region":
            cmd.append("-s")
            print("Drag to select the area to capture to clipboard, or press Esc to cancel.")
        
        return self._execute_command(cmd)
    
    def _execute_command(self, cmd):
        """Execute a command and handle errors."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return True
        except subprocess.CalledProcessError as e:
            if e.returncode == 1:
                print("Screenshot cancelled by user.")
            else:
                print(f"Error taking screenshot: {e}")
            return False
        except KeyboardInterrupt:
            print("\nScreenshot cancelled.")
            return False


def main():
    parser = argparse.ArgumentParser(
        description="Take screenshots on macOS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Take fullscreen screenshot
  %(prog)s -w                        # Select window interactively
  %(prog)s -r                        # Select region interactively
  %(prog)s -c                        # Copy fullscreen to clipboard
  %(prog)s -c -w                     # Copy window selection to clipboard
  %(prog)s -l                        # List available windows
  %(prog)s -o ~/Pictures/shot.png    # Save to specific location
  %(prog)s -f jpg                    # Save as JPEG
  %(prog)s -d 5                      # 5 second delay
  %(prog)s --cursor                  # Include cursor in screenshot
        """
    )
    
    # Main action arguments
    parser.add_argument("-w", "--window", action="store_true",
                       help="Select window interactively")
    parser.add_argument("-r", "--region", action="store_true",
                       help="Select region interactively")
    parser.add_argument("-c", "--clipboard", action="store_true",
                       help="Copy to clipboard instead of saving to file")
    parser.add_argument("-l", "--list", action="store_true",
                       help="List available windows")
    
    # Output options
    parser.add_argument("-o", "--output", type=str,
                       help="Output file path")
    parser.add_argument("-f", "--format", type=str, default="png",
                       choices=["png", "jpg", "pdf", "tiff"],
                       help="Output format (default: png)")
    
    # Screenshot options
    parser.add_argument("-d", "--delay", type=int, default=0,
                       help="Delay in seconds before taking screenshot")
    parser.add_argument("--cursor", action="store_true",
                       help="Include cursor in screenshot")
    parser.add_argument("--no-shadow", action="store_true",
                       help="Don't include window shadow (window mode only)")
    
    # Window ID option
    parser.add_argument("--window-id", type=int,
                       help="Screenshot specific window by ID")
    
    args = parser.parse_args()
    
    screenshot_cli = ScreenshotCLI()
    
    # Handle list windows
    if args.list:
        screenshot_cli.list_windows()
        return
    
    # Handle clipboard mode
    if args.clipboard:
        mode = "fullscreen"
        if args.window:
            mode = "window"
        elif args.region:
            mode = "region"
        
        success = screenshot_cli.to_clipboard(
            format_type=args.format,
            mode=mode,
            include_cursor=args.cursor
        )
        if success and mode == "fullscreen":
            print("Screenshot copied to clipboard.")
        return
    
    # Determine output path
    if args.output:
        output_path = os.path.expanduser(args.output)
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
    else:
        filename = screenshot_cli.generate_filename(format_ext=args.format)
        output_path = os.path.join(screenshot_cli.default_output_dir, filename)
    
    # Take screenshot based on mode
    success = False
    
    if args.window_id:
        success = screenshot_cli.take_window_by_id(
            args.window_id, output_path, args.format
        )
    elif args.window:
        success = screenshot_cli.take_window_interactive(
            output_path, args.format, not args.no_shadow
        )
    elif args.region:
        success = screenshot_cli.take_region_interactive(
            output_path, args.format
        )
    else:
        # Default: fullscreen
        success = screenshot_cli.take_fullscreen(
            output_path, args.format, args.cursor, args.delay
        )
    
    if success:
        print(f"Screenshot saved to: {output_path}")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()