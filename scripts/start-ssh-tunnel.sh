#!/bin/bash

# Start ngrok SSH tunnel for iOS access
echo "Starting ngrok SSH tunnel for remote iOS access..."
echo "=========================================="
echo ""

# Start the tunnel
ngrok tcp --region=us --remote-addr=7.tcp.ngrok.io:21775 22 &

# Wait a moment for ngrok to start
sleep 3

echo ""
echo "SSH tunnel is now active!"
echo "=========================================="
echo ""
echo "To connect from your iOS device, use:"
echo ""
echo "Host: 7.tcp.ngrok.io"
echo "Port: 21775"
echo "Username: $(whoami)"
echo ""
echo "Example SSH command:"
echo "ssh $(whoami)@7.tcp.ngrok.io -p 21775"
echo ""
echo "=========================================="
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Keep the script running
wait