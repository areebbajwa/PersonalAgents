#!/bin/bash
# Function to spawn any workflow mode in new tmux window with auto-command
# Usage: spawn-workflow-auto <project-name> <mode> [step]

spawn_workflow_auto() {
    local PROJECT_NAME="$1"
    local WORKFLOW_MODE="$2"
    local WORKFLOW_STEP="${3:-1}"
    
    if [ -z "$PROJECT_NAME" ] || [ -z "$WORKFLOW_MODE" ]; then
        echo "Usage: spawn_workflow_auto <project-name> <mode> [step]"
        echo "Example: spawn_workflow_auto invoice-cli dev 1"
        echo "Example: spawn_workflow_auto data-processor task 1"
        return 1
    fi
    
    # Create tmux window that:
    # 1. Creates/uses worktree via yolo
    # 2. Starts interactive Claude 
    # 3. Automatically sends workflow command after delay
    
    tmux new-window -d -n "${WORKFLOW_MODE}-${PROJECT_NAME}" "zsh -c '
        source ~/.zshrc
        
        # Set variables
        PROJECT_NAME=\"$PROJECT_NAME\"
        WORKFLOW_MODE=\"$WORKFLOW_MODE\"
        WORKFLOW_STEP=\"$WORKFLOW_STEP\"
        
        echo \"=== Spawning $WORKFLOW_MODE Workflow for $PROJECT_NAME ===\"
        echo \"\"
        echo \"Will auto-run: workflow-cli --project \$PROJECT_NAME --mode \$WORKFLOW_MODE --step \$WORKFLOW_STEP\"
        echo \"\"
        
        # Use yolo to create worktree and start Claude
        yolo \$PROJECT_NAME
    '"
    
    # Wait for Claude to start, then send the workflow command
    echo "⏳ Waiting for Claude to start..."
    sleep 15
    
    # Send the workflow command to the Claude session (same way AI Monitor does it)
    echo "📤 Sending workflow command..."
    
    # First send the command text
    tmux send-keys -t "${WORKFLOW_MODE}-${PROJECT_NAME}" "workflow-cli --project $PROJECT_NAME --mode $WORKFLOW_MODE --step $WORKFLOW_STEP"
    
    # Then send Enter as a separate command
    tmux send-keys -t "${WORKFLOW_MODE}-${PROJECT_NAME}" 'Enter'
    
    echo "✅ Spawned $WORKFLOW_MODE workflow for $PROJECT_NAME"
    echo "✅ Workflow command sent automatically"
    echo ""
    echo "📋 TO CHECK PROGRESS:"
    echo "Switch to window: tmux select-window -t '${WORKFLOW_MODE}-${PROJECT_NAME}'"
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
    spawn_workflow_auto "$@"
fi