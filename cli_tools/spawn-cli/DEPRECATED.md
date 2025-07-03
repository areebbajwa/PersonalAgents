# DEPRECATED - Use `workflow` instead

This tool has been replaced by the unified `workflow` CLI.

## Migration Guide

Old commands → New commands:
- `spawn-cli spawn <project> <mode> "task"` → `workflow spawn <project> <mode> "task"`
- `spawn-cli list` → `workflow list`
- `spawn-cli kill <project>` → `workflow kill <project>`

## Installation

```bash
cd ~/PersonalAgents/cli_tools/workflow
npm install
npm link
```

The old spawn-cli will continue to work but is no longer maintained.