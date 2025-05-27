# Cursor Agent Instructions: Desktop UI Automation CLI

## Overview

This CLI tool enables Cursor AI agents to automate desktop applications on macOS through terminal commands. Each command returns JSON output and exits cleanly, making it perfect for AI automation.

## Key Principles

1. **Stateless Operations**: Each CLI call is independent - no state persists between commands
2. **JSON Output**: All responses are in JSON format for easy parsing
3. **Direct Input Control**: Use `input` commands instead of element indexing for reliability
4. **Coordinate-Based Interaction**: For precise clicking, use coordinate-based input

## Command Reference

### Basic Automation Commands

```bash
# Navigate to working directory first
cd /Users/areebbajwa/PersonalAgents/cli_tools/desktop-automation-cli

# Open a website
./target/release/cli open-url "https://example.com"

# Open an application
./target/release/cli open-app --app-name "Chrome"

# List UI elements (for inspection)
./target/release/cli list-elements --app-name "Chrome"
```

### Input Control Commands (Primary Method)

```bash
# Type text (use for form fields, search boxes, etc.)
./target/release/cli input writetext "text to type"

# Press keys (navigation and form submission)
./target/release/cli input keypress "Tab"      # Move to next field
./target/release/cli input keypress "Return"   # Submit form/press enter
./target/release/cli input keypress "Space"    # Press spacebar
./target/release/cli input keypress "Escape"   # Cancel/escape

# Click at specific coordinates
./target/release/cli input click "x,y"         # Replace x,y with actual coordinates
```

## Web Form Automation Pattern

For automating web forms (like login pages), follow this pattern:

```bash
# 1. Open the target website
./target/release/cli open-url "https://target-website.com"

# 2. Wait a moment for page to load (you may need to add delays)
sleep 2

# 3. Click on the first input field (estimate coordinates)
./target/release/cli input click "400,350"

# 4. Type the username/email
./target/release/cli input writetext "username_here"

# 5. Move to password field
./target/release/cli input keypress "Tab"

# 6. Type the password
./target/release/cli input writetext "password_here"

# 7. Submit the form
./target/release/cli input keypress "Return"
```

## Response Handling

All commands return JSON. Check the `success` field:

**Successful Response:**
```json
{
  "success": true,
  "message": "Operation completed"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description"
}
```

## Best Practices for AI Agents

### 1. Always Change Directory First
```bash
cd /Users/areebbajwa/PersonalAgents/cli_tools/desktop-automation-cli
```

### 2. Use Direct Input Instead of Element Indexing
❌ **Don't use:** `./target/release/cli click 5`
✅ **Use:** `./target/release/cli input click "420,400"`

### 3. Coordinate Estimation
For web forms, common coordinate ranges:
- Username field: around `(400, 350)` to `(500, 400)`
- Password field: usually `Tab` key away from username
- Submit buttons: often around `(450, 450)` to `(500, 500)`

### 4. Error Recovery
If a command fails, try:
1. Check if the application is open and focused
2. Verify coordinates are reasonable (within screen bounds)
3. Add small delays between actions if needed

### 5. Timing Considerations
Some actions may need delays:
```bash
./target/release/cli open-url "https://example.com"
sleep 3  # Wait for page to load
./target/release/cli input click "400,350"
```

## Common Use Cases

### Login Automation
```bash
# EasyWeb login example
./target/release/cli open-url "https://easyweb.td.com"
sleep 2
./target/release/cli input click "420,400"
./target/release/cli input writetext "472409******3060"
./target/release/cli input keypress "Tab"
./target/release/cli input writetext "password123"
./target/release/cli input keypress "Return"
```

### Application Interaction
```bash
# Open and interact with a desktop app
./target/release/cli open-app --app-name "Calculator"
sleep 1
./target/release/cli input click "200,200"  # Click a button
./target/release/cli input keypress "Space"  # Press a key
```

### Information Gathering
```bash
# List elements to understand UI structure
./target/release/cli list-elements --app-name "Chrome" | grep -i "button\|text\|field"
```

## Troubleshooting for AI Agents

### Common Issues and Solutions

1. **"No cached elements found"**
   - Solution: Use `input` commands instead of indexed operations

2. **"Failed to get application"**
   - Solution: Ensure app name is correct and app is running
   - Try: `./target/release/cli open-app --app-name "AppName"` first

3. **"Accessibility permissions not granted"**
   - This requires manual user intervention
   - Inform user to check System Preferences > Security & Privacy > Privacy > Accessibility

4. **Coordinates not working**
   - Try different coordinate ranges
   - Use `list-elements` to understand UI structure
   - Consider that web pages may have different layouts

### Debugging Commands
```bash
# Check if CLI is working
./target/release/cli --help

# List available elements for inspection
./target/release/cli list-elements --app-name "Chrome"

# Test basic input
./target/release/cli input writetext "test"
```

## Security Considerations

- Never log sensitive information like passwords in plain text
- Be cautious with coordinate-based clicking on sensitive UI elements
- Always verify the target application before performing actions

## Integration Notes

- All commands exit cleanly with appropriate exit codes
- JSON output makes parsing straightforward
- No persistent state means each command is independent
- Works well with shell scripting and automation frameworks

This CLI tool provides a reliable foundation for desktop automation tasks while maintaining simplicity and predictability for AI agents. 