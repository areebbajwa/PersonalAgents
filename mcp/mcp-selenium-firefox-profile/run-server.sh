#!/bin/bash

# Create a log file for debugging
LOG_FILE="/tmp/selenium-mcp-debug.log"
echo "=== MCP Selenium Server Debug Log ===" > "$LOG_FILE"
echo "Timestamp: $(date)" >> "$LOG_FILE"
echo "Working directory: $(pwd)" >> "$LOG_FILE"

# Change to script directory
cd "$(dirname "$0")"
echo "Changed to: $(pwd)" >> "$LOG_FILE"

# Log environment
echo "Environment variables:" >> "$LOG_FILE"
env | grep -E "(NODE|PATH|HOME)" >> "$LOG_FILE"

# Check if node exists
echo "Node path: /Users/areeb2/.nvm/versions/node/v22.15.1/bin/node" >> "$LOG_FILE"
/Users/areeb2/.nvm/versions/node/v22.15.1/bin/node --version >> "$LOG_FILE" 2>&1

# Run the server with error capture
echo "Starting server..." >> "$LOG_FILE"
echo "Arguments: $@" >> "$LOG_FILE"

# Use exec to replace the shell process with node
exec /Users/areeb2/.nvm/versions/node/v22.15.1/bin/node server.js "$@" 2>> "$LOG_FILE"