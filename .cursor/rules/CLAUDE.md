# Workflow Management

Use `workflow-cli` to get step-by-step instructions:

```bash
# Start a new task/project
workflow-cli --project [task-name] --mode [dev|task|standard] --step 1

# Continue with same project (mode is remembered)
workflow-cli --project [task-name] --next

# Use custom workflow file
workflow-cli --workflow /path/to/custom-workflow.yaml --step 1
```

Each project maintains its own workflow state.