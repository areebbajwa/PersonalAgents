#!/bin/bash
# This file contains the tmux shortcuts to be added to ~/.zshrc

# Tmux shortcuts
# tr - attach to most recent tmux session
tr() {
    # Get the most recently active tmux session
    local recent_session=$(tmux list-sessions -F '#{session_last_attached} #{session_name}' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    
    if [[ -z "$recent_session" ]]; then
        echo "No tmux sessions found"
        return 1
    fi
    
    # Check if we're already in a tmux session
    if [[ -n "$TMUX" ]]; then
        echo "Already in tmux session. Use 'tmux switch-client -t $recent_session' to switch."
        return 1
    fi
    
    echo "Attaching to most recent session: $recent_session"
    tmux attach-session -t "$recent_session"
}

# Auto-cleanup old detached tmux sessions (24+ hours inactive)
tmux_cleanup_old_sessions() {
    local current_time=$(date +%s)
    local max_age=$((24 * 60 * 60))  # 24 hours in seconds
    
    # Only run if tmux server is running
    if ! tmux ls >/dev/null 2>&1; then
        return
    fi
    
    # Get all detached sessions with their activity times
    tmux list-sessions -F '#{session_attached} #{session_activity} #{session_name}' 2>/dev/null | while read attached activity name; do
        # Skip attached sessions (attached=1)
        if [[ "$attached" == "1" ]]; then
            continue
        fi
        
        # Calculate age
        local age=$((current_time - activity))
        
        # Kill if older than 24 hours
        if [[ $age -gt $max_age ]]; then
            echo "Cleaning up old tmux session: $name (inactive for $((age / 3600)) hours)"
            tmux kill-session -t "$name" 2>/dev/null
        fi
    done
}

# Note: Also add this line after tmux auto-start in .zshrc:
#     # Clean up old detached tmux sessions on startup
#     tmux_cleanup_old_sessions