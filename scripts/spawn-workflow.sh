#!/bin/bash
# Function to spawn any workflow mode in new tmux window
# Usage: spawn-workflow <project-name> <mode> [step]

spawn_workflow() {
    local PROJECT_NAME="$1"
    local WORKFLOW_MODE="$2"
    local WORKFLOW_STEP="${3:-1}"
    
    if [ -z "$PROJECT_NAME" ] || [ -z "$WORKFLOW_MODE" ]; then
        echo "Usage: spawn_workflow <project-name> <mode> [step]"
        echo "Example: spawn_workflow invoice-cli dev 1"
        echo "Example: spawn_workflow data-processor task 1"
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
        
        # Use yolo to create worktree and start Claude
        yolo \$PROJECT_NAME
    '"
    
    echo "✅ Spawned $WORKFLOW_MODE workflow for $PROJECT_NAME"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "1. Switch to window: tmux select-window -t '${WORKFLOW_MODE}-${PROJECT_NAME}'"
    echo "2. When Claude loads, run: workflow-cli --project $PROJECT_NAME --mode $WORKFLOW_MODE --step $WORKFLOW_STEP"
    echo ""
    echo "Task mode will now monitor for workflow completion..."
    
    # Monitor for workflow state file
    STATE_FILE="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/workflow_state_${PROJECT_NAME}.json"
    
    # Wait for manual start
    echo "Waiting for workflow to start (checking every 10 seconds)..."
    
    while [ ! -f "$STATE_FILE" ]; do
        sleep 10
        echo -n "."
    done
    
    echo ""
    echo "✅ Workflow started! Monitoring for completion..."
    
    while [ -f "$STATE_FILE" ]; do
        echo "[$(date +%H:%M)] Workflow still running..."
        sleep 30
    done
    
    echo "[$(date +%H:%M)] ✅ Workflow completed!"
}

# If script is run directly, execute the function
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    spawn_workflow "$@"
fi