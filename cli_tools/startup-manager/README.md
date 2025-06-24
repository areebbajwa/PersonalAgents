# Startup Manager CLI

A command-line tool to manage custom startup tasks and services on macOS using PM2.

## Installation

1. The tool is already installed at: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/startup-manager/startup-manager`

2. To enable automatic startup with PM2:
   ```bash
   cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/startup-manager
   ./setup-pm2.sh
   ```

3. PM2 will automatically resurrect the startup manager when your system boots (assuming PM2 is configured to start at boot)

## Usage

### List all tasks
```bash
startup-manager list
startup-manager list --all  # Include disabled tasks
```

### Enable/Disable tasks
```bash
startup-manager enable <task-id>
startup-manager disable <task-id>
```

### Add a new task
```bash
# One-time task
startup-manager add my-task "My Task" "/path/to/script.sh"

# Daemon task (keeps running)
startup-manager add my-daemon "My Daemon" "/path/to/daemon.sh" -t daemon

# Scheduled task
startup-manager add my-cron "My Cron Job" "/path/to/cron.sh" -t scheduled -s "Mon 10:00"
```

### Remove a task
```bash
startup-manager remove <task-id>
```

### Run a specific task manually
```bash
startup-manager run <task-id>
```

### Start all enabled tasks
```bash
startup-manager start
```

### Check task status
```bash
startup-manager status
```

### View logs
```bash
startup-manager logs              # List recent log files
startup-manager logs <task-id>    # View logs for specific task
startup-manager logs <task-id> -n 100  # View last 100 lines
```

## Task Types

- **once**: Runs once when startup manager starts
- **daemon**: Long-running process that stays active
- **scheduled**: Runs on a schedule (not implemented in current version)

## Configuration

Configuration is stored at: `~/.startup-manager/config.json`
Logs are stored at: `~/.startup-manager/logs/`

## Default Tasks

The tool comes pre-configured with these tasks:
- Chrome Health Monitor
- Ngrok SSH Tunnel
- PM2 Process Manager
- Screen Session Cleanup
- TD Bank Weekly Update

## PM2 Management

The startup manager runs under PM2. Useful commands:

```bash
# View startup manager status
pm2 status startup-manager

# View logs
pm2 logs startup-manager

# Restart startup manager
pm2 restart startup-manager

# Stop startup manager
pm2 stop startup-manager

# Start startup manager
pm2 start startup-manager
```

## Replacing Individual LaunchAgents

To replace existing LaunchAgents with the startup manager:

1. Disable the old LaunchAgent:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.user.old-service.plist
   ```

2. Add the task to startup manager:
   ```bash
   startup-manager add old-service "Old Service" "/path/to/service.sh" -t daemon
   ```

3. Optionally remove the old plist file:
   ```bash
   rm ~/Library/LaunchAgents/com.user.old-service.plist
   ```

4. The startup manager will handle running the service via PM2