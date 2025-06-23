# Workflow CLI Tool

A CLI tool to help AI assistants navigate complex workflows by presenting only the relevant rules and steps for the current task.

## Purpose

When working with complex workflow documents, AI assistants can lose track of what's important. This tool:
- Shows only the rules relevant to the current step
- Tracks progress through multi-step workflows
- Maintains separate state for each project/task
- Provides clear navigation through dev/task/standard modes

## Installation

The tool is already installed globally as `workflow-cli` via symlink.

## Project-Based Usage

Each project maintains its own workflow state for better isolation:

### Start a new project
```bash
# Start with a specific mode
workflow-cli --project bug-fix-123 --mode dev --step 1
workflow-cli --project new-feature --mode task --step 1
workflow-cli --project general-work --mode standard --step 1
```

### Continue with existing project
```bash
# Mode is remembered automatically
workflow-cli --project bug-fix-123 --next
workflow-cli --project new-feature --next

# Check current state
workflow-cli --project bug-fix-123 --json

# Jump to specific step
workflow-cli --project bug-fix-123 --set-step 3
```

### Track test execution
```bash
workflow-cli --project bug-fix-123 --track-test test_user_login passed
```

### Reset project state
```bash
workflow-cli --project bug-fix-123 --reset
```

## How AI Should Use This Tool

1. **At the start of any task**, create a project:
   ```bash
   # User says: "help me fix this login bug in dev mode"
   workflow-cli --project login-bug-fix --mode dev --step 1
   ```

2. **After completing each step**:
   ```bash
   # Mode is remembered, just advance
   workflow-cli --project login-bug-fix --next
   ```

3. **To track test results**:
   ```bash
   workflow-cli --project login-bug-fix --track-test login_test passed
   ```

4. **Working on multiple projects**:
   ```bash
   # Switch between projects seamlessly
   workflow-cli --project bug-fix --next
   workflow-cli --project feature-x --next
   workflow-cli --project bug-fix --next
   ```

## Workflow Files

The tool reads YAML workflow files from `workflows/`:
- `dev-mode.yaml` - Development workflow with git, testing, and code practices
- `task-mode.yaml` - Task planning and execution workflow  
- `standard.yaml` - Default assistant behavior workflow

## State Management

Project states are stored in `state/workflow_state_[project-name].json` and include:
- Current mode and step
- Completed steps  
- Test tracking information

Each project gets its own isolated state file for better organization.

## File Structure

```
workflow-cli/
├── workflow-cli.py          # Main CLI tool
├── workflows/               # YAML workflow definitions
│   ├── dev-mode.yaml
│   ├── task-mode.yaml
│   └── standard.yaml
├── state/                   # Project state files (gitignored)
│   ├── workflow_state_bug-fix.json
│   └── workflow_state_feature-x.json
├── test_workflow_cli.py     # Test suite
├── README.md               # This file
└── .gitignore              # Excludes state files

```

## Testing

Run tests with:
```bash
cd cli_tools/workflow-cli
python3 test_workflow_cli.py
```

All tests should pass. The test suite verifies:
- Help command functionality
- Project state management
- Mode navigation
- Step advancement
- Test tracking
- JSON output formatting