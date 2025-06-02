# Browser Automation Solutions

## Gmail Browser Detection Bypass

### Problem
Gmail detects automated browsers and shows "This browser or app may not be secure" warnings, blocking automated login attempts.

### Solution: Automation Flags
Regular Playwright with specific automation flags is sufficient to bypass Gmail detection - no advanced stealth libraries needed.

**Working Configuration:**
```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "headless": false,
      "args": [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox"
      ]
    },
    "contextOptions": {
      "viewport": { "width": 1280, "height": 720 }
    }
  },
  "capabilities": ["core", "tabs", "pdf", "history", "wait", "files"]
}
```

**Key Flags:**
- `--disable-blink-features=AutomationControlled` - Primary flag that disables automation detection
- `--disable-features=IsolateOrigins,site-per-process` - Additional isolation bypass
- `--no-sandbox` - Security sandbox bypass for compatibility

### Implementation with Official MCP Servers

**Microsoft Playwright MCP Server Configuration:**

1. **Create configuration file** (`playwright-mcp-config.json`):
```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "headless": false,
      "args": [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox"
      ]
    },
    "contextOptions": {
      "viewport": { "width": 1280, "height": 720 }
    }
  },
  "capabilities": ["core", "tabs", "pdf", "history", "wait", "files"]
}
```

2. **Update MCP configuration** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "playwright": {
      "command": "/path/to/npx",
      "args": [
        "@playwright/mcp@latest",
        "--config", "/path/to/playwright-mcp-config.json"
      ]
    }
  }
}
```

### Session Persistence

**Official MCP servers maintain persistent browser profiles:**
- Cookies and login sessions are saved between uses
- Profile stored in `~/Library/Caches/ms-playwright/mcp-chrome-profile` (macOS)
- No need to re-authenticate for subsequent uses
- Profile includes: cookies, local storage, session storage, browser history

### Alternative Approaches Tested

**Failed/Unnecessary Approaches:**
- `undetected-playwright` library - Overcomplicated, compatibility issues
- Custom MCP servers - Stability problems, unnecessary complexity
- Firefox browser - Still detected by Gmail
- Complex stealth libraries - Simple flags are sufficient

**Key Insight:** The simplest solution (automation flags) was the most effective.

## MCP Server Troubleshooting

### Common Issues and Solutions

**"spawn npx ENOENT" errors on macOS:**
- **Cause:** Cursor can't find npx when using NVM
- **Solution:** Use full paths to npx in MCP configuration
- **Example:** `/Users/username/.nvm/versions/node/v18.20.8/bin/npx`

**"Client closed" errors:**
- **Cause:** Missing `experimental_capabilities` argument in MCP server implementation
- **Solution:** Add `experimental_capabilities={}` to `server.get_capabilities()` calls

**MCP server starts in terminal but not in Cursor:**
- **Diagnosis:** Check exact error messages in Cursor MCP logs
- **Common cause:** Environment differences between terminal and Cursor execution context
- **Solution:** Use web search with exact error messages to find specific fixes

### Debugging Process

1. **Check MCP logs:** `~/Library/Application Support/Cursor/logs/.../MCP Logs.log`
2. **Test in terminal:** Run MCP server manually to compare behavior
3. **Search exact errors:** Use web search with exact error messages
4. **Check configuration:** Verify paths and arguments in MCP config
5. **Verify dependencies:** Ensure all required packages are installed

## Best Practices

### Browser Automation
- **Test actual login flows** - Don't just test navigation
- **Use official servers** when possible for stability
- **Keep configurations simple** - Avoid over-engineering
- **Verify persistent sessions** work correctly

### MCP Development
- **Use official MCP Python SDK** for custom servers
- **Include proper error handling** and logging
- **Test both terminal and Cursor execution** 
- **Document exact error messages** for future debugging 