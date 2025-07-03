# DEPRECATED - Use `workflow monitor` instead

This tool has been replaced by the unified `workflow` CLI's monitor commands.

## Migration Guide

Old commands → New commands:
- `ai-monitor-cli start <project>` → `workflow monitor start <project>`
- `ai-monitor-cli stop <project>` → `workflow monitor stop <project>`
- `ai-monitor-cli status` → `workflow monitor status`

## Installation

```bash
cd ~/PersonalAgents/cli_tools/workflow
npm install
npm link
```

The old ai-monitor-cli will continue to work but is no longer maintained.
AI monitoring is now integrated directly into the workflow system.