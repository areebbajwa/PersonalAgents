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
        # Use browser-use's BrowserProfile but with our persistence settings
        profile = BrowserProfile(
            user_data_dir=profile_dir,
            headless=headless,
            keep_alive=True  # We manage lifecycle manually
        )
        super().__init__(browser_profile=profile)
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
    
    def __init__(self, profile_dir: str, headless: bool = False):
        self.profile_dir = profile_dir
        self.headless = headless
        self.session = None
        self.task_count = 0
        
    async def start(self):
        """Start the persistent browser session"""
        if self.session is None:
            self.session = PersistentBrowserSession(self.profile_dir, self.headless)
            await self.session.__aenter__()
            print(f"🚀 Persistent browser wrapper started")
        else:
            print(f"🔄 Browser session already running")
            
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
            # Create browser-use Agent with our persistent session
            # This uses ALL of browser-use's automation logic, we just control the session
            agent = Agent(
                task=task,
                llm=llm,
                browser_session=self.session,
                enable_memory=True
            )
            
            # Use browser-use's proven task execution
            result = await agent.run()
            
            # Validate results using browser-use's format
            action_results = result.action_results()
            model_outputs = result.model_outputs()
            
            print(f"✅ Task #{self.task_count} completed with {len(action_results)} actions")
            
            # Prevent agent from closing our session
            # Override the agent's cleanup to be a no-op
            original_close = getattr(agent, 'close', None)
            if original_close:
                agent.close = lambda: print(f"🔄 Agent cleanup skipped for persistent session")
                
            return result
            
        except Exception as e:
            print(f"❌ Task #{self.task_count} failed: {str(e)}")
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