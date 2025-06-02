#!/bin/bash

# chrome_health_monitor.sh - Advanced Chrome Health Monitor and Auto-Fix
# Monitors Chrome health and automatically fixes launch issues after idle periods

LOG_FILE="$HOME/Library/Logs/chrome_health_monitor.log"
CHROME_SUPPORT_DIR="$HOME/Library/Application Support/Google/Chrome"
CHECK_INTERVAL=300  # Check every 5 minutes

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if Chrome processes are healthy
check_chrome_health() {
    local chrome_pids=($(pgrep -f "Google Chrome" | grep -v grep))
    local main_chrome_pid=""
    
    # Find the main Chrome process (not helper processes)
    for pid in "${chrome_pids[@]}"; do
        local cmd=$(ps -p "$pid" -o command= 2>/dev/null)
        if [[ "$cmd" == *"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"* ]] && [[ "$cmd" != *"--type="* ]]; then
            main_chrome_pid="$pid"
            break
        fi
    done
    
    if [ -n "$main_chrome_pid" ]; then
        # Check if the main Chrome process is responsive
        if kill -0 "$main_chrome_pid" 2>/dev/null; then
            # Process exists, check if singleton files are valid
            if [ -L "$CHROME_SUPPORT_DIR/SingletonSocket" ]; then
                local socket_path=$(readlink "$CHROME_SUPPORT_DIR/SingletonSocket")
                if [ -S "$socket_path" ]; then
                    return 0  # Chrome is healthy
                else
                    log_message "WARNING: Chrome singleton socket is invalid"
                    return 1  # Chrome needs fixing
                fi
            else
                log_message "WARNING: Chrome singleton socket missing"
                return 1  # Chrome needs fixing
            fi
        else
            log_message "WARNING: Chrome main process not responsive"
            return 1  # Chrome needs fixing
        fi
    fi
    
    return 0  # No Chrome running, assume healthy
}

# Detect if system recently woke from sleep
check_recent_wake() {
    local last_wake=$(pmset -g log | grep -E "(Wake from|DarkWake from)" | tail -1 | awk '{print $1, $2}')
    if [ -n "$last_wake" ]; then
        local wake_timestamp=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last_wake" +%s 2>/dev/null)
        local current_timestamp=$(date +%s)
        local wake_age=$((current_timestamp - wake_timestamp))
        
        # If wake was within last 30 minutes
        if [ "$wake_age" -lt 1800 ]; then
            return 0  # Recent wake detected
        fi
    fi
    return 1  # No recent wake
}

# Test Chrome launch capability
test_chrome_launch() {
    log_message "Testing Chrome launch capability..."
    
    # Try to launch Chrome in the background
    timeout 10 open -a "Google Chrome" > /dev/null 2>&1
    local launch_result=$?
    
    sleep 3
    
    # Check if Chrome actually launched
    local chrome_running=$(pgrep -f "Google Chrome" | grep -v grep | wc -l)
    
    if [ "$launch_result" -eq 0 ] && [ "$chrome_running" -gt 0 ]; then
        log_message "✅ Chrome launch test successful"
        return 0
    else
        log_message "❌ Chrome launch test failed (exit code: $launch_result, processes: $chrome_running)"
        return 1
    fi
}

# Fix Chrome launch issues
fix_chrome_issues() {
    log_message "🔧 Fixing Chrome launch issues..."
    
    # Step 1: Terminate all Chrome processes
    log_message "Terminating Chrome processes..."
    pkill -f "Google Chrome" 2>/dev/null
    sleep 3
    
    # Force kill if still running
    if pgrep -f "Google Chrome" > /dev/null; then
        log_message "Force terminating remaining Chrome processes..."
        killall -9 "Google Chrome" 2>/dev/null
        sleep 2
    fi
    
    # Step 2: Clean singleton files
    if [ -d "$CHROME_SUPPORT_DIR" ]; then
        log_message "Cleaning Chrome singleton files..."
        [ -L "$CHROME_SUPPORT_DIR/SingletonCookie" ] && rm "$CHROME_SUPPORT_DIR/SingletonCookie"
        [ -L "$CHROME_SUPPORT_DIR/SingletonLock" ] && rm "$CHROME_SUPPORT_DIR/SingletonLock"
        [ -L "$CHROME_SUPPORT_DIR/SingletonSocket" ] && rm "$CHROME_SUPPORT_DIR/SingletonSocket"
    fi
    
    # Step 3: Clean temporary Chrome files
    log_message "Cleaning temporary Chrome files..."
    find /var/folders -name "*Chrome*" -type d 2>/dev/null | while read dir; do
        if [ -w "$dir" ]; then
            rm -rf "$dir" 2>/dev/null
        fi
    done
    
    # Step 4: Reset LaunchServices for Chrome
    log_message "Resetting LaunchServices..."
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Google\ Chrome.app
    
    # Step 5: Clear Chrome from launchd
    launchctl list | grep -i chrome | while read line; do
        service=$(echo "$line" | awk '{print $3}')
        if [ -n "$service" ]; then
            log_message "Removing launchd service: $service"
            launchctl remove "$service" 2>/dev/null
        fi
    done
    
    log_message "✅ Chrome fix completed"
}

# Monitor mode - run continuously
monitor_mode() {
    log_message "🔍 Starting Chrome Health Monitor (PID: $$)"
    
    while true; do
        # Check if system recently woke from sleep
        if check_recent_wake; then
            log_message "Recent system wake detected, checking Chrome health..."
            
            if ! check_chrome_health; then
                log_message "Chrome health check failed after wake"
                fix_chrome_issues
                
                # Test the fix
                if test_chrome_launch; then
                    log_message "✅ Chrome fix successful"
                else
                    log_message "❌ Chrome fix failed, may need manual intervention"
                fi
            else
                log_message "Chrome health check passed"
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Main script logic
case "${1:-}" in
    "monitor")
        monitor_mode
        ;;
    "fix")
        fix_chrome_issues
        test_chrome_launch
        ;;
    "test")
        test_chrome_launch
        ;;
    "check")
        if check_chrome_health; then
            echo "✅ Chrome is healthy"
            exit 0
        else
            echo "❌ Chrome needs fixing"
            exit 1
        fi
        ;;
    *)
        echo "Chrome Health Monitor and Auto-Fix"
        echo "Usage: $0 [monitor|fix|test|check]"
        echo ""
        echo "Commands:"
        echo "  monitor - Run continuous monitoring (recommended for background)"
        echo "  fix     - Fix Chrome issues immediately"
        echo "  test    - Test Chrome launch capability"
        echo "  check   - Check Chrome health status"
        echo ""
        echo "Examples:"
        echo "  $0 fix              # Fix Chrome issues now"
        echo "  $0 monitor          # Start continuous monitoring"
        echo "  nohup $0 monitor &  # Start monitoring in background"
        exit 0
        ;;
esac 