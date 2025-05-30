#!/usr/bin/env python3
"""
Persistent Browser Wrapper - MVP Implementation
Extends browser-use components to provide session persistence while keeping all automation logic intact.
"""

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.browser.profile import BrowserProfile
from langchain_core.language_models.chat_models import BaseChatModel
import os
import signal
import subprocess
from datetime import datetime

# Import our state capture module
try:
    from .browser_state_capture import BrowserStateCapture
except ImportError:
    # Fallback for direct execution
    from browser_state_capture import BrowserStateCapture

# Version compatibility check
try:
    import browser_use
    BROWSER_USE_VERSION = getattr(browser_use, '__version__', 'unknown')
    print(f"🔍 Using browser-use version: {BROWSER_USE_VERSION}")
except ImportError:
    BROWSER_USE_VERSION = 'unknown'
    print(f"⚠️ Could not detect browser-use version")


class PersistentBrowserSession(BrowserSession):
    """
    Wrapper around browser-use's BrowserSession that prevents automatic cleanup.
    This allows multiple Agent instances to reuse the same browser session.
    """
    
    def __init__(self, profile_dir: str, headless: bool = False):
        # Create BrowserProfile with the profile directory and headless setting
        browser_profile = BrowserProfile(
            user_data_dir=profile_dir,
            headless=headless
        )
        
        # Initialize BrowserSession with the browser_profile
        super().__init__(browser_profile=browser_profile)
        self._is_persistent = True
        self._manually_closed = False
        
    async def __aenter__(self):
        """Start the browser session using browser-use's logic"""
        result = await super().__aenter__()
        print(f"🔄 Persistent browser session started")
        return result
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Override to prevent automatic session closure"""
        if self._manually_closed:
            # Only close if we explicitly called manual_close()
            # manual_close() handles the actual cleanup
            print(f"🛑 Persistent browser session closed")
        else:
            # Skip automatic cleanup - session stays alive
            print(f"🔄 Browser session cleanup skipped - keeping persistent")
        
    async def manual_close(self):
        """Manually close the session when we're done"""
        self._manually_closed = True
        try:
            # Call the parent cleanup to properly close browser
            await super().__aexit__(None, None, None)
            print(f"🛑 Browser process closed successfully")
        except Exception as e:
            print(f"⚠️ Warning during browser cleanup: {e}")
            # Force cleanup if needed
            try:
                if hasattr(self, 'browser_profile') and hasattr(self.browser_profile, 'browser'):
                    browser = self.browser_profile.browser
                    if browser:
                        await browser.close()
                        print(f"🛑 Forced browser closure completed")
            except Exception as force_error:
                print(f"⚠️ Force cleanup also failed: {force_error}")


class PersistentBrowserWrapper:
    """
    Main wrapper that manages a persistent browser session and creates
    browser-use Agents that reuse the same session.
    """
    
    def __init__(self, profile_dir: str, headless: bool = False, capture_state: bool = True, state_output_dir: str = None):
        self.profile_dir = profile_dir
        self.headless = headless
        self.session = None
        self.task_count = 0
        
        # Initialize state capture
        self.capture_state = capture_state
        if self.capture_state:
            self.state_capture = BrowserStateCapture(output_dir=state_output_dir)
        
    async def start(self):
        """Start the persistent browser session"""
        if self.session is None:
            self.session = PersistentBrowserSession(self.profile_dir, self.headless)
            await self.session.__aenter__()
            
            # Set up console capture immediately if enabled
            if self.capture_state:
                await self._setup_console_capture()
            
            print(f"🚀 Persistent browser wrapper started")
        else:
            print(f"🔄 Browser session already running")
    
    async def _setup_console_capture(self):
        """Set up console capture on the browser session"""
        try:
            # Get the console collector from state capture
            console_collector = self.state_capture.get_console_collector()
            
            # Set up console capture on browser context level to catch all pages
            if hasattr(self.session, 'browser_context') and self.session.browser_context:
                context = self.session.browser_context
                
                # Set up handler for new pages created in the context
                def on_page_created(page):
                    try:
                        print(f"🎧 Setting up console capture on new page: {page.url[:60]}...")
                        console_collector.setup_listeners(page)
                    except Exception as e:
                        print(f"⚠️ Error setting up console capture on page: {e}")
                
                # Listen for new pages
                context.on("page", on_page_created)
                print(f"🎧 Context-level page listener activated")
                
                # Set up on existing pages
                for page in context.pages:
                    on_page_created(page)
                    
            else:
                print(f"⚠️ No browser context available for console capture setup")
        except Exception as e:
            print(f"⚠️ Error setting up console capture: {e}")
            
        # Also try to set up on current page if available
        try:
            current_page = await self.session.get_current_page()
            if current_page:
                console_collector = self.state_capture.get_console_collector()
                console_collector.setup_listeners(current_page)
                print(f"✅ Console capture also set up on current page")
        except Exception as e:
            print(f"⚠️ Could not set up console capture on current page: {e}")
    
    async def _ensure_console_capture_on_page(self, page):
        """Ensure console capture is set up on a specific page"""
        if self.capture_state and page:
            try:
                console_collector = self.state_capture.get_console_collector()
                console_collector.setup_listeners(page)
                print(f"🔄 Console capture ensured on page")
            except Exception as e:
                print(f"⚠️ Error ensuring console capture on page: {e}")
            
    async def execute_task(self, task: str, llm: BaseChatModel):
        """
        Execute a task using browser-use Agent but with our persistent session.
        This is the key method that provides persistence while using browser-use automation.
        """
        if self.session is None:
            raise RuntimeError("Browser session not started. Call start() first.")
            
        self.task_count += 1
        print(f"🎯 Executing task #{self.task_count}: {task}")
        
        try:
            # Re-setup console capture before each task in case page changed
            if self.capture_state:
                try:
                    page = await self.session.get_current_page()
                    await self._ensure_console_capture_on_page(page)
                except Exception as e:
                    print(f"⚠️ Could not setup console capture before task: {e}")
            
            # Create browser-use Agent with our persistent session
            # This uses ALL of browser-use's automation logic, we just control the session
            agent = Agent(
                task=task,
                llm=llm,
                browser_session=self.session,
                enable_memory=True
            )
            
            # Prevent browser-use agent from closing our persistent browser session
            # Override the session's close methods to be no-ops for persistence
            original_stop = getattr(self.session, 'stop', None)
            original_close = getattr(self.session, 'close', None)
            original_aexit = getattr(self.session, '__aexit__', None)
            
            # Create no-op methods for browser session lifecycle
            def no_op_stop(*args, **kwargs):
                print(f"🔄 Skipping browser session stop for persistence")
                return None
                
            async def no_op_close(*args, **kwargs):
                print(f"🔄 Skipping browser session close for persistence")
                return None
                
            async def no_op_aexit(*args, **kwargs):
                print(f"🔄 Skipping browser session __aexit__ for persistence")
                return None
            
            # Replace the methods temporarily
            if original_stop:
                self.session.stop = no_op_stop
            if original_close:
                self.session.close = no_op_close
            if original_aexit:
                self.session.__aexit__ = no_op_aexit
            
            try:
                # Use browser-use's proven task execution
                result = await agent.run()
                
                # IMMEDIATELY capture state while browser is still active
                state_file_path = None
                if self.capture_state:
                    try:
                        print("📸 Capturing browser state while browser is still active...")
                        state_file_path = await self.state_capture.capture_state(
                            browser_session=self.session,
                            task_description=task
                        )
                        print(f"📄 Browser state file: {state_file_path}")
                    except Exception as e:
                        print(f"⚠️ Failed to capture browser state: {str(e)}")
                
                # Validate results using browser-use's format
                action_results = result.action_results()
                model_outputs = result.model_outputs()
                
                print(f"✅ Task #{self.task_count} completed with {len(action_results)} actions")
                
                return result
                
            finally:
                # Restore the original methods after task completion
                if original_stop:
                    self.session.stop = original_stop
                if original_close:
                    self.session.close = original_close
                if original_aexit:
                    self.session.__aexit__ = original_aexit
            
        except Exception as e:
            print(f"❌ Task #{self.task_count} failed: {str(e)}")
            
            # Still try to capture state on failure for debugging
            if self.capture_state:
                try:
                    state_file_path = await self.state_capture.capture_state(
                        browser_session=self.session,
                        task_description=f"FAILED_{task}"
                    )
                    print(f"📄 Error state file: {state_file_path}")
                except Exception as state_e:
                    print(f"⚠️ Failed to capture error state: {str(state_e)}")
            
            raise
            
    async def close(self):
        """Close the persistent browser session"""
        if self.session:
            try:
                print(f"🛑 Closing persistent browser wrapper...")
                await self.session.manual_close()
                self.session = None
                print(f"✅ Persistent browser wrapper closed successfully")
            except Exception as e:
                print(f"⚠️ Error during wrapper cleanup: {e}")
                # Reset session anyway to prevent hanging references
                self.session = None
                print(f"🔄 Session reference cleared despite cleanup error")
        
        # Also try to kill any hanging browser processes
        await self._cleanup_hanging_browsers()
    
    async def _cleanup_hanging_browsers(self):
        """Clean up any hanging browser processes that might be using our profile"""
        try:
            # Look for chromium processes using our profile directory
            profile_path = self.profile_dir
            result = subprocess.run([
                'pgrep', '-f', f'user-data-dir={profile_path}'
            ], capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                print(f"🔍 Found {len(pids)} hanging browser process(es) using profile")
                
                for pid in pids:
                    try:
                        pid = int(pid.strip())
                        print(f"🔪 Killing hanging browser process {pid}")
                        os.kill(pid, signal.SIGTERM)
                    except (ValueError, ProcessLookupError) as e:
                        print(f"⚠️ Could not kill process {pid}: {e}")
                        
                print(f"✅ Hanging browser cleanup completed")
            else:
                print(f"👍 No hanging browser processes found")
                
        except Exception as e:
            print(f"⚠️ Error during hanging browser cleanup: {e}")
            
    async def get_status(self):
        """Get wrapper status"""
        return {
            "session_active": self.session is not None,
            "tasks_completed": self.task_count,
            "profile_dir": self.profile_dir,
            "headless": self.headless
        }


# Convenience factory function
async def create_persistent_browser(profile_dir: str, headless: bool = False):
    """Factory function to create and start a persistent browser wrapper"""
    wrapper = PersistentBrowserWrapper(profile_dir, headless)
    await wrapper.start()
    return wrapper 