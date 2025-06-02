# Chrome Launch Issues After Idle Time - Complete Solution

## Problem Description

**Issue**: Google Chrome fails to launch after the computer has been idle for an extended period (typically after sleep/wake cycles), requiring a full computer restart to resolve.

**Error Symptoms**:
- Chrome shows error `-600` when attempting to launch
- Chrome processes appear in Activity Monitor but application doesn't open
- Right-click on Chrome shows "Force Quit" option
- Browser window briefly appears then immediately closes

## Root Cause Analysis

The issue is caused by a combination of factors that occur when macOS goes through sleep/wake cycles:

1. **Singleton Lock Corruption**: Chrome uses singleton files to prevent multiple instances:
   - `SingletonCookie` - Process identification
   - `SingletonLock` - System-wide lock file  
   - `SingletonSocket` - IPC communication socket

2. **Orphaned Processes**: Chrome helper processes remain running but become unresponsive after system sleep

3. **LaunchServices Cache Corruption**: macOS launch services cache becomes stale after extended idle periods

4. **Sandbox Permission Issues**: Chrome's security sandbox can fail to initialize properly after wake

## Manual Fix (Immediate Solution)

When Chrome fails to launch, run this command in Terminal:

```bash
./scripts/fix_chrome_launch.sh
```

This script will:
- Terminate all Chrome processes
- Clean singleton lock files
- Remove temporary Chrome files
- Reset LaunchServices registration
- Test Chrome launch capability

## Automated Solution (Permanent Fix)

### Chrome Health Monitor

An automated monitoring service has been installed that:

- **Detects system wake events** using `pmset` logs
- **Monitors Chrome health** by checking process responsiveness and singleton file validity
- **Automatically fixes issues** when detected after wake events
- **Runs continuously in background** as a LaunchAgent
- **Logs all activities** to `~/Library/Logs/chrome_health_monitor.log`

### Manual Commands

```bash
# Check Chrome health status
./scripts/chrome_health_monitor.sh check

# Fix Chrome issues immediately  
./scripts/chrome_health_monitor.sh fix

# Test Chrome launch capability
./scripts/chrome_health_monitor.sh test

# Start monitoring manually
./scripts/chrome_health_monitor.sh monitor
```

### Service Management

```bash
# Check if monitor is running
launchctl list | grep chrome-health

# Stop the monitor
launchctl unload ~/Library/LaunchAgents/com.user.chrome-health-monitor.plist

# Start the monitor  
launchctl load ~/Library/LaunchAgents/com.user.chrome-health-monitor.plist

# View monitor logs
tail -f ~/Library/Logs/chrome_health_monitor.log
```

## Prevention Strategies

### System-Level Prevention

1. **Keep macOS Updated**: Newer macOS versions have improved sleep/wake handling
2. **Regular Restarts**: Restart your Mac at least weekly to clear system caches
3. **Disable Chrome Auto-Update**: Consider disabling automatic Chrome updates to avoid compatibility issues

### Chrome-Level Prevention

1. **Close Chrome Before Sleep**: Manually quit Chrome before putting the system to sleep
2. **Reduce Chrome Extensions**: Limit background processes that might interfere with sleep/wake
3. **Use Chrome Profiles Sparingly**: Multiple profiles can complicate singleton management

## Technical Details

### Chrome Singleton System

Chrome uses several mechanisms to ensure only one instance runs:

```bash
# Location of singleton files
~/Library/Application Support/Google/Chrome/
├── SingletonCookie → [process_id]
├── SingletonLock → [hostname-port]  
└── SingletonSocket → [socket_path]
```

### System Wake Detection

The monitor detects wake events by parsing `pmset` logs:

```bash
# View recent wake events
pmset -g log | grep -E "(Wake from|DarkWake from)" | tail -5
```

### Debugging

If issues persist:

1. **Check system logs**:
   ```bash
   log show --predicate 'process == "Google Chrome"' --last 1h
   ```

2. **Monitor Chrome crashes**:
   ```bash
   ls -la ~/Library/Logs/DiagnosticReports/*Chrome*
   ```

3. **Check LaunchServices**:
   ```bash
   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -dump | grep -i chrome
   ```

## Files Created

- `scripts/fix_chrome_launch.sh` - Manual fix script
- `scripts/chrome_health_monitor.sh` - Automated monitoring service
- `~/Library/LaunchAgents/com.user.chrome-health-monitor.plist` - LaunchAgent configuration
- `~/Library/Logs/chrome_health_monitor.log` - Service logs

## Troubleshooting

### Monitor Not Running

```bash
# Check for errors
cat /tmp/chrome_health_monitor.err

# Manually start monitor
nohup ./scripts/chrome_health_monitor.sh monitor > /tmp/chrome_monitor.log 2>&1 &
```

### Chrome Still Fails to Launch

1. Run the manual fix script
2. Check for permission issues in `/Applications/Google Chrome.app`
3. Consider reinstalling Chrome if issues persist
4. As last resort, restart the computer

### Heavy System Resource Usage

The monitor is designed to be lightweight, but if issues occur:
- Check `nice` value is set correctly (10)
- Verify `LowPriorityIO` is enabled
- Increase `CHECK_INTERVAL` in the script (default: 300 seconds)

## Success Indicators

After implementing this solution:
- ✅ Chrome launches immediately after system wake
- ✅ No more `-600` launch errors
- ✅ Automatic recovery from idle-related issues
- ✅ Background monitoring with minimal system impact
- ✅ No more need for full system restarts 