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
import asyncio

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
            headless=headless,
            keep_alive=True
        )
        
        # Initialize BrowserSession with the browser_profile
        super().__init__(browser_profile=browser_profile)
        self._is_persistent = True
        self._manually_closed = False
        self._disconnect_listener_attached = False
        
    async def start_with_disconnect_listener(self):
        """Starts the browser session using parent's start and then attaches listener."""
        print(f"🚀 PersistentBrowserSession: Attempting to start browser via self.start()...")
        try:
            await self.start() # This is browser_use's BaseBrowserSession.start()
            print(f"✅ PersistentBrowserSession: self.start() completed.")
        except Exception as e:
            print(f"❌ PersistentBrowserSession: Error during self.start(): {e}")
            # Optionally re-raise or handle, but for now, let it proceed to browser check

        actual_browser_object = None
        if hasattr(self, 'browser') and self.browser:
            print(f"ℹ️ Found browser object via self.browser (type: {type(self.browser)})")
            actual_browser_object = self.browser
        else:
            print(f"⚠️ self.browser is None or not found after self.start().")
            # As a fallback, check self.browser_profile.browser, though self.browser is primary
            if hasattr(self, 'browser_profile') and hasattr(self.browser_profile, 'browser') and self.browser_profile.browser:
                print(f"ℹ️ Fallback: Found browser object via self.browser_profile.browser (type: {type(self.browser_profile.browser)})")
                actual_browser_object = self.browser_profile.browser
            else:
                print(f"⚠️ Fallback: self.browser_profile.browser is also None or not found.")

        if actual_browser_object:
            if actual_browser_object.is_connected():
                if not self._disconnect_listener_attached:
                    print(f"🎧 Attaching 'disconnected' event listener to browser object: {type(actual_browser_object)}")
                    actual_browser_object.on("disconnected", self.handle_browser_disconnected)
                    self._disconnect_listener_attached = True
                    print(f"✅ 'disconnected' event listener attached successfully.")
                else:
                    print(f"ℹ️ 'disconnected' event listener already attached.")
            else:
                print(f"⚠️ Browser object found (type: {type(actual_browser_object)}) but not connected. Cannot attach listener.")
        else:
            print(f"❌ Browser object NOT found by any means after self.start(). Cannot attach 'disconnected' listener.")

    async def __aenter__(self):
        """Ensures browser starts with listener. Called by PersistentBrowserWrapper."""
        # Wrapper will call start_with_disconnect_listener directly now.
        # This method still needs to be compatible if something calls it directly.
        await self.start_with_disconnect_listener()
        return self
        
    async def handle_browser_disconnected(self):
        """Callback for when Playwright's browser disconnects unexpectedly."""
        print(f"🚨 BROWSER DISCONNECTED EVENT RECEIVED (Manually or Unexpectedly) 🚨")
        
        # Avoid re-triggering if already manually closing
        if self._manually_closed:
            print(f"ℹ️ Browser disconnected event ignored, already in manual_close process.")
            return

        print(f"🔥 Browser disconnected! Signaling service (PID: {os.getpid()}) to shut down...")
        self._manually_closed = True # Mark as manually closed to prevent issues in __aexit__
        try:
            # Attempt to remove the listener to prevent multiple calls if possible
            # This might fail if the browser object is already too far gone.
            if self.browser:
                print(f"🎧 Attempting to remove 'disconnected' event listener.")
                self.browser.remove_listener("disconnected", self.handle_browser_disconnected)
        except Exception as e:
            print(f"⚠️ Could not remove 'disconnected' listener (might be normal): {e}")
            
        os.kill(os.getpid(), signal.SIGTERM)
        # The service's signal handler should now take over and call service.shutdown(),
        # which will eventually call this session's manual_close() if needed.

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
        """Manually close the session when we're done (e.g. service shutting down)"""
        print(f"ℹ️ PersistentBrowserSession.manual_close() called. Current state: _manually_closed={self._manually_closed}, _disconnect_listener_attached={self._disconnect_listener_attached}")
        self._manually_closed = True
        
        browser_to_close = None
        if hasattr(self, 'browser') and self.browser:
            print(f"  manual_close: Found self.browser (type: {type(self.browser)}, connected: {self.browser.is_connected() if hasattr(self.browser, 'is_connected') else 'N/A'})")
            browser_to_close = self.browser
        elif hasattr(self, 'browser_profile') and hasattr(self.browser_profile, 'browser') and self.browser_profile.browser:
            # This is a fallback, self.browser should ideally be set by browser-use library
            print(f"  manual_close: self.browser not found or None. Using self.browser_profile.browser (type: {type(self.browser_profile.browser)}, connected: {self.browser_profile.browser.is_connected() if hasattr(self.browser_profile.browser, 'is_connected') else 'N/A'})")
            browser_to_close = self.browser_profile.browser
        else:
            print(f"  manual_close: No valid browser object (self.browser or self.browser_profile.browser) found to close or remove listener from.")

        if browser_to_close and self._disconnect_listener_attached:
            try:
                print(f"  manual_close: Attempting to remove 'disconnected' event listener from {type(browser_to_close)}.")
                browser_to_close.remove_listener("disconnected", self.handle_browser_disconnected)
                self._disconnect_listener_attached = False # Mark as detached
                print(f"  manual_close: 'disconnected' event listener removed.")
            except Exception as e:
                print(f"  manual_close: ⚠️ Warning: Could not remove 'disconnected' listener: {e}")
        elif self._disconnect_listener_attached:
            print(f"  manual_close: Listener was attached, but no browser object found to remove it from.")

        try:
            print(f"  manual_close: Calling super().__aexit__ to close browser via Playwright parent (browser-use library). Object being passed to parent: {type(super())}")
            await super().__aexit__(None, None, None)
            print(f"  manual_close: ✅ super().__aexit__ completed. Browser process should be closed.")
        except Exception as e:
            print(f"  manual_close: ⚠️⚠️ CRITICAL WARNING during super().__aexit__: {e} ⚠️⚠️")
            print(f"  manual_close: Attempting to force close browser due to error in super().__aexit__.")
            if browser_to_close and hasattr(browser_to_close, 'is_connected') and browser_to_close.is_connected():
                try:
                    print(f"    manual_close_force: Forcing browser.close() on {type(browser_to_close)}")
                    await browser_to_close.close()
                    print(f"    manual_close_force: ✅ Forced browser_to_close.close() completed.")
                except Exception as force_error:
                    print(f"    manual_close_force: ⚠️ Force browser_to_close.close() also failed: {force_error}")
            elif browser_to_close:
                print(f"    manual_close_force: Browser object found but not connected or no is_connected method.")
            else:
                print(f"    manual_close_force: No browser object available for forced close.")
        print(f"ℹ️ PersistentBrowserSession.manual_close() finished.")


class PersistentBrowserWrapper:
    """
    Manages a single, persistent browser session that can be reused by multiple
    browser-use Agent instances. Handles starting, stopping, and providing
    the session to agents.
    """
    def __init__(self, profile_dir: str, headless: bool = False, capture_state: bool = True, state_output_dir: str | None = None):
        self.profile_dir = profile_dir
        self.headless = headless
        self.capture_state = capture_state
        self.session: PersistentBrowserSession | None = None
        self.tasks_completed = 0
        self._lock = asyncio.Lock()

        if self.capture_state:
            actual_state_output_dir = state_output_dir if state_output_dir else os.path.expanduser("~/.config/browseruse/browser_states")
            os.makedirs(actual_state_output_dir, exist_ok=True)
            self.state_capture = BrowserStateCapture(output_dir=actual_state_output_dir)
        else:
            self.state_capture = None # Explicitly set to None if not capturing

    async def start(self):
        async with self._lock:
            if not self.session:
                print(f"📱 Creating persistent browser session (headless={self.headless}, capture_state={self.capture_state})...")
                # Ensure the profile directory exists
                os.makedirs(self.profile_dir, exist_ok=True)
                self.session = PersistentBrowserSession(profile_dir=self.profile_dir, headless=self.headless)
                try:
                    # Use the new method to start and attach listener
                    await self.session.start_with_disconnect_listener()
                    print(f"🚀 Persistent browser wrapper started and listener attachment attempted.")
                except Exception as e:
                    print(f"❌ Error starting persistent browser session: {e}")
                    self.session = None # Ensure session is None if start fails
                    raise
            else:
                print("🛠️ Persistent browser session already active.")
            return self.is_active()

    async def stop(self):
        async with self._lock:
            if self.session:
                print("🛑 Stopping persistent browser session...")
                await self.session.manual_close() # Use manual_close to trigger proper shutdown
                self.session = None
                print("✅ Persistent browser session stopped.")
            else:
                print("🤷 No active persistent browser session to stop.")

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
            
        self.tasks_completed += 1
        print(f"🎯 Executing task #{self.tasks_completed}: {task}")
        
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
            # These should return the session object to allow chaining if the original methods did
            def no_op_stop(*args, **kwargs):
                print(f"🔄 Skipping browser session stop for persistence (called via no_op_stop)")
                return self.session # Return the session instance
                
            async def no_op_close(*args, **kwargs):
                print(f"🔄 Skipping browser session close for persistence (called via no_op_close)")
                return self.session # Return the session instance
                
            async def no_op_aexit(*args, **kwargs):
                print(f"🔄 Skipping browser session __aexit__ for persistence (called via no_op_aexit)")
                return self.session # Return the session instance
            
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
                
                print(f"✅ Task #{self.tasks_completed} completed with {len(action_results)} actions")
                
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
            print(f"❌ Task #{self.tasks_completed} failed: {str(e)}")
            
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
            
    async def get_status(self):
        """Get wrapper status"""
        return {
            "session_active": self.session is not None,
            "tasks_completed": self.tasks_completed,
            "profile_dir": self.profile_dir,
            "headless": self.headless
        }

    def is_active(self):
        """Check if the session is active"""
        return self.session is not None


# Convenience factory function
async def create_persistent_browser(profile_dir: str, headless: bool = False):
    """Factory function to create and start a persistent browser wrapper"""
    wrapper = PersistentBrowserWrapper(profile_dir, headless)
    await wrapper.start()
    return wrapper 