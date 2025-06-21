# Screenshot CLI Tool

A command-line interface for taking screenshots on macOS with support for fullscreen, window selection, region selection, and clipboard operations.

## Features

- **Fullscreen screenshots** - Capture the entire screen
- **Window selection** - Interactive window selection 
- **Region selection** - Interactive area selection
- **Clipboard support** - Copy screenshots directly to clipboard
- **Multiple formats** - PNG, JPG, PDF, TIFF support
- **Window listing** - List all available windows
- **Customizable output** - Specify output location and filename
- **Screenshot options** - Include cursor, remove shadows, add delays

## Installation

The tool is already executable. You can run it directly:

```bash
cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/screenshot-cli
./screenshot-cli.py --help
```

Or use the symlink:

```bash
./screenshot --help
```

## Usage

### Basic Commands

```bash
# Take fullscreen screenshot (saves to ~/Desktop)
./screenshot

# Select window interactively
./screenshot -w

# Select region interactively  
./screenshot -r

# Copy fullscreen to clipboard
./screenshot -c

# Copy window selection to clipboard
./screenshot -c -w

# List available windows
./screenshot -l
```

### Advanced Options

```bash
# Save to specific location
./screenshot -o ~/Pictures/my_screenshot.png

# Save as JPEG
./screenshot -f jpg

# Include cursor in screenshot
./screenshot --cursor

# Take screenshot after 5 second delay
./screenshot -d 5

# Window screenshot without shadow
./screenshot -w --no-shadow

# Screenshot specific window by ID
./screenshot --window-id 1234
```

### Output Formats

Supported formats:
- `png` (default)
- `jpg` 
- `pdf`
- `tiff`

### Interactive Modes

**Window Selection (`-w`)**:
- Click on any window to capture it
- Press Space to toggle between selection modes
- Press Escape to cancel

**Region Selection (`-r`)**:
- Click and drag to select area
- Press Escape to cancel

## Examples

```bash
# Quick clipboard screenshot
./screenshot -c

# High-quality window capture
./screenshot -w -o ~/Desktop/window.png --cursor

# Delayed fullscreen for setup
./screenshot -d 10 -o ~/Desktop/desktop.jpg -f jpg

# Region selection to PDF
./screenshot -r -f pdf -o ~/Documents/selection.pdf

# Multiple format batch (using shell loop)
for fmt in png jpg pdf; do
    ./screenshot -o ~/Desktop/screen.$fmt -f $fmt
done
```

## File Naming

When no output path is specified, files are automatically named with timestamp:
- Format: `screenshot_YYYYMMDD_HHMMSS.{format}`
- Location: `~/Desktop/`
- Example: `screenshot_20250621_145830.png`

## Requirements

- macOS (uses native `screencapture` command)
- Python 3.6+
- No additional dependencies required

## Permissions

On first use, macOS may prompt for screen recording permissions. Grant access in:
- System Preferences → Security & Privacy → Privacy → Screen Recording

## Error Handling

The tool handles common scenarios gracefully:
- User cancellation (Escape key)
- Permission denied
- Invalid paths
- Unsupported formats

Exit codes:
- `0`: Success  
- `1`: Error or user cancellation

## Integration

The tool can be easily integrated into scripts and workflows:

```bash
#!/bin/bash
# Example: Auto-screenshot with timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
./screenshot -o ~/Screenshots/auto_$timestamp.png
echo "Screenshot saved: auto_$timestamp.png"
```

## Troubleshooting

**No output or blank screenshots**:
- Check screen recording permissions
- Ensure you have write access to output directory

**Interactive modes not working**:
- Make sure you're running in a terminal with proper display access
- Try running with `sudo` if permission issues persist

**Window listing shows no windows**:
- This is normal behavior - the AppleScript method may require additional permissions or active windows