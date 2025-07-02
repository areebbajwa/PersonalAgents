#!/bin/bash
# Function to spawn any workflow mode with task description
# Usage: spawn-workflow-with-task <project-name> <mode> <task-description> [step]

spawn_workflow_with_task() {
    local PROJECT_NAME="$1"
    local WORKFLOW_MODE="$2"
    local TASK_DESCRIPTION="$3"
    local WORKFLOW_STEP="${4:-1}"
    
    if [ -z "$PROJECT_NAME" ] || [ -z "$WORKFLOW_MODE" ] || [ -z "$TASK_DESCRIPTION" ]; then
        echo "Usage: spawn_workflow_with_task <project-name> <mode> <task-description> [step]"
        echo "Example: spawn_workflow_with_task invoice-cli dev \"create a CLI tool that generates PDF invoices\" 1"
        echo "Example: spawn_workflow_with_task bank-scraper task \"download all bank statements from Chase\" 1"
        return 1
    fi
    
    # Create tmux window that starts Claude WITHOUT creating worktree
    # The workflow itself will handle worktree creation with proper symlinks
    tmux new-window -d -n "${WORKFLOW_MODE}-${PROJECT_NAME}" "zsh -i -c '
        source ~/.zshrc
        
        # Set variables
        PROJECT_NAME=\"$PROJECT_NAME\"
        WORKFLOW_MODE=\"$WORKFLOW_MODE\"
        WORKFLOW_STEP=\"$WORKFLOW_STEP\"
        TASK_DESCRIPTION=\"$TASK_DESCRIPTION\"
        DATE_SUFFIX=\$(date +%Y%m%d)
        
        # Set environment variable to indicate this is a spawned workflow
        export SPAWN_WORKFLOW=1
        
        echo \"=== Spawning $WORKFLOW_MODE Workflow for $PROJECT_NAME ===\"
        echo \"Task: \$TASK_DESCRIPTION\"
        echo \"\"
        echo \"Starting Claude in main repository...\"
        echo \"The workflow will create its own worktree with proper symlinks.\"
        echo \"\"
        
        # Start Claude in the main PersonalAgents directory
        cd ~/PersonalAgents
        
        # Start Claude without creating worktree (workflow will handle it)
        /Users/areeb2/.claude/local/claude --dangerously-skip-permissions
        
        # After Claude exits, check if workflow completed
        echo \"\"
        echo \"Claude session ended. Checking workflow status...\"
        
        STATE_FILE=\"\$HOME/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_\${PROJECT_NAME}-\${DATE_SUFFIX}.json\"
        STATE_FILE_NO_DATE=\"\$HOME/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_\${PROJECT_NAME}.json\"
        
        if [ ! -f \"\$STATE_FILE\" ] && [ ! -f \"\$STATE_FILE_NO_DATE\" ]; then
            echo \"✅ Workflow completed successfully!\"
            echo \"Window will close in 5 seconds...\"
            sleep 5
        else
            echo \"⚠️  Workflow may not have completed. State file still exists.\"
            echo \"Press enter to close this window...\"
            read
        fi
    '"
    
    # Wait for Claude to start
    echo "⏳ Waiting for Claude to start..."
    sleep 15
    
    # Send the task context and workflow command
    echo "📤 Sending task context and workflow command..."
    
    # Send the workflow command with task and spawned flags
    COMMAND_TEXT="workflow-cli --project $PROJECT_NAME --mode $WORKFLOW_MODE --step $WORKFLOW_STEP --task '$TASK_DESCRIPTION' --spawned"
    
    # Send the command
    tmux send-keys -t "${WORKFLOW_MODE}-${PROJECT_NAME}" "$COMMAND_TEXT"
    tmux send-keys -t "${WORKFLOW_MODE}-${PROJECT_NAME}" 'Enter'
    
    echo "✅ Spawned $WORKFLOW_MODE workflow for $PROJECT_NAME"
    echo "✅ Task: $TASK_DESCRIPTION"
    echo ""
    echo "📋 TO CHECK PROGRESS:"
    echo "Switch to window: tmux select-window -t '${WORKFLOW_MODE}-${PROJECT_NAME}'"
    echo ""
    echo "📊 TO CHECK STATUS:"
    echo "Check if running: ls ~/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_${PROJECT_NAME}-$(date +%Y%m%d).json"
    echo ""
    echo "Task mode can continue working while the spawned workflow runs in parallel."
    echo "The tmux window will auto-close when the workflow completes."
}

# Function to check if a spawned workflow is complete (returns status, no error)
check_workflow_status() {
    local PROJECT_NAME="$1"
    
    if [ -z "$PROJECT_NAME" ]; then
        echo "Usage: check_workflow_status <project-name>"
        return 1
    fi
    
    # Check for state file with date suffix
    DATE_SUFFIX=$(date +%Y%m%d)
    STATE_DIR="$HOME/PersonalAgents/cli_tools/workflow-cli/state"
    STATE_FILE="${STATE_DIR}/workflow_state_${PROJECT_NAME}-${DATE_SUFFIX}.json"
    
    # Also check without date suffix in case of older workflows
    STATE_FILE_NO_DATE="${STATE_DIR}/workflow_state_${PROJECT_NAME}.json"
    
    if [ -f "$STATE_FILE" ] || [ -f "$STATE_FILE_NO_DATE" ]; then
        echo "🔄 Workflow '$PROJECT_NAME' is still running"
        # Return 0 (success) to avoid "error" message
        return 0
    else
        echo "✅ Workflow '$PROJECT_NAME' is complete (or not started)"
        return 0
    fi
}

# Function to wait for a workflow to complete
wait_for_workflow() {
    local PROJECT_NAME="$1"
    local CHECK_INTERVAL="${2:-30}"  # Default 30 seconds
    
    if [ -z "$PROJECT_NAME" ]; then
        echo "Usage: wait_for_workflow <project-name> [check-interval-seconds]"
        return 1
    fi
    
    echo "⏳ Waiting for workflow '$PROJECT_NAME' to complete..."
    echo "Checking every $CHECK_INTERVAL seconds..."
    
    # Check for state files
    DATE_SUFFIX=$(date +%Y%m%d)
    STATE_DIR="$HOME/PersonalAgents/cli_tools/workflow-cli/state"
    STATE_FILE="${STATE_DIR}/workflow_state_${PROJECT_NAME}-${DATE_SUFFIX}.json"
    STATE_FILE_NO_DATE="${STATE_DIR}/workflow_state_${PROJECT_NAME}.json"
    
    while [ -f "$STATE_FILE" ] || [ -f "$STATE_FILE_NO_DATE" ]; do
        echo -n "."
        sleep $CHECK_INTERVAL
    done
    
    echo ""
    echo "✅ Workflow '$PROJECT_NAME' completed!"
    return 0
}

# If script is run directly, execute the function
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    spawn_workflow_with_task "$@"
fi