#!/usr/bin/env python3
"""
Browser State Viewer Utility
A helper tool to view and analyze captured browser state files.
"""

import json
import argparse
import base64
from pathlib import Path
from datetime import datetime
import os

class BrowserStateViewer:
    """Utility to view and analyze browser state files"""
    
    def __init__(self):
        self.default_dir = Path(os.path.expanduser("~/.config/browseruse/browser_states"))
    
    def list_states(self, limit=10):
        """List recent browser state files"""
        if not self.default_dir.exists():
            print(f"📁 No state directory found at {self.default_dir}")
            return
        
        state_files = list(self.default_dir.glob("browser_state_*.json"))
        if not state_files:
            print(f"📁 No state files found in {self.default_dir}")
            return
        
        # Sort by modification time, newest first
        state_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        print(f"📋 Recent browser state files (showing {min(limit, len(state_files))} of {len(state_files)}):")
        print("-" * 80)
        
        for i, state_file in enumerate(state_files[:limit]):
            try:
                with open(state_file, 'r') as f:
                    data = json.load(f)
                
                timestamp = data.get('timestamp', 'unknown')
                task_desc = data.get('task_description', 'no description')
                url = data.get('page_info', {}).get('url', 'unknown')
                
                # Truncate long descriptions
                if len(task_desc) > 50:
                    task_desc = task_desc[:47] + "..."
                
                print(f"{i+1:2d}. {state_file.name}")
                print(f"    📅 {timestamp}")
                print(f"    🎯 {task_desc}")
                print(f"    🌐 {url}")
                print()
                
            except Exception as e:
                print(f"{i+1:2d}. {state_file.name} (error reading: {e})")
    
    def view_state(self, file_path):
        """View a specific browser state file"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            print(f"🔍 Browser State Analysis: {Path(file_path).name}")
            print("=" * 80)
            
            # Basic info
            print(f"📅 Timestamp: {data.get('timestamp', 'unknown')}")
            print(f"🎯 Task: {data.get('task_description', 'no description')}")
            print()
            
            # Page info
            page_info = data.get('page_info', {})
            if page_info:
                print("🌐 Page Information:")
                print(f"   URL: {page_info.get('url', 'unknown')}")
                print(f"   Title: {page_info.get('title', 'unknown')}")
                if 'viewport' in page_info:
                    viewport = page_info['viewport']
                    print(f"   Viewport: {viewport.get('width', '?')}x{viewport.get('height', '?')}")
                print()
            
            # Storage info
            storage = data.get('storage', {})
            if storage:
                print("💾 Storage Information:")
                
                local_storage = storage.get('localStorage', {})
                if local_storage and not isinstance(local_storage, str):
                    print(f"   Local Storage: {len(local_storage)} items")
                    for key in list(local_storage.keys())[:3]:  # Show first 3
                        value = str(local_storage[key])[:50] + "..." if len(str(local_storage[key])) > 50 else local_storage[key]
                        print(f"     {key}: {value}")
                    if len(local_storage) > 3:
                        print(f"     ... and {len(local_storage) - 3} more")
                
                session_storage = storage.get('sessionStorage', {})
                if session_storage and not isinstance(session_storage, str):
                    print(f"   Session Storage: {len(session_storage)} items")
                
                cookies = storage.get('cookies', [])
                if cookies and isinstance(cookies, list):
                    print(f"   Cookies: {len(cookies)} cookies")
                    for cookie in cookies[:3]:  # Show first 3
                        print(f"     {cookie.get('name', '?')}: {cookie.get('domain', '?')}")
                    if len(cookies) > 3:
                        print(f"     ... and {len(cookies) - 3} more")
                print()
            
            # DOM snapshot
            dom_snapshot = data.get('dom_snapshot')
            if dom_snapshot and not isinstance(dom_snapshot, str):
                print("🏗️ DOM Information:")
                print(f"   Ready State: {dom_snapshot.get('readyState', 'unknown')}")
                
                active_element = dom_snapshot.get('activeElement')
                if active_element:
                    print(f"   Active Element: {active_element.get('tagName', '?')} (id: {active_element.get('id', 'none')})")
                
                forms = dom_snapshot.get('forms', [])
                if forms:
                    print(f"   Forms: {len(forms)} found")
                    for form in forms[:2]:  # Show first 2
                        print(f"     Action: {form.get('action', '?')} Method: {form.get('method', '?')}")
                
                links = dom_snapshot.get('links', [])
                if links:
                    print(f"   Links: {len(links)} found")
                print()
            
            # Performance info
            performance = data.get('performance', {})
            if performance and not isinstance(performance, str):
                print("⚡ Performance Information:")
                timing = performance.get('timing', {})
                if timing:
                    nav_start = timing.get('navigationStart', 0)
                    load_end = timing.get('loadEventEnd', 0)
                    if nav_start and load_end:
                        load_time = load_end - nav_start
                        print(f"   Page Load Time: {load_time}ms")
                print()
            
            # Console logs info
            console_logs = data.get('console_logs', [])
            console_summary = data.get('console_summary', {})
            if console_logs or console_summary:
                print("📝 Console Information:")
                
                # Show summary if available
                if console_summary:
                    total_messages = console_summary.get('total_messages', 0)
                    print(f"   Total Messages: {total_messages}")
                    
                    by_type = console_summary.get('by_type', {})
                    if by_type:
                        print("   Message Types:")
                        for msg_type, count in by_type.items():
                            print(f"     {msg_type}: {count}")
                
                # Show recent console logs (last 5)
                if console_logs and isinstance(console_logs, list):
                    recent_logs = console_logs[-5:] if len(console_logs) > 5 else console_logs
                    print(f"   Recent Messages (showing last {len(recent_logs)} of {len(console_logs)}):")
                    
                    for i, log in enumerate(recent_logs):
                        timestamp = log.get('timestamp', 'unknown')
                        log_type = log.get('type', 'unknown')
                        text = log.get('text', '')
                        
                        # Truncate long messages
                        if len(text) > 80:
                            text = text[:77] + "..."
                        
                        # Format timestamp
                        try:
                            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                            time_str = dt.strftime('%H:%M:%S.%f')[:-3]  # Show milliseconds
                        except:
                            time_str = timestamp
                        
                        # Color code by type
                        type_emoji = {
                            'log': '📄',
                            'info': 'ℹ️',
                            'warn': '⚠️',
                            'warning': '⚠️',
                            'error': '❌',
                            'debug': '🐛',
                            'pageerror': '💥'
                        }.get(log_type, '📝')
                        
                        print(f"     {type_emoji} [{time_str}] {log_type}: {text}")
                        
                        # Show location if available
                        location = log.get('location')
                        if location and isinstance(location, dict):
                            url = location.get('url', '')
                            line = location.get('lineNumber', -1)
                            if url and url != 'unknown' and line >= 0:
                                # Show just filename for brevity
                                filename = url.split('/')[-1] if '/' in url else url
                                print(f"        📍 {filename}:{line}")
                        
                        # Show args if available and not empty
                        args = log.get('args', [])
                        if args and len(args) > 0:
                            args_str = ', '.join(str(arg)[:30] + "..." if len(str(arg)) > 30 else str(arg) for arg in args[:3])
                            if len(args) > 3:
                                args_str += f", ... +{len(args) - 3} more"
                            print(f"        📋 Args: {args_str}")
                
                print()
            
            # Screenshot info
            screenshot = data.get('screenshot')
            if screenshot and isinstance(screenshot, dict):
                size_bytes = screenshot.get('size_bytes', 0)
                size_kb = round(size_bytes / 1024, 1)
                print(f"📸 Screenshot: {screenshot.get('format', '?')} format, {size_kb}KB")
                print()
            
            # Browser info
            browser_info = data.get('browser_info', {})
            if browser_info:
                print("🌍 Browser Information:")
                print(f"   Total Pages: {browser_info.get('total_pages', 'unknown')}")
                pages = browser_info.get('pages', [])
                for i, page in enumerate(pages[:3]):  # Show first 3 pages
                    if 'error' not in page:
                        title = page.get('title', 'untitled')[:30] + "..." if len(page.get('title', '')) > 30 else page.get('title', 'untitled')
                        print(f"     Page {i}: {title}")
                        print(f"              {page.get('url', 'unknown')}")
                print()
            
            # Capture metadata
            metadata = data.get('capture_metadata', {})
            if metadata:
                print("🔧 Capture Metadata:")
                print(f"   Session Type: {metadata.get('browser_session_type', 'unknown')}")
                print(f"   Browser Available: {metadata.get('browser_available', 'unknown')}")
                print(f"   Page Available: {metadata.get('page_available', 'unknown')}")
            
            # Error information
            for key in data.keys():
                if 'error' in key:
                    print(f"⚠️ {key}: {data[key]}")
            
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in file: {e}")
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
        except Exception as e:
            print(f"❌ Error reading file: {e}")
    
    def extract_screenshot(self, file_path, output_path=None):
        """Extract screenshot from state file"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            screenshot = data.get('screenshot')
            if not screenshot or not isinstance(screenshot, dict):
                print("❌ No screenshot found in state file")
                return
            
            screenshot_data = screenshot.get('data')
            if not screenshot_data:
                print("❌ No screenshot data found")
                return
            
            # Generate output path if not provided
            if not output_path:
                state_file = Path(file_path)
                output_path = state_file.parent / f"{state_file.stem}_screenshot.png"
            
            # Decode and save
            screenshot_bytes = base64.b64decode(screenshot_data)
            with open(output_path, 'wb') as f:
                f.write(screenshot_bytes)
            
            print(f"📸 Screenshot extracted to: {output_path}")
            
        except Exception as e:
            print(f"❌ Error extracting screenshot: {e}")
    
    def view_console_logs(self, file_path):
        """View console logs from a state file"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            timestamp = data.get('timestamp', 'Unknown')
            task = data.get('task_description', 'No description')
            
            print(f"🎧 Console Logs Report")
            print(f"📅 Timestamp: {timestamp}")
            print(f"📝 Task: {task}")
            print("=" * 80)
            
            console_logs = data.get('console_logs', [])
            console_summary = data.get('console_summary', {})
            
            if not console_logs:
                print("📝 No console messages found in this capture")
                return
            
            # Summary
            total = console_summary.get('total_messages', len(console_logs))
            by_type = console_summary.get('by_type', {})
            
            print(f"📊 Console Log Summary:")
            print(f"   Total Messages: {total}")
            if by_type:
                print(f"   Message Types:")
                for msg_type, count in by_type.items():
                    emoji = {"log": "📄", "info": "ℹ️", "warn": "⚠️", "warning": "⚠️", "error": "❌", "debug": "🐛"}.get(msg_type, "📋")
                    print(f"     {emoji} {msg_type}: {count}")
            print()
            
            # Detailed logs
            print(f"📋 Console Messages (chronological order):")
            print("-" * 80)
            
            for i, log in enumerate(console_logs, 1):
                timestamp = log.get('timestamp', 'Unknown time')
                msg_type = log.get('type', 'unknown')
                text = log.get('text', 'No message')
                location = log.get('location')
                args = log.get('args', [])
                
                # Format timestamp
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    time_str = dt.strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds
                except:
                    time_str = timestamp
                
                # Choose emoji for message type
                emoji = {
                    "log": "📄",
                    "info": "ℹ️", 
                    "warn": "⚠️",
                    "warning": "⚠️",
                    "error": "❌",
                    "debug": "🐛",
                    "pageerror": "🚨"
                }.get(msg_type, "📋")
                
                print(f"{i:3d}. {emoji} [{time_str}] {msg_type}: {text}")
                
                # Show location if available
                if location:
                    if isinstance(location, dict):
                        url = location.get('url', 'unknown')
                        line = location.get('lineNumber', '?')
                        col = location.get('columnNumber', '?')
                        print(f"     📍 Location: {url}:{line}:{col}")
                    else:
                        print(f"     📍 Location: {location}")
                
                # Show arguments if available
                if args and len(args) > 0:
                    print(f"     📋 Args: {args}")
                
                print()
            
            print(f"📊 Total: {len(console_logs)} console messages displayed")
            
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON file: {file_path}")
        except Exception as e:
            print(f"❌ Error viewing console logs: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Browser State Viewer - Analyze captured browser states",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  state-viewer list                    # List recent state files
  state-viewer view latest             # View the most recent state
  state-viewer view /path/to/state.json  # View specific state file
  state-viewer console latest         # View console logs from latest state
  state-viewer console latest --type error  # View only error messages
  state-viewer screenshot latest       # Extract screenshot from latest state
        """
    )
    
    parser.add_argument("command", choices=["list", "view", "screenshot", "console"], help="Command to execute")
    parser.add_argument("target", nargs="?", help="Target file path or 'latest'")
    parser.add_argument("--limit", type=int, default=50, help="Limit number of messages to show")
    parser.add_argument("--type", help="Filter console logs by type (log, info, warn, error, debug)")
    parser.add_argument("--output", help="Output path for screenshot extraction")
    
    args = parser.parse_args()
    
    viewer = BrowserStateViewer()
    
    if args.command == "list":
        viewer.list_states(args.limit)
    
    elif args.command == "view":
        if not args.target:
            print("❌ Target file path or 'latest' required for view command")
            return
        
        if args.target == "latest":
            # Find the latest file
            state_files = list(viewer.default_dir.glob("browser_state_*.json"))
            if not state_files:
                print("❌ No state files found")
                return
            target_file = max(state_files, key=lambda x: x.stat().st_mtime)
        else:
            target_file = Path(args.target)
        
        viewer.view_state(target_file)
    
    elif args.command == "console":
        if not args.target:
            print("❌ Target file path or 'latest' required for console command")
            return
        
        if args.target == "latest":
            # Find the latest file
            state_files = list(viewer.default_dir.glob("browser_state_*.json"))
            if not state_files:
                print("❌ No state files found")
                return
            target_file = max(state_files, key=lambda x: x.stat().st_mtime)
        else:
            target_file = Path(args.target)
        
        viewer.view_console_logs(target_file)
    
    elif args.command == "screenshot":
        if not args.target:
            print("❌ Target file path or 'latest' required for screenshot command")
            return
        
        if args.target == "latest":
            # Find the latest file
            state_files = list(viewer.default_dir.glob("browser_state_*.json"))
            if not state_files:
                print("❌ No state files found")
                return
            target_file = max(state_files, key=lambda x: x.stat().st_mtime)
        else:
            target_file = Path(args.target)
        
        viewer.extract_screenshot(target_file, args.output)


if __name__ == "__main__":
    main() 