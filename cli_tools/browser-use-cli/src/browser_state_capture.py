#!/usr/bin/env python3
"""
Browser State Capture Module
Captures comprehensive browser state information after task execution
while keeping the browser-use package intact.
"""

import json
import asyncio
import base64
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import os


class SessionConsoleCollector:
    """
    A session-level console log collector that persists during browser sessions.
    This is attached to the browser session and collects logs throughout task execution.
    """
    
    def __init__(self):
        self.console_logs: List[Dict[str, Any]] = []
        self.is_active = False
    
    def _console_handler(self, msg):
        """Handle console messages from Playwright page events"""
        try:
            # Convert Playwright ConsoleMessage to our format
            console_entry = {
                "timestamp": datetime.now().isoformat(),
                "type": msg.type,  # log, info, warn, error, debug, etc.
                "text": msg.text,
                "location": None,
                "args": []
            }
            
            # Safely handle location information
            try:
                if hasattr(msg, 'location') and msg.location:
                    if hasattr(msg.location, '__dict__'):
                        console_entry["location"] = msg.location.__dict__
                    elif isinstance(msg.location, dict):
                        console_entry["location"] = msg.location
                    else:
                        console_entry["location"] = str(msg.location)
            except Exception as e:
                console_entry["location"] = f"<location error: {e}>"
            
            # Try to capture console arguments if available
            try:
                for i, arg in enumerate(msg.args):
                    try:
                        # Handle both sync and async json_value methods
                        if hasattr(arg, 'json_value'):
                            # Check if json_value is a coroutine (async method)
                            if asyncio.iscoroutinefunction(arg.json_value):
                                # For async methods, we'll use a simpler approach
                                # since we can't await in this sync handler
                                console_entry["args"].append(f"<async_arg_{i}>")
                            else:
                                # Sync method, safe to call
                                arg_value = arg.json_value()
                                console_entry["args"].append(arg_value)
                        else:
                            # Fallback to string representation
                            console_entry["args"].append(str(arg))
                    except Exception as arg_e:
                        # If we can't serialize the arg, just note the error
                        console_entry["args"].append(f"<arg_{i}_error: {str(arg_e)[:50]}>")
            except Exception as e:
                console_entry["args"] = [f"<could not capture args: {e}>"]
            
            self.console_logs.append(console_entry)
            print(f"🎧 Console {msg.type}: {msg.text}")
            
        except Exception as e:
            print(f"⚠️ Error capturing console message: {e}")
    
    def _page_error_handler(self, error):
        """Handle uncaught page errors"""
        try:
            self.console_logs.append({
                "timestamp": datetime.now().isoformat(),
                "type": "pageerror",
                "text": str(error),
                "location": None,
                "args": []
            })
            print(f"🚨 Page error: {error}")
        except Exception as e:
            print(f"⚠️ Error capturing page error: {e}")
    
    def setup_listeners(self, page):
        """Set up console and error listeners on a page"""
        try:
            if page and not self.is_active:
                page.on("console", self._console_handler)
                page.on("pageerror", self._page_error_handler)
                self.is_active = True
                print(f"🎧 Console collector activated for page: {page.url[:60]}")
        except Exception as e:
            print(f"⚠️ Error setting up console listeners: {e}")
    
    def get_logs_copy(self) -> List[Dict[str, Any]]:
        """Get a copy of all collected console logs"""
        return self.console_logs.copy()
    
    def clear_logs(self):
        """Clear all collected logs"""
        self.console_logs.clear()
        print("🧹 Console logs cleared")
    
    def reset(self):
        """Reset the collector for a new session"""
        self.console_logs.clear()
        self.is_active = False
        print("🔄 Console collector reset")


class BrowserStateCapture:
    """
    Captures and saves browser state information to timestamped files.
    Works with any browser session that exposes CDP (Chrome DevTools Protocol).
    """
    
    def __init__(self, output_dir: str = None):
        # Default output directory
        if output_dir is None:
            default_dir = os.path.expanduser("~/.config/browseruse/browser_states")
        else:
            default_dir = output_dir
            
        self.output_dir = Path(default_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize console capture system
        self.session_console_collector = SessionConsoleCollector()
        
        print(f"📁 Browser state capture initialized: {self.output_dir}")
    
    def get_console_collector(self) -> SessionConsoleCollector:
        """Get the session console collector for setting up listeners"""
        return self.session_console_collector
    
    def _generate_filename(self, task_description: str = None) -> str:
        """Generate a timestamped filename for the browser state"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Include milliseconds
        
        # Clean task description for filename
        if task_description:
            # Take first 50 chars and clean for filename
            task_clean = "".join(c for c in task_description[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
            task_clean = task_clean.replace(' ', '_')
            if task_clean:
                return f"browser_state_{timestamp}_{task_clean}.json"
        
        return f"browser_state_{timestamp}.json"
    
    async def capture_state(self, browser_session, task_description: str = None) -> str:
        """
        Capture comprehensive browser state and save to a timestamped file.
        
        Args:
            browser_session: The browser session from browser-use
            task_description: Optional task description for filename
            
        Returns:
            str: Path to the saved state file
        """
        try:
            print("📸 Capturing browser state...")
            
            # Initialize state data
            state_data = {
                "timestamp": datetime.now().isoformat(),
                "task_description": task_description,
                "browser_info": {},
                "page_info": {},
                "navigation": {},
                "storage": {},
                "network": {},
                "performance": {},
                "console_logs": [],
                "screenshot": None,
                "dom_snapshot": None,
                "capture_metadata": {
                    "browser_session_type": type(browser_session).__name__,
                    "browser_available": hasattr(browser_session, 'browser') and browser_session.browser is not None,
                    "page_available": False
                }
            }
            
            # Try to get browser and page using browser-use session methods
            browser = None
            page = None
            
            # Check if session has browser attribute
            if hasattr(browser_session, 'browser') and browser_session.browser is not None:
                browser = browser_session.browser
                print("🔍 Found browser via session.browser")
            
            # Try to get current page using browser-use methods
            if hasattr(browser_session, 'get_current_page'):
                try:
                    page = await browser_session.get_current_page()
                    state_data["capture_metadata"]["page_available"] = page is not None
                    print(f"🔍 Found page via get_current_page: {page is not None}")
                except Exception as e:
                    print(f"⚠️ Error getting current page: {e}")
            
            # Alternative: try to access browser context if available
            if not browser and hasattr(browser_session, 'browser_context'):
                try:
                    context = browser_session.browser_context
                    if context:
                        pages = context.pages
                        if pages:
                            page = pages[0]
                            browser = context.browser
                            print(f"🔍 Found browser/page via browser_context")
                except Exception as e:
                    print(f"⚠️ Error accessing browser_context: {e}")
            
            # Setup console listener if we have a page
            if page:
                self.session_console_collector.setup_listeners(page)
            
            # Capture page-level information using browser-use session methods
            if browser_session:
                try:
                    # Use browser-use session methods for better compatibility
                    
                    # Get current page URL and title using session methods
                    if hasattr(browser_session, 'get_current_page'):
                        try:
                            current_page = await browser_session.get_current_page()
                            if current_page:
                                # Handle both property and method access patterns
                                try:
                                    page_url = current_page.url if hasattr(current_page, 'url') and not callable(current_page.url) else await current_page.url()
                                except:
                                    page_url = str(current_page.url) if hasattr(current_page, 'url') else "unknown"
                                
                                try:
                                    page_title = current_page.title if hasattr(current_page, 'title') and not callable(current_page.title) else await current_page.title()
                                except:
                                    page_title = str(current_page.title) if hasattr(current_page, 'title') else "unknown"
                                
                                state_data["page_info"].update({
                                    "url": page_url,
                                    "title": page_title,
                                })
                                print(f"✅ Captured page info via current_page: {page_url}")
                        except Exception as e:
                            state_data["page_info"]["get_current_page_error"] = f"get_current_page failed: {str(e)}"
                    
                    # Try alternative method: direct browser-use session properties
                    if ("url" not in state_data["page_info"] or not state_data["page_info"]["url"]) and page:
                        try:
                            # Handle both property and method access patterns
                            try:
                                page_url = page.url if hasattr(page, 'url') and not callable(page.url) else await page.url()
                            except:
                                page_url = str(page.url) if hasattr(page, 'url') else "unknown"
                            
                            try:
                                page_title = page.title if hasattr(page, 'title') and not callable(page.title) else await page.title()
                            except:
                                page_title = str(page.title) if hasattr(page, 'title') else "unknown"
                            
                            state_data["page_info"].update({
                                "url": page_url,
                                "title": page_title,
                            })
                            print(f"✅ Captured page info via direct page access: {page_url}")
                        except Exception as e:
                            state_data["page_info"]["direct_page_error"] = f"Direct page access failed: {str(e)}"
                    
                    # Get viewport using page object
                    if page:
                        try:
                            viewport = page.viewport_size if hasattr(page, 'viewport_size') else await page.viewport_size()
                            if viewport:
                                state_data["page_info"]["viewport"] = viewport
                        except Exception as e:
                            state_data["page_info"]["viewport_error"] = str(e)
                    
                    # Use browser-use session screenshot method if available
                    if hasattr(browser_session, 'take_screenshot'):
                        try:
                            screenshot_result = await browser_session.take_screenshot()
                            if screenshot_result:
                                # Handle both string (base64) and bytes return types
                                if isinstance(screenshot_result, str):
                                    # Already base64 encoded
                                    state_data["screenshot"] = {
                                        "format": "png",
                                        "data": screenshot_result,
                                        "size_bytes": len(screenshot_result.encode('utf-8'))
                                    }
                                elif isinstance(screenshot_result, bytes):
                                    # Raw bytes, need to encode
                                    state_data["screenshot"] = {
                                        "format": "png",
                                        "data": base64.b64encode(screenshot_result).decode('utf-8'),
                                        "size_bytes": len(screenshot_result)
                                    }
                                else:
                                    state_data["screenshot_error"] = f"Unexpected screenshot type: {type(screenshot_result)}"
                                print(f"✅ Captured screenshot via session.take_screenshot")
                        except Exception as e:
                            state_data["screenshot_error"] = f"session.take_screenshot failed: {str(e)}"
                    elif page:
                        # Fallback to direct page screenshot
                        try:
                            screenshot_bytes = await page.screenshot(type="png", full_page=False)
                            state_data["screenshot"] = {
                                "format": "png",
                                "data": base64.b64encode(screenshot_bytes).decode('utf-8'),
                                "size_bytes": len(screenshot_bytes)
                            }
                            print(f"✅ Captured screenshot via page.screenshot")
                        except Exception as e:
                            state_data["screenshot_error"] = f"page.screenshot failed: {str(e)}"
                    
                    # Try to get cookies using session methods
                    if hasattr(browser_session, 'get_cookies'):
                        try:
                            cookies = await browser_session.get_cookies()
                            if cookies:
                                # Convert cookies to serializable format
                                state_data["storage"]["cookies"] = [
                                    {
                                        "name": cookie.get("name"),
                                        "value": cookie.get("value"),
                                        "domain": cookie.get("domain"),
                                        "path": cookie.get("path"),
                                        "secure": cookie.get("secure"),
                                        "httpOnly": cookie.get("httpOnly"),
                                        "expires": cookie.get("expires")
                                    }
                                    for cookie in cookies
                                ]
                                print(f"✅ Captured cookies via session.get_cookies")
                        except Exception as e:
                            state_data["storage"]["cookies_error"] = f"session.get_cookies failed: {str(e)}"
                    
                    # Get page HTML using session method if available
                    if hasattr(browser_session, 'get_page_html'):
                        try:
                            html_content = await browser_session.get_page_html()
                            if html_content:
                                # Store a truncated version of HTML for analysis
                                state_data["dom_snapshot"] = {
                                    "html_length": len(html_content),
                                    "html_preview": html_content[:500] + "..." if len(html_content) > 500 else html_content
                                }
                                print(f"✅ Captured HTML via session.get_page_html")
                        except Exception as e:
                            state_data["dom_snapshot_error"] = f"session.get_page_html failed: {str(e)}"
                    
                    # Get page structure if available
                    if hasattr(browser_session, 'get_page_structure'):
                        try:
                            structure = await browser_session.get_page_structure()
                            if structure:
                                state_data["page_structure"] = structure
                                print(f"✅ Captured page structure")
                        except Exception as e:
                            state_data["page_structure_error"] = f"get_page_structure failed: {str(e)}"
                    
                    # Get tabs info if available
                    if hasattr(browser_session, 'get_tabs_info'):
                        try:
                            tabs_info = await browser_session.get_tabs_info()
                            if tabs_info:
                                state_data["browser_info"]["tabs"] = tabs_info
                                print(f"✅ Captured tabs info")
                        except Exception as e:
                            state_data["browser_info"]["tabs_error"] = f"get_tabs_info failed: {str(e)}"
                    
                    # Try localStorage and sessionStorage if page is available
                    if page:
                        try:
                            # Local Storage
                            local_storage = await page.evaluate("() => Object.fromEntries(Object.entries(localStorage))")
                            state_data["storage"]["localStorage"] = local_storage
                            print(f"✅ Captured localStorage")
                        except Exception as e:
                            state_data["storage"]["localStorage_error"] = str(e)
                        
                        try:
                            # Session Storage
                            session_storage = await page.evaluate("() => Object.fromEntries(Object.entries(sessionStorage))")
                            state_data["storage"]["sessionStorage"] = session_storage
                            print(f"✅ Captured sessionStorage")
                        except Exception as e:
                            state_data["storage"]["sessionStorage_error"] = str(e)
                        
                        try:
                            # Performance metrics
                            performance = await page.evaluate("""() => {
                                const perf = performance.getEntriesByType('navigation')[0];
                                return {
                                    loadEventEnd: perf ? perf.loadEventEnd : null,
                                    domContentLoadedEventEnd: perf ? perf.domContentLoadedEventEnd : null,
                                    responseEnd: perf ? perf.responseEnd : null,
                                    timing: {
                                        navigationStart: performance.timing.navigationStart,
                                        loadEventEnd: performance.timing.loadEventEnd,
                                        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
                                    }
                                };
                            }""")
                            state_data["performance"] = performance
                            print(f"✅ Captured performance metrics")
                        except Exception as e:
                            state_data["performance"]["error"] = str(e)
                    
                except Exception as e:
                    state_data["session_capture_error"] = str(e)
                    print(f"⚠️ Error during session-based capture: {e}")
            
            # Collect console logs that were captured during the session
            try:
                if self.session_console_collector.get_logs_copy():
                    state_data["console_logs"] = self.session_console_collector.get_logs_copy()
                    print(f"✅ Captured {len(state_data['console_logs'])} console messages")
                    
                    # Add console log summary
                    log_types = {}
                    for log in state_data["console_logs"]:
                        log_type = log.get("type", "unknown")
                        log_types[log_type] = log_types.get(log_type, 0) + 1
                    
                    state_data["console_summary"] = {
                        "total_messages": len(state_data["console_logs"]),
                        "by_type": log_types
                    }
                else:
                    state_data["console_logs"] = []
                    state_data["console_summary"] = {
                        "total_messages": 0,
                        "by_type": {}
                    }
                    print("📝 No console messages captured")
            except Exception as e:
                state_data["console_logs_error"] = str(e)
                print(f"⚠️ Error collecting console logs: {e}")
            
            # Generate filename and save
            filename = self._generate_filename(task_description)
            filepath = self.output_dir / filename
            
            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(state_data, f, indent=2, ensure_ascii=False, default=str)
            
            print(f"💾 Browser state saved to: {filepath}")
            return str(filepath)
            
        except Exception as e:
            print(f"❌ Error capturing browser state: {str(e)}")
            # Save error state
            error_state = {
                "timestamp": datetime.now().isoformat(),
                "task_description": task_description,
                "error": str(e),
                "error_type": type(e).__name__
            }
            
            filename = self._generate_filename(f"ERROR_{task_description}" if task_description else "ERROR")
            filepath = self.output_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(error_state, f, indent=2, ensure_ascii=False)
            
            print(f"⚠️ Error state saved to: {filepath}")
            return str(filepath)
    
    def get_latest_state_file(self) -> Optional[str]:
        """Get the path to the most recently created state file"""
        try:
            state_files = list(self.output_dir.glob("browser_state_*.json"))
            if state_files:
                latest_file = max(state_files, key=lambda x: x.stat().st_mtime)
                return str(latest_file)
        except Exception as e:
            print(f"⚠️ Error finding latest state file: {e}")
        return None
    
    def list_state_files(self, limit: int = 10) -> list:
        """List recent state files"""
        try:
            state_files = list(self.output_dir.glob("browser_state_*.json"))
            # Sort by modification time, newest first
            state_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            return [str(f) for f in state_files[:limit]]
        except Exception as e:
            print(f"⚠️ Error listing state files: {e}")
            return []


# Convenience function for quick state capture
async def capture_browser_state(browser_session, task_description: str = None, output_dir: str = None) -> str:
    """
    Convenience function to quickly capture browser state.
    
    Returns:
        str: Path to the saved state file
    """
    capture = BrowserStateCapture(output_dir)
    return await capture.capture_state(browser_session, task_description) 