# Browser-Use CLI Tool

A command-line interface for automating web browsers using AI with **persistent browser sessions**. Built as a wrapper around the [browser-use](https://github.com/gregpr07/browser-use) library, this tool provides true session persistence while leveraging all of browser-use's proven automation capabilities.

## 🌟 Features

- **🔄 Persistent Browser Sessions** - Browser stays open between commands, maintaining login state and context
- **🤖 AI-Powered Automation** - Natural language descriptions converted to browser actions
- **🚀 Auto-Service Management** - Automatically starts/stops background service as needed
- **📱 Multiple Modes** - Service mode (persistent) or direct mode (one-off tasks)
- **👁️ Visible by Default** - See what's happening in the browser (headless mode available)
- **🔧 Zero Maintenance** - Uses browser-use as dependency, gets updates automatically
- **⚡ Fast Execution** - No browser startup delay after first command

## 🎯 Use Cases

Perfect for:
- **Multi-step workflows** - Log into sites once, run multiple automation tasks
- **Data collection** - Navigate complex sites while maintaining session state
- **Testing & QA** - Automated testing with real browser interactions
- **Personal automation** - Check emails, social media, manage accounts
- **Research tasks** - Gather information across multiple sites and pages

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

2. **Make the wrapper script executable:**
   ```bash
   chmod +x browser-use
   ```

3. **Set up your Google API key:**
   ```bash
   # In your project's config/.env file
   echo "GOOGLE_API_KEY=your_api_key_here" >> ../../config/.env
   ```

That's it! The wrapper script automatically activates the virtual environment and handles all dependencies.

## 🚀 Quick Start

### Basic Usage

```bash
# Navigate to the CLI directory
cd cli_tools/browser-use-cli

# Run a simple task (starts service automatically)
./browser-use "Navigate to google.com and search for AI news"

# Run another task (reuses same browser session)
./browser-use "Click on the first search result"

# Stop the service when done
./browser-use --stop-service
```

### Example Workflows

```bash
# Login workflow - browser stays open with logged-in state
./browser-use "Go to gmail.com and log into my account"
./browser-use "Check my latest emails and summarize them"
./browser-use "Compose an email to john@example.com"

# Research workflow
./browser-use "Search for Python tutorials on YouTube"  
./browser-use "Find the most popular tutorial and get its details"
./browser-use "Go to the channel and check subscriber count"

# Shopping workflow
./browser-use "Compare iPhone prices on Amazon and Best Buy"
./browser-use "Add the cheaper option to cart"
./browser-use "Proceed to checkout"
```

## 📋 Command Reference

### Basic Commands

```bash
# Run automation task (default: service mode + visible browser)
./browser-use "task description"

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
# Service Mode (DEFAULT) - persistent browser sessions
./browser-use "Log into Google"           # Browser stays open
./browser-use "Search for AI news"        # Reuses existing session
./browser-use "Check my Gmail"            # Still using same browser

# Direct Mode - browser closes after each task  
./browser-use --direct "Quick one-off task"

# Headless Mode - invisible browser
./browser-use --headless "Background data scraping"
./browser-use --direct --headless "Invisible one-off task"
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