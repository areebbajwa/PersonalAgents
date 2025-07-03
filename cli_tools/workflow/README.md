# Workflow CLI

Unified workflow management system that combines spawn-cli, workflow-cli, and ai-monitor-cli into a single, streamlined tool.

## Features

- **Unified State Management**: Single state store for all workflow data
- **Direct Spawning**: Launch workflows in new terminals without complex tmux orchestration
- **Integrated AI Monitoring**: Built-in compliance monitoring with Gemini AI
- **Simplified Architecture**: No more inter-process communication issues
- **Consistent Paths**: Always uses absolute paths from ~/PersonalAgents

## Installation

```bash
cd ~/PersonalAgents/cli_tools/workflow
npm install
npm link
```

## Usage

```bash
# Spawn a new workflow in a separate terminal
workflow spawn <project> <mode> "task description"

# Start a workflow in current terminal
workflow start <project> <mode> "task description"

# Continue to next step
workflow next

# List active workflows
workflow list

# Kill a workflow
workflow kill <project>

# AI Monitor commands
workflow monitor start [project]
workflow monitor stop [project]
workflow monitor status
```

## Architecture

The unified workflow system combines:
- **State Management**: Single JSON state file per project
- **Workflow Engine**: Step-based workflow execution
- **Spawn System**: Direct terminal spawning without tmux
- **AI Monitor**: Integrated compliance monitoring

## Migration

Existing workflows will be automatically migrated when first accessed.