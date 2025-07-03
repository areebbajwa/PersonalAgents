# CLI Tools Path Analysis Report

## Summary of Path-Related Issues

This report analyzes all CLI tools in the `cli_tools` directory to identify path-related issues that would prevent them from working as global commands from any directory.

## CLI Tools Analysis

### 1. **ai-monitor-cli**
- **Path**: `cli_tools/ai-monitor-cli/`
- **Main Entry**: `ai-monitor-cli` → `src/index.js`
- **Relative Path Issues**: ✅ NONE
  - Uses `require('./src/index.js')` which is relative to the script location
  - No hardcoded paths found
- **Global Compatibility**: ✅ COMPATIBLE

### 2. **firebase-cli**
- **Path**: `cli_tools/firebase-cli/`
- **Main Entry**: `firebase-cli` (Node.js)
- **Relative Path Issues**: ❌ CRITICAL
  - Line 11: `path.join(__dirname, '../../config/firebase-service-account.json')`
  - Assumes config is 2 directories up from script location
  - Will break when run from different directories
- **Global Compatibility**: ❌ BROKEN

### 3. **gmail-cli**
- **Path**: `cli_tools/gmail-cli/`
- **Main Entry**: `gmail-cli` → `src/index.js`
- **Relative Path Issues**: ❌ CRITICAL
  - Bash wrapper properly resolves script directory
  - But `src/index.js` lines 32-34: Hardcoded config paths:
    ```javascript
    path.resolve(__dirname, '../../../config/.env')
    path.resolve(__dirname, `../../../config/.env.${profile}`)
    ```
  - Assumes config is 3 directories up from src/
- **Global Compatibility**: ❌ BROKEN

### 4. **google-sheets-cli**
- **Path**: `cli_tools/google-sheets-cli/`
- **Main Entry**: `google-sheets-cli` → `sheets-cli.py`
- **Relative Path Issues**: ❌ CRITICAL
  - Line 13: `SERVICE_ACCOUNT_FILE = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/config/firebase-service-account.json'`
  - Absolute hardcoded path that won't work on other systems
- **Global Compatibility**: ❌ BROKEN

### 5. **openrouter-multi-model**
- **Path**: `cli_tools/openrouter-multi-model/`
- **Main Entry**: `openrouter-multi-model` → `index.js`
- **Relative Path Issues**: ❌ CRITICAL
  - Line 15: `dotenv.config({ path: path.join(__dirname, '../../config/.env') })`
  - Assumes config is 2 directories up
- **Global Compatibility**: ❌ BROKEN

### 6. **pdf-ai-cli**
- **Path**: `cli_tools/pdf-ai-cli/`
- **Main Entry**: `pdf-ai-cli` → `src/index.js`
- **Relative Path Issues**: ❌ CRITICAL
  - Bash wrapper properly changes to script directory
  - But `src/index.js` line 12: `dotenv.config({ path: path.resolve(process.cwd(), '../../config/.env') })`
  - Uses `process.cwd()` which depends on where command is run from
- **Global Compatibility**: ❌ BROKEN

### 7. **browser-cli**
- **Path**: `cli_tools/browser-cli/`
- **Main Entry**: `browser-cli` → `src/index.js`
- **Relative Path Issues**: ✅ NONE
  - Bash wrapper changes to script directory
  - No hardcoded config paths found in main files
- **Global Compatibility**: ✅ COMPATIBLE

### 8. **workflow-cli**
- **Path**: `cli_tools/workflow-cli/`
- **Main Entry**: `workflow-cli` → `workflow-cli.py`
- **Relative Path Issues**: ✅ MINOR
  - Line 15: Uses `Path(__file__).resolve().parent` to find state directory
  - Properly resolves relative to script location
  - State files stored in `workflow-cli/state/` directory
- **Global Compatibility**: ✅ COMPATIBLE

### 9. **startup-manager**
- **Path**: `cli_tools/startup-manager/`
- **Main Entry**: `startup-manager` (Python)
- **Relative Path Issues**: ⚠️ MODERATE
  - Uses `Path.home() / ".startup-manager"` for config (good)
  - But has some hardcoded paths in default tasks:
    - Line 47: `/Users/areeb2/bin/chrome_health_monitor.sh`
    - Line 69: `/Users/areeb2/bin/screen-cleanup`
    - Line 77: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py`
  - These are user-specific defaults, not critical for tool functionality
- **Global Compatibility**: ⚠️ PARTIALLY COMPATIBLE

### 10. **screenshot-cli**
- **Path**: `cli_tools/screenshot-cli/`
- **Main Entry**: `screenshot-cli` (Python)
- **Relative Path Issues**: ✅ NONE
  - No hardcoded paths
  - Uses `os.path.expanduser("~/Desktop")` for default output
- **Global Compatibility**: ✅ COMPATIBLE

### 11. **record-cli**
- **Path**: `cli_tools/record-cli/`
- **Main Entry**: `record-cli` (Python)
- **Relative Path Issues**: ⚠️ MINOR
  - Lines 155-163: Tries to load GEMINI_API_KEY from config/.env
  - Uses `Path(os.path.realpath(__file__))` to resolve script location
  - Falls back gracefully if not found
- **Global Compatibility**: ✅ COMPATIBLE (with warning about API key)

### 12. **desktop-automation-cli**
- **Path**: `cli_tools/desktop-automation-cli/`
- **Main Entry**: `desktop-automation-cli` → `target/release/cli`
- **Relative Path Issues**: ✅ NONE
  - Bash wrapper properly resolves binary location
  - Binary path is relative to script location
- **Global Compatibility**: ✅ COMPATIBLE

### 13. **screen-tools**
- **Path**: `cli_tools/screen-tools/`
- **Main Entry**: Multiple bash scripts
- **Relative Path Issues**: ✅ NONE
  - All scripts use standard commands
  - Usage stats stored in `$HOME/.screen_usage_stats`
  - No hardcoded paths
- **Global Compatibility**: ✅ COMPATIBLE

## Summary Statistics

- **Total CLI Tools**: 13
- **Fully Compatible**: 6 (46%)
- **Broken**: 5 (38%)
- **Partially Compatible**: 2 (15%)

## Critical Issues to Fix

1. **Config Path Resolution**: Most broken tools assume config files are at a fixed relative location (../../config or ../../../config)
2. **Hardcoded Absolute Paths**: google-sheets-cli has an absolute path that won't work on other systems
3. **process.cwd() Usage**: pdf-ai-cli uses current working directory instead of script location

## Recommended Fixes

1. **Use Environment Variables**: Tools should check for config paths in environment variables first
2. **Resolve Paths from Script Location**: Use `__dirname` (Node.js) or `Path(__file__).resolve().parent` (Python)
3. **Provide Config Path Options**: Add command-line flags to specify config locations
4. **Use Standard Config Locations**: Check ~/.config/toolname/ or similar standard locations
5. **Graceful Fallbacks**: Tools should provide clear error messages when config is not found