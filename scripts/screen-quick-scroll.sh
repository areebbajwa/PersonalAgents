#!/bin/bash
# Quick scroll helper for GNU Screen
# Sends commands to screen to scroll without staying in copy mode

# Get the direction from argument
direction=$1

# Get current screen session
SESSION=$(screen -ls | grep -E "Attached|Detached" | head -1 | awk '{print $1}')

if [ -z "$SESSION" ]; then
    echo "No screen session found"
    exit 1
fi

# Send commands to screen
case "$direction" in
    "up")
        # Enter copy mode, scroll up, exit
        screen -S "$SESSION" -X eval "copy" "stuff ^b" "stuff q"
        ;;
    "down")
        # Enter copy mode, scroll down, exit
        screen -S "$SESSION" -X eval "copy" "stuff ^f" "stuff q"
        ;;
    *)
        echo "Usage: $0 [up|down]"
        exit 1
        ;;
esac