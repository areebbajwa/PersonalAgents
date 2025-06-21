# iOS SSH Remote Access Setup

## Overview
This guide documents how to access your Mac terminal remotely from an iOS device using ngrok.

## Connection Details

- **Host**: `7.tcp.ngrok.io`
- **Port**: `21775`
- **Username**: `areeb2` (your Mac username)

## Quick Start

1. **Start the SSH tunnel on your Mac**:
   ```bash
   cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents
   ./scripts/start-ssh-tunnel.sh
   ```

2. **Connect from your iOS device**:
   - Use any SSH client app (e.g., Termius, Prompt, Blink Shell)
   - Enter the connection details above
   - Or use the command: `ssh areeb2@7.tcp.ngrok.io -p 21775`

## iOS SSH Client Recommendations

1. **Termius** - User-friendly with good UI
2. **Blink Shell** - Powerful terminal emulator
3. **Prompt** - Clean interface from Panic

## Important Notes

- The tunnel must be running on your Mac for connections to work
- Your Mac must be awake and connected to the internet
- SSH (Remote Login) must remain enabled in System Settings
- The ngrok tunnel runs on your existing pay-as-you-go plan

## Alternative Command

If the script doesn't work, run directly:
```bash
ngrok tcp --region=us --remote-addr=7.tcp.ngrok.io:21775 22
```

## Security Considerations

- This exposes your SSH port to the internet through ngrok
- Use strong passwords or SSH keys for authentication
- Consider setting up SSH key authentication for better security
- Monitor access logs if needed

## Troubleshooting

- **Connection refused**: Make sure the tunnel is running on your Mac
- **Permission denied**: Check your username and password
- **Host unreachable**: Verify your Mac is online and ngrok is running