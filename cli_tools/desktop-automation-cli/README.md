# Desktop UI Automation CLI

A command-line tool for automating desktop applications through accessibility APIs on macOS. This tool provides a simple interface for opening applications, listing UI elements, and performing input actions.

## Features

- Open URLs in browsers
- Launch applications
- List UI elements with accessibility information
- Direct input control via AppleScript (keyboard, mouse, text input)
- Cross-platform design (currently macOS only)

## Prerequisites

### macOS Setup

1. **Accessibility Permissions**: The tool requires accessibility permissions to interact with other applications.
   - Go to **System Preferences > Security & Privacy > Privacy > Accessibility**
   - Add your terminal application (Terminal.app, iTerm2, etc.) to the list
   - Ensure the checkbox is checked

2. **Build the CLI**:
   ```bash
   cargo build --bin cli --release
   ```

## Usage

The CLI tool is located at `./target/release/cli` after building.

### Basic Commands

#### 1. Open a URL
```bash
./target/release/cli open-url "https://example.com"
./target/release/cli open-url "https://example.com" --browser "Safari"
```

#### 2. Open an Application
```bash
./target/release/cli open-app --app-name "Chrome"
./target/release/cli open-app --app-name "Safari"
```

#### 3. List UI Elements
```bash
# List elements for Chrome (default)
./target/release/cli list-elements

# List elements for a specific app
./target/release/cli list-elements --app-name "Safari"
```

#### 4. Direct Input Control (Recommended)

The CLI provides direct input control that bypasses element indexing issues:

**Type Text:**
```bash
./target/release/cli input writetext "Hello World"
```

**Press Keys:**
```bash
./target/release/cli input keypress "Tab"
./target/release/cli input keypress "Return"
./target/release/cli input keypress "Space"
./target/release/cli input keypress "Escape"
```

**Click at Coordinates:**
```bash
./target/release/cli input click "420,400"
```

### Web Form Automation Example

Here's how to automate a login form (like EasyWeb):

```bash
# 1. Open the website
./target/release/cli open-url "https://easyweb.td.com"

# 2. Click on the username field (estimate coordinates)
./target/release/cli input click "420,400"

# 3. Type username
./target/release/cli input writetext "your_username"

# 4. Tab to password field
./target/release/cli input keypress "Tab"

# 5. Type password
./target/release/cli input writetext "your_password"

# 6. Submit form
./target/release/cli input keypress "Return"
```

### Advanced Usage

#### Enable JavaScript in Chrome (for AppleScript automation)

If you need to use JavaScript injection with Chrome:

1. In Chrome, go to **View > Developer > Allow JavaScript from Apple Events**
2. This enables AppleScript to execute JavaScript in web pages

#### Finding Element Coordinates

You can use the list-elements command to understand the UI structure, then estimate coordinates for clicking:

```bash
./target/release/cli list-elements --app-name "Chrome" | grep -i "username\|login\|text"
```

## Output Format

All commands return JSON output:

**Success:**
```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error description"
}
```

**Element List:**
```json
{
  "success": true,
  "elements": {
    "count": 150,
    "elements": [
      {
        "index": 0,
        "role": "AXButton",
        "text": "Submit"
      }
    ]
  }
}
```

## Integration with Cursor AI

This CLI tool is designed to be used by AI assistants like Cursor. Here are the key integration points:

### 1. Terminal Command Execution

The AI can execute commands like:
```bash
./target/release/cli input writetext "some text"
```

### 2. JSON Response Parsing

All responses are in JSON format for easy parsing by AI systems.

### 3. Error Handling

The tool provides clear error messages and appropriate exit codes.

### 4. Stateless Operation

Each command is independent - no state is maintained between calls, making it reliable for AI automation.

## Troubleshooting

### Common Issues

1. **"Accessibility permissions not granted"**
   - Add your terminal to System Preferences > Security & Privacy > Privacy > Accessibility

2. **"Failed to get application"**
   - Make sure the application name is correct and the app is running
   - Try using the exact name as it appears in Activity Monitor

3. **"Element clicking via index not cached"**
   - Use the `input` commands instead of indexed element operations
   - Element indices don't persist between CLI calls

4. **AppleScript errors**
   - Ensure the target application is in focus
   - Some applications may require specific timing between actions

### Debugging

Enable verbose logging by setting the `RUST_LOG` environment variable:
```bash
RUST_LOG=debug ./target/release/cli list-elements
```

## Architecture

- **CLI Interface**: Built with `clap` for argument parsing
- **Accessibility APIs**: Uses macOS accessibility framework
- **AppleScript Integration**: Direct system automation via `osascript`
- **JSON Output**: Structured responses for programmatic use

## Limitations

- Currently macOS only
- Element indexing doesn't persist between CLI calls
- Coordinate-based clicking requires manual positioning
- Some applications may have restrictions on automation

## Future Enhancements

- Windows and Linux support
- Element caching between calls
- Visual element detection
- Recording and playback of automation sequences
- Web-specific automation improvements 