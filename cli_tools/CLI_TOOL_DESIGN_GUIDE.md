# CLI Tool Design Guide

This guide outlines the standards and best practices for creating CLI tools in the PersonalAgents project.

## Core Principles

1. **Consistency**: All CLI tools should follow the same patterns
2. **Discoverability**: Tools should be self-documenting and easy to understand
3. **Global Access**: Tools should be accessible from any directory after setup
4. **User-Friendly**: Show help when required arguments are missing

## Directory Structure

```
cli_tools/
├── tool-name/
│   ├── tool-name         # Main executable (matches directory name)
│   ├── src/              # Source code (if applicable)
│   ├── package.json      # For Node.js tools
│   └── requirements.txt  # For Python tools
```

## Naming Conventions

### Directory Name = Command Name
- Directory: `cli_tools/screenshot-cli/`
- Executable: `screenshot-cli`
- Command usage: `screenshot-cli [options]`

### Naming Rules
- Use lowercase with hyphens (kebab-case)
- Include `-cli` suffix for clarity
- Keep names short but descriptive

## Executable Requirements

### 1. Shebang Line
Every executable must start with appropriate shebang:
```bash
#!/usr/bin/env python3    # For Python
#!/usr/bin/env node       # For Node.js
#!/bin/bash               # For Bash scripts
```

### 2. Executable Permissions
```bash
chmod +x tool-name
```

### 3. Help Display Rules

#### Tools WITH Required Arguments
Show help when arguments are missing:
```python
if len(sys.argv) < 2:
    show_help()
    sys.exit(1)
```

#### Tools WITHOUT Required Arguments
Execute default behavior directly:
```python
# Example: a tool that lists current tasks
if __name__ == "__main__":
    list_tasks()  # Don't show help, just run
```

### 4. Help Flag Support
Always support `-h` and `--help`:
```python
if "-h" in sys.argv or "--help" in sys.argv:
    show_help()
    sys.exit(0)
```

### 5. Wrapper Script for Symlink Support
When using a bash wrapper for Python/Node scripts, ensure it resolves symlinks correctly:
```bash
#!/bin/bash
# Wrapper script that works with symlinks

# Find the real location of this script (resolving symlinks)
if [ -L "${BASH_SOURCE[0]}" ]; then
    # It's a symlink, resolve it
    SCRIPT_PATH="$(readlink "${BASH_SOURCE[0]}")"
    SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
else
    # Not a symlink, use normal method
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
fi

# Execute the actual script with all arguments
exec python3 "$SCRIPT_DIR/script_name.py" "$@"
```

## Implementation Patterns

### Python Tools
```python
#!/usr/bin/env python3

import sys
import argparse

def main():
    parser = argparse.ArgumentParser(
        description='Tool description',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  tool-name command1 arg1    # Description
  tool-name command2 --flag  # Description
        '''
    )
    
    # Add arguments
    parser.add_argument('command', help='Command to execute')
    
    # Parse args - will auto-show help if required args missing
    args = parser.parse_args()
    
    # Execute command
    if args.command == 'command1':
        do_something()

if __name__ == "__main__":
    main()
```

### Node.js Tools
```javascript
#!/usr/bin/env node

const { program } = require('commander');

program
  .name('tool-name')
  .description('Tool description')
  .version('1.0.0');

program
  .command('command1 <arg>')
  .description('Command description')
  .action((arg) => {
    // Do something
  });

// This will auto-show help if no command provided
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
```

### Bash Script Wrapper
For tools that need a wrapper:
```bash
#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check for required arguments
if [ $# -eq 0 ]; then
    echo "Usage: tool-name <command> [options]"
    echo "Run 'tool-name --help' for more information"
    exit 1
fi

# Handle help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    node "$SCRIPT_DIR/src/index.js" --help
    exit 0
fi

# Run the actual tool
node "$SCRIPT_DIR/src/index.js" "$@"
```

## Global Setup

The `scripts/setup-global-cli-tools.sh` script automatically:
1. Discovers all CLI tools in `cli_tools/`
2. Creates symlinks in `~/.local/bin/`
3. Makes tools globally accessible

### Requirements for Auto-Discovery
- Executable file must have the same name as its parent directory
- File must have executable permissions
- File must not be a common non-CLI file type

## Testing Guidelines

### Basic Test Suite
Every tool should be tested for:
1. Help display (when applicable)
2. Basic functionality
3. Error handling
4. Exit codes

### Test Script Template
```bash
#!/bin/bash
# test-tool-name.sh

echo "Testing tool-name..."

# Test 1: Help flag
echo "Test 1: Help flag"
tool-name --help
[ $? -eq 0 ] && echo "✓ Pass" || echo "✗ Fail"

# Test 2: Missing required args (should show help)
echo "Test 2: Missing args"
tool-name 2>&1 | grep -q "Usage:"
[ $? -eq 0 ] && echo "✓ Pass" || echo "✗ Fail"

# Test 3: Basic functionality
echo "Test 3: Basic command"
tool-name test-command
[ $? -eq 0 ] && echo "✓ Pass" || echo "✗ Fail"
```

## Common Patterns

### Configuration Files
- Store in `~/.config/tool-name/` or use environment variables
- Provide sensible defaults
- Document all configuration options

### Path Resolution Best Practices

**IMPORTANT**: CLI tools must work from ANY directory (main repo, worktrees, screen sessions, SSH, temp directories).

#### ❌ DON'T Use Relative Paths
```javascript
// BAD - breaks in worktrees/other directories
const config = require('../../../config/.env');
const serviceAccount = require('../../config/firebase-service-account.json');
```

#### ❌ DON'T Use process.cwd()
```javascript
// BAD - depends on where user runs the command
const configPath = path.join(process.cwd(), 'config', '.env');
```

#### ✅ DO Use Home Directory Symlink
```javascript
// GOOD - works from anywhere
const os = require('os');
const path = require('path');
const MAIN_REPO_PATH = path.join(os.homedir(), 'PersonalAgents');
const configPath = path.join(MAIN_REPO_PATH, 'config', '.env');
```

#### ✅ Python Example
```python
import os
MAIN_REPO_PATH = os.path.join(os.path.expanduser('~'), 'PersonalAgents')
config_path = os.path.join(MAIN_REPO_PATH, 'config', '.env')
```

#### Setup Requirement
The `~/PersonalAgents` symlink must exist and point to the main repository:
```bash
ln -s /path/to/PersonalAgents ~/PersonalAgents
```

#### Error Messages
When config files are not found, provide helpful error messages:
```javascript
if (!fs.existsSync(configPath)) {
    console.error('Config file not found');
    console.error(`Please ensure ~/PersonalAgents symlink points to your PersonalAgents repository`);
    process.exit(1);
}
```

### Output Formats
- Default to human-readable output
- Support `--json` flag for machine-readable output
- Use exit codes properly (0 for success, non-zero for errors)

### Error Handling
- Provide clear error messages
- Suggest solutions when possible
- Use appropriate exit codes

## Examples of Well-Designed Tools

### gmail-cli
- ✅ Executable matches directory name
- ✅ Shows comprehensive help
- ✅ Clear command structure
- ✅ Good error messages

### workflow-cli
- ✅ Clear argument structure
- ✅ State management
- ✅ Multiple output formats (--json)

## Test Scripts and Dependencies

### Test Script Requirements
**IMPORTANT**: Test scripts MUST use the main PersonalAgents directory for all CLI tools.

```bash
# Always define this at the top of test scripts
MAIN_REPO_DIR="$HOME/PersonalAgents"

# Use this for all tool paths
local tool_path="$MAIN_REPO_DIR/cli_tools/$tool/$tool"
```

### Dependency Management
1. **Install dependencies only in main repository**
   - Never install npm dependencies in worktrees
   - All tools reference the main ~/PersonalAgents directory

2. **Avoid native module dependencies**
   - Native modules like sqlite3 can cause cross-platform issues
   - Consider pure JavaScript alternatives when possible

3. **Test from multiple directories**
   - Main repository
   - Home directory  
   - Temp directory
   - Worktrees

## Checklist for New Tools

- [ ] Directory name matches executable name
- [ ] Executable has correct shebang line
- [ ] File has executable permissions
- [ ] Shows help when required args are missing
- [ ] Supports -h and --help flags
- [ ] Has clear, helpful error messages
- [ ] Includes examples in help text
- [ ] Works from any directory after global setup
- [ ] Uses ~/PersonalAgents for all config/dependency paths
- [ ] Tested with basic test cases
- [ ] Test script uses MAIN_REPO_DIR="$HOME/PersonalAgents"
- [ ] Run `./scripts/setup-global-cli-tools.sh` to install globally