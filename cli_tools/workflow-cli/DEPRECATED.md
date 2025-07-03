# DEPRECATED - Use `workflow` instead

This tool has been replaced by the unified `workflow` CLI.

## Migration Guide

Old commands → New commands:
- `workflow-cli --project <name> --mode <mode> --step 1 --task "task"` → `workflow start <name> <mode> "task"`
- `workflow-cli --project <name> --next` → `workflow next <name>`
- `workflow-cli --project <name> --set-step <step>` → `workflow set-step <name> <step>`
- `workflow-cli --project <name> --sub-task-next` → `workflow sub-task-next <name>`
- `workflow-cli --project <name> --remind-rules` → `workflow remind-rules <name>`

## Installation

```bash
cd ~/PersonalAgents/cli_tools/workflow
npm install
npm link
```

The old workflow-cli will continue to work but is no longer maintained.
All state files are automatically migrated to the new format.