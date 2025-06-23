#!/usr/bin/env python3
"""
Startup Manager CLI
Manages custom startup tasks and services
"""

import os
import sys
import json
import subprocess
import argparse
import threading
import time
from datetime import datetime
from pathlib import Path


class StartupManager:
    def __init__(self):
        self.config_file = Path.home() / ".startup-manager" / "config.json"
        self.log_dir = Path.home() / ".startup-manager" / "logs"
        self.tasks = self._load_config()
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create necessary directories."""
        self.config_file.parent.mkdir(exist_ok=True)
        self.log_dir.mkdir(exist_ok=True)
    
    def _load_config(self):
        """Load configuration from file."""
        if not self.config_file.exists():
            return self._get_default_tasks()
        
        with open(self.config_file, 'r') as f:
            return json.load(f)
    
    def _save_config(self):
        """Save configuration to file."""
        with open(self.config_file, 'w') as f:
            json.dump(self.tasks, f, indent=2)
    
    def _get_default_tasks(self):
        """Return default startup tasks based on existing system configuration."""
        return {
            "chrome-health-monitor": {
                "name": "Chrome Health Monitor",
                "command": "/Users/areeb2/bin/chrome_health_monitor.sh monitor",
                "enabled": True,
                "type": "daemon",
                "description": "Monitors Chrome browser health and fixes launch issues"
            },
            "ngrok-ssh": {
                "name": "Ngrok SSH Tunnel",
                "command": "ngrok tcp 22 --remote-addr=7.tcp.ngrok.io:21775",
                "enabled": True,
                "type": "daemon",
                "description": "Maintains SSH tunnel for remote access"
            },
            "pm2-resurrect": {
                "name": "PM2 Process Manager",
                "command": "/usr/local/bin/pm2 resurrect",
                "enabled": True,
                "type": "once",
                "description": "Resurrects PM2-managed processes"
            },
            "screen-cleanup": {
                "name": "Screen Session Cleanup",
                "command": "/Users/areeb2/bin/screen-cleanup",
                "enabled": True,
                "type": "scheduled",
                "schedule": "3:00,15:00",
                "description": "Cleans up old detached screen sessions"
            },
            "td-bank-update": {
                "name": "TD Bank Weekly Update",
                "command": "/usr/bin/python3 /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/scripts/weekly_td_update_v2.py",
                "enabled": True,
                "type": "scheduled",
                "schedule": "Sun 02:00",
                "description": "Imports TD Bank transactions from Google Sheets"
            }
        }
    
    def list_tasks(self, show_all=False):
        """List all startup tasks."""
        print("\n📋 Startup Tasks:\n")
        
        for task_id, task in self.tasks.items():
            if not show_all and not task.get('enabled', True):
                continue
                
            status = "✅" if task.get('enabled', True) else "❌"
            print(f"{status} {task['name']} ({task_id})")
            print(f"   Type: {task['type']}")
            print(f"   Description: {task['description']}")
            
            if task['type'] == 'scheduled':
                print(f"   Schedule: {task.get('schedule', 'Not set')}")
            
            if 'last_run' in task:
                print(f"   Last run: {task['last_run']}")
            
            print()
    
    def enable_task(self, task_id):
        """Enable a startup task."""
        if task_id not in self.tasks:
            print(f"❌ Task '{task_id}' not found")
            return False
        
        self.tasks[task_id]['enabled'] = True
        self._save_config()
        print(f"✅ Enabled task: {self.tasks[task_id]['name']}")
        return True
    
    def disable_task(self, task_id):
        """Disable a startup task."""
        if task_id not in self.tasks:
            print(f"❌ Task '{task_id}' not found")
            return False
        
        self.tasks[task_id]['enabled'] = False
        self._save_config()
        print(f"❌ Disabled task: {self.tasks[task_id]['name']}")
        return True
    
    def add_task(self, task_id, name, command, task_type="once", description="", schedule=None):
        """Add a new startup task."""
        self.tasks[task_id] = {
            "name": name,
            "command": command,
            "enabled": True,
            "type": task_type,
            "description": description
        }
        
        if task_type == "scheduled" and schedule:
            self.tasks[task_id]["schedule"] = schedule
        
        self._save_config()
        print(f"✅ Added task: {name}")
        return True
    
    def remove_task(self, task_id):
        """Remove a startup task."""
        if task_id not in self.tasks:
            print(f"❌ Task '{task_id}' not found")
            return False
        
        task_name = self.tasks[task_id]['name']
        del self.tasks[task_id]
        self._save_config()
        print(f"✅ Removed task: {task_name}")
        return True
    
    def run_task(self, task_id):
        """Run a specific task immediately."""
        if task_id not in self.tasks:
            print(f"❌ Task '{task_id}' not found")
            return False
        
        task = self.tasks[task_id]
        if not task.get('enabled', True):
            print(f"⚠️  Task '{task['name']}' is disabled")
            return False
        
        print(f"🚀 Running task: {task['name']}")
        self._execute_task(task_id, task)
        return True
    
    def _execute_task(self, task_id, task):
        """Execute a task in background thread."""
        def run():
            log_file = self.log_dir / f"{task_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
            
            try:
                # Run command and capture output
                result = subprocess.run(
                    task['command'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                # Write log
                with open(log_file, 'w') as f:
                    f.write(f"Task: {task['name']}\n")
                    f.write(f"Started: {datetime.now()}\n")
                    f.write(f"Command: {task['command']}\n")
                    f.write(f"Exit code: {result.returncode}\n")
                    f.write(f"\n--- STDOUT ---\n{result.stdout}")
                    f.write(f"\n--- STDERR ---\n{result.stderr}")
                
                # Update last run time
                self.tasks[task_id]['last_run'] = datetime.now().isoformat()
                self._save_config()
                
                if result.returncode == 0:
                    print(f"✅ Task '{task['name']}' completed successfully")
                else:
                    print(f"❌ Task '{task['name']}' failed with exit code {result.returncode}")
                    
            except subprocess.TimeoutExpired:
                print(f"⏱️  Task '{task['name']}' timed out")
            except Exception as e:
                print(f"❌ Error running task '{task['name']}': {str(e)}")
        
        # Run in background thread
        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        thread.join(1)  # Wait briefly to ensure thread starts
    
    def start_all(self):
        """Start all enabled tasks."""
        print("🚀 Starting all enabled tasks...\n")
        
        # Run 'once' tasks
        for task_id, task in self.tasks.items():
            if task.get('enabled', True) and task['type'] == 'once':
                self.run_task(task_id)
                time.sleep(0.5)  # Small delay between tasks
        
        # Start daemon tasks
        for task_id, task in self.tasks.items():
            if task.get('enabled', True) and task['type'] == 'daemon':
                self.run_task(task_id)
                time.sleep(0.5)
        
        print("\n✅ All startup tasks launched")
        
        # Wait a bit for threads to complete
        time.sleep(5)
        print("✅ Startup manager completed")
        sys.exit(0)
    
    def check_status(self):
        """Check status of running tasks."""
        print("\n📊 Task Status:\n")
        
        # Check PM2 processes
        try:
            result = subprocess.run(
                "pm2 list --json",
                shell=True,
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                pm2_data = json.loads(result.stdout)
                print("PM2 Processes:")
                for proc in pm2_data:
                    status = "🟢" if proc['pm2_env']['status'] == 'online' else "🔴"
                    print(f"  {status} {proc['name']} - {proc['pm2_env']['status']}")
                print()
        except:
            pass
        
        # Check other processes
        for task_id, task in self.tasks.items():
            if task.get('enabled', True):
                print(f"{task['name']}:")
                if 'last_run' in task:
                    print(f"  Last run: {task['last_run']}")
                else:
                    print(f"  Never run")
    
    def view_logs(self, task_id=None, lines=50):
        """View logs for a task."""
        if task_id:
            # View specific task logs
            log_files = sorted(self.log_dir.glob(f"{task_id}_*.log"), reverse=True)
            if not log_files:
                print(f"No logs found for task '{task_id}'")
                return
            
            log_file = log_files[0]  # Most recent
            print(f"\n📄 Logs for {self.tasks[task_id]['name']}:")
            print(f"File: {log_file}\n")
            
            with open(log_file, 'r') as f:
                content = f.read().splitlines()
                for line in content[-lines:]:
                    print(line)
        else:
            # List all log files
            log_files = sorted(self.log_dir.glob("*.log"), reverse=True)[:10]
            print("\n📚 Recent log files:")
            for log_file in log_files:
                print(f"  {log_file.name}")


def main():
    parser = argparse.ArgumentParser(description="Manage startup tasks")
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List all tasks')
    list_parser.add_argument('-a', '--all', action='store_true', help='Show disabled tasks')
    
    # Enable/Disable commands
    enable_parser = subparsers.add_parser('enable', help='Enable a task')
    enable_parser.add_argument('task_id', help='Task ID to enable')
    
    disable_parser = subparsers.add_parser('disable', help='Disable a task')
    disable_parser.add_argument('task_id', help='Task ID to disable')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add a new task')
    add_parser.add_argument('task_id', help='Unique task ID')
    add_parser.add_argument('name', help='Task name')
    add_parser.add_argument('command', help='Command to run')
    add_parser.add_argument('-t', '--type', choices=['once', 'daemon', 'scheduled'], 
                          default='once', help='Task type')
    add_parser.add_argument('-d', '--description', help='Task description')
    add_parser.add_argument('-s', '--schedule', help='Schedule for scheduled tasks')
    
    # Remove command
    remove_parser = subparsers.add_parser('remove', help='Remove a task')
    remove_parser.add_argument('task_id', help='Task ID to remove')
    
    # Run command
    run_parser = subparsers.add_parser('run', help='Run a specific task')
    run_parser.add_argument('task_id', help='Task ID to run')
    
    # Start command
    subparsers.add_parser('start', help='Start all enabled tasks')
    
    # Status command
    subparsers.add_parser('status', help='Check task status')
    
    # Logs command
    logs_parser = subparsers.add_parser('logs', help='View task logs')
    logs_parser.add_argument('task_id', nargs='?', help='Task ID to view logs for')
    logs_parser.add_argument('-n', '--lines', type=int, default=50, help='Number of lines to show')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = StartupManager()
    
    if args.command == 'list':
        manager.list_tasks(show_all=args.all)
    elif args.command == 'enable':
        manager.enable_task(args.task_id)
    elif args.command == 'disable':
        manager.disable_task(args.task_id)
    elif args.command == 'add':
        manager.add_task(args.task_id, args.name, args.command, 
                        args.type, args.description or "", args.schedule)
    elif args.command == 'remove':
        manager.remove_task(args.task_id)
    elif args.command == 'run':
        manager.run_task(args.task_id)
    elif args.command == 'start':
        manager.start_all()
    elif args.command == 'status':
        manager.check_status()
    elif args.command == 'logs':
        manager.view_logs(args.task_id, args.lines)


if __name__ == "__main__":
    main()