# Global Cursor Rules Setup

This project includes a comprehensive set of development rules that can be used globally across all your Cursor projects while being tracked in git for version control.

## Overview

The global rules system works by:
1. **Storing rules in git**: The rules file is stored in this project's `.cursor/rules/` directory and tracked in version control
2. **Global symlink**: A symlink is created from `~/.cursor/rules/` to the project's rules file
3. **Automatic updates**: Any changes to the rules file are immediately available globally

## Setup

### Automatic Setup
Run the setup script from the project root:
```bash
./scripts/setup-global-cursor-rules.sh
```

### Manual Setup
If you prefer to set it up manually:
```bash
# Create global rules directory
mkdir -p ~/.cursor/rules

# Create symlink to project rules
ln -sf "$(pwd)/.cursor/rules/dev-mode.mdc" ~/.cursor/rules/dev-mode.mdc
```

## File Structure

```
PersonalAgents/
├── .cursor/rules/
│   └── dev-mode.mdc                   # ← Tracked in git
├── scripts/
│   └── setup-global-cursor-rules.sh   # ← Setup automation
└── docs/
    └── cursor-global-rules-setup.md   # ← This documentation

~/.cursor/rules/
└── dev-mode.mdc                       # ← Symlink to project file
```

## Benefits

✅ **Version Controlled**: Rules are tracked in git and can be updated/reverted  
✅ **Globally Available**: Rules apply to all Cursor projects automatically  
✅ **Single Source of Truth**: One file to maintain across all projects  
✅ **Team Sharing**: Rules can be shared via git repository  
✅ **Easy Updates**: Changes propagate immediately to all projects  

## Usage in Cursor

Once set up, the rules will be available in Cursor through:

1. **User Rules**: Copy the content to Cursor Settings > Rules for maximum compatibility
2. **Project Rules**: The symlinked file will be accessible in the global rules directory
3. **Auto-application**: Rules with `alwaysApply: true` will be automatically included

## Updating Rules

To update the rules:
1. Edit `.cursor/rules/dev-mode.mdc` in this project
2. Commit changes to git
3. Changes are immediately available globally via the symlink

## For New Projects

To use these rules in a new project:
1. Clone or copy the setup script to your new project
2. Run `./scripts/setup-global-cursor-rules.sh`
3. Or manually create the symlink as shown above

## Troubleshooting

### Symlink Issues
If the symlink isn't working:
```bash
# Check if symlink exists and points to correct location
ls -la ~/.cursor/rules/dev-mode.mdc

# Recreate symlink if needed
rm ~/.cursor/rules/dev-mode.mdc
ln -sf "/path/to/PersonalAgents/.cursor/rules/dev-mode.mdc" ~/.cursor/rules/dev-mode.mdc
```

### Rules Not Loading
If Cursor isn't loading the rules:
1. Check that the file has proper MDC frontmatter
2. Verify the symlink is working
3. Add content to User Rules in Cursor Settings as backup
4. Restart Cursor

## Rule Content

The rules include comprehensive development best practices covering:
- Test-Driven Development (TDD)
- Code quality standards
- Architecture patterns
- Performance optimization
- Error handling
- Documentation requirements
- Version control practices

See `.cursor/rules/dev-mode.mdc` for the complete rule set. 