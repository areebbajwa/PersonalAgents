**IMPORTANT:** Any new requirement/feedback/instruction from user during workflow must be added to Non-Negotiable User Requirements section of current todo file, then resume from --step 4.

# Workflow Instructions

## Workflow CLI Usage

"taskmode" → use workflow-cli task mode
"devmode" → use workflow-cli dev mode
"updatetodo" → add new requirement to Non-Negotiable User Requirements section of current todo file, then resume from --step 4

```bash
workflow-cli --project [name] --mode [dev|task] --step 1  # start
workflow-cli --project [name] --next                      # continue
```

Commands timeout after 2 minutes - background long tasks: `cmd > /tmp/log.txt 2>&1 &`
Never use sleep > 119 seconds

## AI Monitor (Auto Compliance Checking)

```bash
workflow-cli --start-ai-manager --project [name] --mode [dev|task]  # start monitor
workflow-cli --stop-ai-manager --project [name]                     # stop monitor
ai-manager-cli monitor-all                                          # view all active monitors
```

AI Monitor auto-starts with workflows and sends "ai-monitor:" prefixed guidance for violations.