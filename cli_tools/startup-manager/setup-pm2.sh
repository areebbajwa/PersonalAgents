#!/bin/bash

echo "Setting up Startup Manager with PM2..."

# Create necessary directories
mkdir -p ~/.startup-manager/logs

# Stop and delete existing startup-manager if it exists
pm2 delete startup-manager 2>/dev/null || true
pm2 delete ecosystem.config 2>/dev/null || true

# Start startup manager with PM2
pm2 start /usr/bin/python3 \
  --name startup-manager \
  --cwd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents \
  --error /Users/areeb2/.startup-manager/logs/startup-manager-error.log \
  --output /Users/areeb2/.startup-manager/logs/startup-manager-out.log \
  --restart-delay 300000 \
  --max-restarts 3 \
  -- /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/startup-manager/startup-manager.py start

# Save PM2 configuration
pm2 save

echo "✅ Startup Manager configured with PM2"
echo ""
echo "To view logs: pm2 logs startup-manager"
echo "To view status: pm2 status"
echo ""
echo "The startup manager will automatically run all enabled tasks when PM2 starts."