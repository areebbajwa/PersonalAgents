# Global CLI Tools Setup

This project includes several powerful CLI tools that can be made globally available across all your projects via symlinks. This allows you to use these tools from anywhere on your system without needing to navigate to specific directories.

## 🛠️ Available CLI Tools

- **`browser-use`** - AI-powered browser automation with persistent sessions
- **`state-viewer`** - Browser state investigation and debugging tool
- **`gmail-cli`** - Gmail integration and email management
- **`automation`** - Desktop automation for macOS applications
- **`pdf-ai`** - PDF processing and AI analysis

## 🚀 Quick Setup

### Automatic Setup
Run the setup script from the project root:
```bash
./scripts/setup-global-cli-tools.sh
```

### Add to PATH (Required)
If `~/.local/bin` is not in your PATH, add this to your shell profile:

**For Zsh (.zshrc):**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**For Bash (.bashrc):**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## 📁 File Structure

```
PersonalAgents/
├── cli_tools/
│   ├── browser-use-cli/
│   │   ├── browser-use           # ← AI browser automation
│   │   └── state-viewer          # ← Browser state debugging
│   ├── gmail-cli/
│   │   └── gmail-cli             # ← Gmail management
│   ├── desktop-automation-cli/
│   │   └── automation            # ← Desktop automation
│   └── pdf-ai-cli/
│       └── pdf-ai                # ← PDF processing
├── scripts/
│   └── setup-global-cli-tools.sh # ← Setup automation
└── docs/
    └── global-cli-tools-setup.md # ← This documentation

~/.local/bin/
├── browser-use → /path/to/PersonalAgents/cli_tools/browser-use-cli/browser-use
├── state-viewer → /path/to/PersonalAgents/cli_tools/browser-use-cli/state-viewer
├── gmail-cli → /path/to/PersonalAgents/cli_tools/gmail-cli/gmail-cli
├── automation → /path/to/PersonalAgents/cli_tools/desktop-automation-cli/automation
└── pdf-ai → /path/to/PersonalAgents/cli_tools/pdf-ai-cli/pdf-ai
```

## ✨ Benefits

✅ **Global Accessibility** - Use tools from any directory on your system  
✅ **Always Up-to-Date** - Symlinks ensure you always use the latest version  
✅ **Single Source of Truth** - All tools maintained in one project  
✅ **Easy Updates** - Run setup script again to refresh symlinks  
✅ **No Duplication** - No need to copy tools to multiple projects  

## 🎯 Usage Examples

Once set up, you can use the tools from anywhere:

### Browser Automation
```bash
# From any directory
browser-use "Navigate to google.com and search for AI news"
state-viewer list  # View recent browser states
state-viewer view latest  # Investigate latest browser state
```

### Gmail Management
```bash
gmail-cli list  # List recent emails
gmail-cli search "project updates"  # Search emails
```

### Desktop Automation
```bash
automation --help  # See available automation commands
automation click-element "Submit Button"  # Automate macOS apps
```

### PDF Processing
```bash
pdf-ai extract document.pdf  # Extract text from PDF
pdf-ai analyze report.pdf  # AI analysis of PDF content
```

## 🔧 Script Features

The setup script includes:

- **Automatic Directory Creation** - Creates `~/.local/bin` if needed
- **PATH Validation** - Warns if `~/.local/bin` is not in PATH
- **Permission Management** - Ensures all tools are executable
- **Conflict Resolution** - Safely replaces existing symlinks
- **Comprehensive Logging** - Shows exactly what's happening
- **Status Verification** - Confirms all tools are working

## 🔄 Updating Tools

When you update the CLI tools in the project:

1. **Automatic Updates** - Symlinks automatically point to updated versions
2. **Refresh Symlinks** - Run the setup script again if needed:
   ```bash
   ./scripts/setup-global-cli-tools.sh
   ```

## 🛠️ Manual Management

### Add New Tools
To add a new CLI tool to the global setup:

1. Edit `scripts/setup-global-cli-tools.sh`
2. Add a new `setup_cli_tool` call:
   ```bash
   setup_cli_tool "new-tool-cli" "tool-name"
   ```
3. Add status check:
   ```bash
   check_tool_status "tool-name"
   ```

### Remove Tools
To remove a tool from global access:
```bash
rm ~/.local/bin/tool-name
```

### List Current Tools
```bash
ls -la ~/.local/bin/
```

## 🐛 Troubleshooting

### Command Not Found
If tools aren't accessible after setup:

1. **Check PATH**:
   ```bash
   echo $PATH | grep -o "$HOME/.local/bin"
   ```

2. **Add to PATH** (if missing):
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

3. **Restart Terminal** or source your shell profile

### Broken Symlinks
If symlinks are broken after moving the project:

1. **Re-run Setup**:
   ```bash
   ./scripts/setup-global-cli-tools.sh
   ```

2. **Check Symlink Status**:
   ```bash
   ls -la ~/.local/bin/
   ```

### Permission Issues
If tools aren't executable:

1. **Make Executable**:
   ```bash
   chmod +x cli_tools/*/executable-name
   ```

2. **Re-run Setup**:
   ```bash
   ./scripts/setup-global-cli-tools.sh
   ```

## 🎯 Integration with Other Projects

Once set up, these tools become available in all your projects:

```bash
# In any project directory
cd ~/my-other-project
browser-use "Automate testing workflow"
gmail-cli search "bug reports"
pdf-ai analyze requirements.pdf
```

## 🔧 Development Workflow

For developers working on the CLI tools:

1. **Make Changes** to tools in `cli_tools/`
2. **Test Changes** - Tools are immediately available globally
3. **No Re-installation** needed - symlinks update automatically
4. **Version Control** - All changes tracked in git

---

**🚀 Ready to use CLI tools globally? Run `./scripts/setup-global-cli-tools.sh` to get started!** 