**IMPORTANT:** When user provides new requirements during workflow, update the Non-Negotiable User Requirements section and jump to the 'plan' step.

# Workflow Instructions

## IMPORTANT: Command Execution vs Interpretation

### When you see "run command: [command] and follow the instructions"
This is a DIRECT EXECUTION instruction. Execute the command exactly as given AND follow any workflow instructions that appear:
- **"run command: workflow task 'description' and follow the instructions"** → Execute `workflow task "description"` directly AND follow the workflow steps
- **"run command: workflow dev 'description' and follow the instructions"** → Execute `workflow dev "description"` directly AND follow the workflow steps
- DO NOT spawn a new workflow when you see "run command:"
- This is used by the spawn system to start workflows inside Claude Code sessions
- After executing the command, follow the workflow instructions that appear (e.g., run `workflow continue [project]` when instructed)

### When the user gives natural language instructions
These require interpretation and action:
- **"spawn taskmode with task: 'description'"** → Spawn with task: `workflow spawn [name] task "description"`
- **"spawn devmode with task: 'description'"** → Spawn with task: `workflow spawn [name] dev "description"`
- **"start devmode with task: 'description'"** → Start with task: `workflow start [name] dev "description"`
- **"start taskmode with task: 'description'"** → Start with task: `workflow start [name] task "description"`

## Workflow CLI Usage (Unified Commands)

### Quick Commands
- **"updatetodo"** → When user gives new requirements:
  1. Add to Non-Negotiable User Requirements section in todo file. Add to existing requirements, don't replace! Only replace what contradicts new requirements.
  2. Jump to planning: `workflow set-step [name] plan`
- **"remind rules"** → Display workflow rules and guidelines: `workflow remind-rules [project]`

### Starting Workflows (Within Spawned Sessions)
```bash
workflow dev "task description"              # start dev mode workflow
workflow task "task description"             # start task mode workflow
```

### Navigation Commands
```bash
workflow spawn [name] [dev|task] "task description"  # spawn new workflow in tmux window
workflow spawn [name] [dev|task] "description" --no-monitor  # spawn without AI monitor
workflow next                                        # continue to next step
workflow set-step [name] [number|name]              # jump to specific step
workflow sub-task-next                              # mark test passed, continue
```

### Project Management
```bash
workflow list                                        # list all workflows
workflow kill [name]                                # kill a workflow
workflow status [name]                              # check workflow status
workflow spawn [name] [dev|task] "description" --no-monitor  # spawn without AI monitor
```

### Dev Mode Steps (with names)
1. **announce** - Announce dev mode activation
2. **setup** - Check todo & git setup
3. **research** - Consult knowledge base
4. **simplify** - Apply 5-step simplification
5. **plan** - Create test-gated todo plan
6. **implement** - Build & test incrementally
7. **cleanup** - Clean up environment
8. **verify** - Final requirements check
9. **merge** - Auto-merge to main
10. **finish** - Clean project state

Commands timeout after 2 minutes - background long tasks: `cmd > /tmp/log.txt 2>&1 &`
Never use sleep > 119 seconds

## AI Monitor (Auto Compliance Checking)

```bash
workflow monitor start              # start monitor (auto-detects everything)
workflow monitor stop               # stop monitor (auto-detects project)
workflow monitor stop-all           # stop all running AI monitors
workflow monitor status             # check monitor status
workflow monitor check [project]    # force immediate AI compliance check (no 60s wait)
```

AI Monitor auto-starts with all workflows (dev and task modes) and sends "ai-monitor:" prefixed guidance for violations. Use --no-monitor to disable auto-start.

Note: If starting with `yolo [project-name]`, workflow auto-detects project from worktree directory.

## Coding Guidelines ##

- Never duplicate any code or create any redundancy. Update/delete/refactor as needed.