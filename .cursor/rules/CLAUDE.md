**IMPORTANT:** When user provides new requirements during workflow, update the Non-Negotiable User Requirements section and jump to the 'plan' step.

# Workflow Instructions

## Workflow CLI Usage

### Quick Commands
- **"taskmode"** → Start task mode workflow: `workflow-cli --project [name] --mode task --step 1`
- **"devmode"** → Start dev mode workflow: `workflow-cli --project [name] --mode dev --step 1`
- **"updatetodo"** → When user gives new requirements:
  1. Add to Non-Negotiable User Requirements section in todo file
  2. Jump to planning: `workflow-cli --project [name] --set-step 5`

### Navigation Commands
```bash
workflow-cli --project [name] --mode [dev|task] --step 1    # start new workflow
workflow-cli --project [name] --next                        # continue to next step
workflow-cli --project [name] --set-step [number]           # jump to specific step
workflow-cli --project [name] --sub-task-next               # mark test passed, continue
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
workflow-cli --start-ai-monitor     # start monitor (auto-detects everything)
workflow-cli --stop-ai-monitor      # stop monitor (auto-detects project)
```

AI Monitor auto-starts with workflows and sends "ai-monitor:" prefixed guidance for violations.