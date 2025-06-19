#!/bin/bash

# Setup script for weekly TD data update cron job

SCRIPT_PATH="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py"
LOG_DIR="/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/logs"
LOG_FILE="$LOG_DIR/weekly_td_update.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Cron job to run every Sunday at 2:00 AM
CRON_JOB="0 2 * * 0 /usr/bin/python3 $SCRIPT_PATH >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo "Cron job for TD weekly update already exists."
    echo "Current cron jobs:"
    crontab -l | grep "$SCRIPT_PATH"
else
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added successfully!"
    echo "The TD data update will run every Sunday at 2:00 AM"
    echo "Logs will be saved to: $LOG_FILE"
fi

echo ""
echo "To view all cron jobs: crontab -l"
echo "To edit cron jobs: crontab -e"
echo "To remove this cron job: crontab -l | grep -v '$SCRIPT_PATH' | crontab -"
echo ""
echo "To test the script manually, run:"
echo "python3 $SCRIPT_PATH"