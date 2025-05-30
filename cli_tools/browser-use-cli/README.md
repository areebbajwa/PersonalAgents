# Browser-Use CLI Tool

A command-line interface for automating web browsers using AI with **persistent browser sessions** and **comprehensive state capture**. Built as a wrapper around the [browser-use](https://github.com/gregpr07/browser-use) library, this tool provides true session persistence while leveraging all of browser-use's proven automation capabilities.

## 🌟 Features

- **🔄 Persistent Browser Sessions** - Browser stays open between commands, maintaining login state and context
- **📸 Browser State Capture** - Automatically saves detailed browser state after each task for investigation
- **🤖 AI-Powered Automation** - Natural language descriptions converted to browser actions
- **🚀 Auto-Service Management** - Automatically starts/stops background service as needed
- **📱 Multiple Modes** - Service mode (persistent) or direct mode (one-off tasks)
- **👁️ Visible by Default** - See what's happening in the browser (headless mode available)
- **🔧 Zero Maintenance** - Uses browser-use as dependency, gets updates automatically
- **⚡ Fast Execution** - No browser startup delay after first command
- **🗂️ State Investigation Tools** - Built-in utilities to analyze captured browser states

## 🎯 Use Cases

Perfect for:
- **Multi-step workflows** - Log into sites once, run multiple automation tasks
- **Data collection** - Navigate complex sites while maintaining session state
- **Testing & QA** - Automated testing with real browser interactions and state verification
- **Personal automation** - Check emails, social media, manage accounts
- **Research tasks** - Gather information across multiple sites and pages
- **Debugging & Analysis** - Investigate browser state at any point in automation workflows

## 📦 Installation

### Prerequisites

- Python 3.10+ with virtual environment
- Google Gemini API key
- macOS/Linux (Windows support via WSL)

### Setup

1. **Navigate to the CLI tool directory:**
   ```bash
   cd cli_tools/browser-use-cli
   ```

2. **Make the wrapper scripts executable:**
   ```bash
   chmod +x browser-use state-viewer
   ```

3. **Set up your Google API key:**
   ```bash
   # In your project's config/.env file
   echo "GOOGLE_API_KEY=your_api_key_here" >> ../../config/.env
   ```

That's it! The wrapper scripts automatically activate the virtual environment and handle all dependencies.

## 🚀 Quick Start

### Basic Usage

```bash
# Navigate to the CLI directory
cd cli_tools/browser-use-cli

# Run a simple task (starts service automatically, captures state)
./browser-use "Navigate to google.com and search for AI news"

# Output shows state file location:
# 📸 Browser state captured: ~/.config/browseruse/browser_states/browser_state_20231215_143022_123_Navigate_to_google_com_and_search_for_AI.json

# Run another task (reuses same browser session)
./browser-use "Click on the first search result"

# Stop the service when done
./browser-use --stop-service
```

## 📸 Browser State Capture

Every task execution automatically captures comprehensive browser state information for debugging and analysis.

### What's Captured

- **Page Information**: URL, title, viewport size
- **Storage Data**: localStorage, sessionStorage, cookies
- **DOM Snapshot**: Active elements, forms, links
- **Performance Metrics**: Load times, navigation timing
- **Screenshots**: Visual state of the page (PNG format)
- **Browser Context**: Multiple tabs, browser-level information
- **Error States**: Detailed error information when tasks fail

### State File Format

State files are saved as timestamped JSON files in `~/.config/browseruse/browser_states/`:

```
browser_state_20231215_143022_123_Task_Description.json
```

### Investigation Tools

#### List Recent State Files
```bash
./state-viewer list
```

#### View Latest State
```bash
./state-viewer view latest
```

#### View Specific State File
```bash
./state-viewer view ~/.config/browseruse/browser_states/browser_state_20231215_143022_123_Navigate_to_google_com.json
```

#### Extract Screenshot
```bash
./state-viewer screenshot latest
./state-viewer screenshot /path/to/state.json --output screenshot.png
```

### Quick Investigation
After any task, you can quickly investigate the captured state:

```bash
# Run a task
./browser-use "Login to my email account"

# The output shows:
# 📸 Browser state captured: /path/to/state_file.json
# 💡 Investigate browser state: cat '/path/to/state_file.json'

# Quick view of the latest state
./state-viewer view latest

# Extract screenshot if needed
./state-viewer screenshot latest
```

### Console Log Investigation

Console logs are automatically captured during browser automation tasks:

```bash
# Run a task that might generate console messages
./browser-use "Navigate to a JavaScript-heavy website"

# View console logs from the latest capture
./state-viewer console latest

# Example output:
# 🎧 Console Logs Report
# 📅 Timestamp: 2024-12-15T14:30:22.123456
# 📝 Task: Navigate to a JavaScript-heavy website
# ================================================================================
# 📊 Console Log Summary:
#    Total Messages: 12
#    Message Types:
#      📄 log: 8
#      ⚠️ warning: 2
#      ❌ error: 2
# 
# 📋 Console Messages (chronological order):
# --------------------------------------------------------------------------------
#   1. 📄 [14:30:15.123] log: Application started
#      📍 Location: app.js:45:12
#      📋 Args: ['App version 1.2.3']
#   
#   2. ⚠️ [14:30:15.456] warning: Deprecated API usage
#      📍 Location: legacy.js:123:5
#   
#   3. ❌ [14:30:16.789] error: Failed to load resource
#      📍 Location: loader.js:67:8

# Common console investigation scenarios
./state-viewer console latest | grep -i error    # Find error messages
./state-viewer console latest | grep -i warning  # Find warnings only
```

### Console Log Types Captured

The system captures various types of console messages:

- **📄 log**: Standard console.log() messages
- **ℹ️ info**: console.info() informational messages  
- **⚠️ warning**: console.warn() warning messages
- **❌ error**: console.error() error messages
- **🐛 debug**: console.debug() debug messages
- **🚨 pageerror**: Uncaught JavaScript exceptions

### Disabling State Capture

For faster execution when state capture isn't needed:

```bash
./browser-use --no-capture "Quick task without state capture"
```

## 📋 Command Reference

### Basic Commands

```bash
# Run automation task (default: service mode + visible browser + state capture)
./browser-use "task description"

# Run without state capture (faster)
./browser-use --no-capture "task description"

# Show help
./browser-use --help

# Show examples
./browser-use --examples

# Check wrapper functionality
./browser-use --test-wrapper

# Stop the persistent service
./browser-use --stop-service
```

### Mode Options

```bash
# Service Mode (DEFAULT) - persistent browser sessions + state capture
./browser-use "Log into Google"           # Browser stays open, state saved
./browser-use "Search for AI news"        # Reuses existing session, state saved
./browser-use "Check my Gmail"            # Still using same browser, state saved

# Direct Mode - browser closes after each task  
./browser-use --direct "Quick one-off task"

# Headless Mode - invisible browser
./browser-use --headless "Background data scraping"
./browser-use --direct --headless "Invisible one-off task"

# Disable state capture for speed
./browser-use --no-capture "Fast task without state capture"
```

### State Viewer Commands

```bash
# List recent browser states
./state-viewer list

# View the latest captured state
./state-viewer view latest

# View a specific state file
./state-viewer view ~/.config/browseruse/browser_states/browser_state_*.json

# View console logs from latest state
./state-viewer console latest

# View console logs from specific state file
./state-viewer console /path/to/state.json

# Extract screenshot from latest state
./state-viewer screenshot latest

# Extract screenshot with custom output path
./state-viewer screenshot latest --output my_screenshot.png
```

## 🎯 Example Workflows

### Login & Investigation Workflow
```bash
# Login to Gmail and capture the login state
./browser-use "Navigate to gmail.com and log into my account"

# Investigate what happened during login
./state-viewer view latest

# Check emails using the logged-in session
./browser-use "Check my latest 5 emails and summarize them"

# Compare states before and after checking emails
./state-viewer list  # See both state files

# Extract screenshots to see visual differences
./state-viewer screenshot latest --output after_emails.png
```

### Research & Data Collection Workflow
```bash
# Start research session
./browser-use "Search for 'best Python web frameworks 2024' on Google"

# Navigate through results and capture state at each step
./browser-use "Click on the first result and read the article"
./browser-use "Go back and check the second result"
./browser-use "Compare the frameworks mentioned"

# Investigate collected data
./state-viewer list --limit 5
./state-viewer view latest  # See the final comparison state

# Extract all screenshots for review
for file in ~/.config/browseruse/browser_states/browser_state_*.json; do
    ./state-viewer screenshot "$file"
done
```

### E-commerce & Shopping Workflow
```bash
# Shopping comparison with state tracking
./browser-use "Compare iPhone 15 prices on Amazon and Best Buy"

# Investigate the comparison results
./state-viewer view latest
# Check captured storage for any cart/session data

# Continue shopping with decision
./browser-use "Add the cheaper iPhone to my cart"

# Verify cart state was captured
./state-viewer view latest
# Look for localStorage/sessionStorage with cart info

# Extract screenshots of the shopping journey
./state-viewer screenshot latest --output final_cart.png
```

### Testing & QA Workflow
```bash
# Test a login flow with state verification
./browser-use "Go to staging.example.com and login with test credentials"

# Verify login was successful by checking state
./state-viewer view latest
# Look for authentication cookies/tokens in the captured state

# Test form submission
./browser-use "Fill out the contact form with test data and submit"

# Investigate form submission state
./state-viewer view latest
# Check for success indicators, error states, or navigation changes

# Extract error states for debugging
./state-viewer screenshot latest --output form_submit_result.png
```

### Debugging Failed Tasks
```bash
# Run a task that might fail
./browser-use "Navigate to broken-site.com and find the login button"

# If the task fails, state is still captured with FAILED_ prefix
./state-viewer list | grep FAILED

# Investigate the failure
./state-viewer view latest

# The error state will contain:
# - Page state at time of failure
# - Error messages and stack traces
# - Screenshots showing what the AI "saw"
# - DOM snapshot for debugging element selectors
```

## 🕵️ State Investigation Tips

### Quick Analysis Commands
```bash
# Get a quick overview of recent activity
./state-viewer list

# See what the AI accomplished in the latest task
./state-viewer view latest | head -20

# Check if login/authentication succeeded
./state-viewer view latest | grep -A 10 "cookies"

# Look for error states
./state-viewer list | grep ERROR

# Get visual confirmation with screenshots
./state-viewer screenshot latest
```

### JSON Investigation
```bash
# View raw state data
cat ~/.config/browseruse/browser_states/browser_state_*.json | jq .

# Extract specific information
cat ~/.config/browseruse/browser_states/browser_state_*.json | jq '.page_info.url'
cat ~/.config/browseruse/browser_states/browser_state_*.json | jq '.storage.cookies'
cat ~/.config/browseruse/browser_states/browser_state_*.json | jq '.dom_snapshot.forms'

# Check performance metrics
cat ~/.config/browseruse/browser_states/browser_state_*.json | jq '.performance'
```

### Service Management

```bash
# Check service status
curl -s http://localhost:8765/status | jq .

# Manual service control (advanced)
../../.venv/bin/python src/browser_service.py  # Start manually
pkill -f browser_service.py                   # Stop manually
```

## 🔧 Configuration

### Default Settings

- **Mode**: Service mode (persistent sessions)
- **Visibility**: Visible browser (not headless)
- **Profile**: `~/.config/browseruse/profiles/google_account_persistent`
- **Service Port**: 8765
- **LLM**: Google Gemini 1.5 Flash

### Customization

Edit `src/browser_service.py` or `src/cli.py` to modify:
- Profile directory location
- Service port
- LLM model
- Default headless/visible mode

## 🛠️ Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check if port is in use
lsof -i :8765
# Kill existing service
pkill -f browser_service.py
```

**Browser conflicts after improper shutdown:**
```bash
# Kill hanging browser processes
pgrep -f "user-data-dir=/Users/$USER/.config/browseruse" | xargs kill -TERM
```

**Virtual environment issues:**
```bash
# Verify venv exists and has dependencies
ls ../../.venv/bin/python
../../.venv/bin/pip list | grep browser-use
```

**API key not found:**
```bash
# Check environment file
cat ../../config/.env | grep GOOGLE_API_KEY
```

### Debug Mode

```bash
# Run service manually to see detailed logs
../../.venv/bin/python src/browser_service.py

# Check service logs
curl -s http://localhost:8765/status
```

## 🔄 Updating Browser-Use

The tool uses browser-use as a dependency, so updates are easy:

### Automatic Updates (Recommended)
```bash
cd ../..  # Go to project root
source .venv/bin/activate
pip install --upgrade browser-use
pip freeze > requirements.txt
```

### Check for Updates
```bash
pip list --outdated | grep browser-use
```

### Version Information
```bash
# Check current version
./browser-use "Navigate to google.com"  # Shows version in output
# or
../../.venv/bin/pip show browser-use
```

## 🏗️ Architecture

### Components

- **`browser-use`** - Main wrapper script with auto-venv activation
- **`src/cli.py`** - Command-line interface and argument parsing
- **`src/browser_service.py`** - FastAPI service for session persistence
- **`src/persistent_browser_wrapper.py`** - Core wrapper extending browser-use
- **`test_wrapper.py`** - Test script for validation

### How It Works

1. **CLI Command** → Checks if service is running
2. **Service Auto-Start** → Launches FastAPI service if needed
3. **Wrapper Creation** → Creates persistent browser session
4. **Task Execution** → Uses browser-use Agent with injected session
5. **Session Persistence** → Browser stays open, service keeps running
6. **Clean Shutdown** → Properly closes browser when service stops

### Browser-Use Integration

```python
# We extend browser-use components without copying code
class PersistentBrowserSession(BrowserSession):
    # Override lifecycle to prevent auto-cleanup
    
class PersistentBrowserWrapper:
    # Manage session, create browser-use Agents per task
    agent = Agent(task=task, llm=llm, browser_session=persistent_session)
    result = await agent.run()  # Full browser-use automation
```

## 📚 Examples

### Personal Automation
```bash
./browser-use "Check my Gmail and summarize unread emails"
./browser-use "Post a tweet about my latest project" 
./browser-use "Check my bank account balance"
```

### Research & Data Collection
```bash
./browser-use "Find the top 5 AI companies by funding in 2024"
./browser-use "Get the latest stock price for TSLA"
./browser-use "Research Python web frameworks and compare features"
```

### E-commerce & Shopping  
```bash
./browser-use "Find the best laptop under $1500 on Amazon"
./browser-use "Compare prices for iPhone 15 Pro across major retailers"
./browser-use "Add items to my wishlist on various shopping sites"
```

### Testing & QA
```bash
./browser-use "Test the login flow on our staging website"
./browser-use "Fill out the contact form with test data"
./browser-use "Navigate through the checkout process"
```

## 🤝 Contributing

The tool is designed to be maintenance-free by leveraging browser-use as a dependency. Most improvements come automatically through browser-use updates.

### Local Development
```bash
# Test changes
./browser-use --test-wrapper

# Run manual tests
../../.venv/bin/python test_wrapper.py
```

## 📄 License

This wrapper tool follows the same license as the browser-use library it extends.

## 🙏 Acknowledgments

Built on top of the excellent [browser-use](https://github.com/gregpr07/browser-use) library by @gregpr07. This tool simply adds persistent session management while preserving all of browser-use's powerful automation capabilities.

---

**🎯 Ready to automate? Start with `./browser-use --examples` to see what's possible!** 