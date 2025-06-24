Whenever user mentions "taskmode", use workflow-cli with task mode STRICTLY.
Whenever user mentions "devmode", use workflow-cli with dev mode STRICTLY.

# Workflow Management

Use `workflow-cli` to get step-by-step instructions:

```bash
# Start a new task/project
workflow-cli --project [task-name] --mode [dev|task] --step 1

# Continue with same project (mode is remembered)
workflow-cli --project [task-name] --next

# Use custom workflow file
workflow-cli --workflow /path/to/custom-workflow.yaml --step 1
```

Each project maintains its own workflow state.