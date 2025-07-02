#!/bin/bash
# Function to spawn any workflow mode in new tmux window (non-blocking)
# Usage: spawn-workflow-async <project-name> <mode> [step]

spawn_workflow_async() {
    local PROJECT_NAME="$1"
    local WORKFLOW_MODE="$2"
    local WORKFLOW_STEP="${3:-1}"
    
    if [ -z "$PROJECT_NAME" ] || [ -z "$WORKFLOW_MODE" ]; then
        echo "Usage: spawn_workflow_async <project-name> <mode> [step]"
        echo "Example: spawn_workflow_async invoice-cli dev 1"
        echo "Example: spawn_workflow_async data-processor task 1"
        return 1
    fi
    
    # Create tmux window that:
    # 1. Creates/uses worktree
    # 2. Starts interactive Claude 
    # 3. User manually runs workflow command
    
    tmux new-window -d -n "${WORKFLOW_MODE}-${PROJECT_NAME}" "zsh -c '
        source ~/.zshrc
        
        # Set variables
        PROJECT_NAME=\"$PROJECT_NAME\"
        WORKFLOW_MODE=\"$WORKFLOW_MODE\"
        WORKFLOW_STEP=\"$WORKFLOW_STEP\"
        
        echo \"=== Spawning $WORKFLOW_MODE Workflow for $PROJECT_NAME ===\"
        echo \"\"
        echo \"When Claude loads, run:\"
        echo \"workflow-cli --project \$PROJECT_NAME --mode \$WORKFLOW_MODE --step \$WORKFLOW_STEP\"
        echo \"\"
        
        # Use yolo to create worktree and start Claude
        yolo \$PROJECT_NAME
    '"
    
    echo "✅ Spawned $WORKFLOW_MODE workflow for $PROJECT_NAME in background"
    echo ""
    echo "📋 TO START THE WORKFLOW:"
    echo "1. Switch to window: tmux select-window -t '${WORKFLOW_MODE}-${PROJECT_NAME}'"
    echo "2. Run: workflow-cli --project $PROJECT_NAME --mode $WORKFLOW_MODE --step $WORKFLOW_STEP"
    echo ""
    echo "📊 TO CHECK STATUS:"
    echo "Check if running: ls /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/workflow_state_${PROJECT_NAME}.json"
    echo ""
    echo "Task mode can continue working while the spawned workflow runs in parallel."
}

# Function to check if a spawned workflow is complete
check_workflow_status() {
    local PROJECT_NAME="$1"
    
    if [ -z "$PROJECT_NAME" ]; then
        echo "Usage: check_workflow_status <project-name>"
        return 1
    fi
    
    STATE_FILE="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/workflow_state_${PROJECT_NAME}.json"
    
    if [ -f "$STATE_FILE" ]; then
        echo "🔄 Workflow '$PROJECT_NAME' is still running"
        return 1
    else
        echo "✅ Workflow '$PROJECT_NAME' is complete (or not started)"
        return 0
    fi
}

# If script is run directly, execute the function
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    spawn_workflow_async "$@"
fi