"taskmode" → use workflow-cli task mode
"devmode" → use workflow-cli dev mode

```bash
workflow-cli --project [name] --mode [dev|task] --step 1  # start
workflow-cli --project [name] --next                      # continue
```

Commands timeout after 2 minutes - background long tasks: `cmd > /tmp/log.txt 2>&1 &`
Never use sleep > 119 seconds