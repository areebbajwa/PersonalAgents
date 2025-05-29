#!/usr/bin/env python3
"""
Browser-use CLI Tool - Convert natural language to browser automation

A command-line interface for automating web browsers using AI.
Can run in direct mode or communicate with a persistent browser service.
"""

import argparse
import asyncio
import sys
import os
import subprocess
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

# Add the project root to Python path for imports
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from config/.env
config_env_path = project_root / "config" / ".env"
if config_env_path.exists():
    load_dotenv(config_env_path)
else:
    # Fallback to .env in project root
    load_dotenv(project_root / ".env")

try:
    from browser_use import Agent
    from browser_use.browser.profile import BrowserProfile
    from browser_use.browser.session import BrowserSession
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError as e:
    print(f"❌ Error: Missing required dependencies: {e}")
    print("💡 Please ensure browser-use is installed in your Python environment")
    sys.exit(1)

# --- Configuration for browser persistence ---
PERSISTENT_PROFILE_DIR = os.path.expanduser("~/.config/browseruse/profiles/google_account_persistent")
SERVICE_PORT = 8765
SERVICE_URL = f"http://localhost:{SERVICE_PORT}"
# --- End Configuration ---

class BrowserUseCLI:
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            print("❌ Error: GOOGLE_API_KEY not found")
            print("💡 Please set GOOGLE_API_KEY in config/.env or as environment variable")
            sys.exit(1)
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=self.api_key
        )

    def is_service_running(self):
        """Check if the browser service is running"""
        try:
            response = requests.get(f"{SERVICE_URL}/status", timeout=2)
            return response.status_code == 200
        except:
            return False

    def start_service(self, headless=True):
        """Start the browser service in the background"""
        service_script = Path(__file__).parent / "browser_service.py"
        
        print(f"🚀 Starting browser service...")
        
        # Use the Python executable from the same environment
        python_executable = sys.executable
        
        # Start service in background
        args = [python_executable, str(service_script)]
        if headless:
            args.append("--headless")
            
        process = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        
        # Wait for service to start
        print(f"⏳ Waiting for service to start...")
        for i in range(10):
            if self.is_service_running():
                print(f"✅ Browser service started successfully")
                return True
            time.sleep(1)
        
        print(f"❌ Failed to start browser service")
        return False

    async def run_task_via_service(self, task_description, headless=True, enable_memory=True):
        """Run task via the browser service"""
        
        # Check if service is running
        if not self.is_service_running():
            print(f"📡 Browser service not running, starting it...")
            if not self.start_service(headless):
                return False
        
        try:
            print(f"📡 Sending task to browser service...")
            response = requests.post(
                f"{SERVICE_URL}/task",
                json={
                    "task": task_description,
                    "headless": headless,
                    "enable_memory": enable_memory
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ Task completed successfully!")
                print(f"📄 Result: {result['result']}")
                print(f"🔄 Browser service is keeping browser session alive")
                print(f"💡 Run more tasks or use 'browser-use --stop-service' to stop")
                return True
            else:
                print(f"\n❌ Task failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"\n❌ Failed to communicate with service: {str(e)}")
            return False

    def stop_service(self):
        """Stop the browser service"""
        try:
            if not self.is_service_running():
                print(f"📡 Browser service is not running")
                return True
                
            response = requests.post(f"{SERVICE_URL}/shutdown", timeout=5)
            if response.status_code == 200:
                print(f"🛑 Browser service stopped")
                return True
            else:
                print(f"❌ Failed to stop service: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Failed to stop service: {str(e)}")
            return False

    async def run_task_direct(self, task_description, headless=True, enable_memory=True, keep_open=False):
        """Run task directly (original implementation)"""
        print(f"🚀 Running browser automation task (direct mode)...")
        print(f"📝 Task: {task_description}")
        print(f"🖥️  Headless mode: {'ON' if headless else 'OFF'}")
        print(f"🧠 Memory: {'ON' if enable_memory else 'OFF'}")
        print(f"🔄 Keep open: {'YES' if keep_open else 'NO'}")
        print("-" * 60)
        
        try:
            browser_profile = BrowserProfile(
                headless=headless,
                keep_alive=keep_open,
                user_data_dir=PERSISTENT_PROFILE_DIR
            )
            
            browser_session = BrowserSession(browser_profile=browser_profile)
            
            agent = Agent(
                task=task_description,
                llm=self.llm,
                browser_session=browser_session,
                enable_memory=enable_memory
            )
            
            result = await agent.run()
            
            print(f"\n✅ Task completed successfully!")
            print(f"📄 Result: {result}")
            
            if keep_open:
                print(f"🔄 Browser will remain open - press Ctrl+C to close")
                print(f"💡 You can log into Google to preserve your account session")
                try:
                    # Keep the script running to prevent browser closure
                    while True:
                        await asyncio.sleep(1)
                except KeyboardInterrupt:
                    print(f"\n👋 Closing browser session...")
                    await browser_session.close()
                    print(f"✅ Browser closed")
            else:
                print(f"💡 Browser will close when script exits")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Task failed: {str(e)}")
            print("💡 Try simplifying your task or check your internet connection")
            return False

def print_examples():
    """Print example automation tasks"""
    examples = [
        "Search for 'AI news' on Google and summarize the top 3 results",
        "Compare iPhone 15 Pro prices on Amazon and Best Buy",
        "Go to GitHub and find the browser-use repository, get the star count",
        "Navigate to weather.com and get today's forecast for San Francisco",
        "Go to Hacker News and find the top 5 trending stories",
        "Search for 'Python tutorials' on YouTube and get the first result",
        "Visit Reddit.com and find the most upvoted post today",
        "Go to ProductHunt and find today's top 3 products",
        "Search Google Scholar for 'machine learning papers' from 2024",
        "Visit Stack Overflow and find questions about browser automation"
    ]
    
    print("\n💡 Example Browser Automation Tasks:")
    print("=" * 50)
    for i, example in enumerate(examples, 1):
        print(f"{i:2d}. {example}")
    
    print(f"\n🔧 Usage Examples:")
    print(f"\n🔄 Service Mode (DEFAULT - persistent browser sessions):")
    print(f"  browser-use \"Log into Google\"  # Browser stays open")
    print(f"  browser-use \"Search for AI news\"  # Reuses existing session")
    print(f"  browser-use \"Check my Gmail\"  # Still using same browser")
    print(f"  browser-use --stop-service  # Stop when completely done")
    
    print(f"\n📱 Direct Mode (browser closes after each task):")
    print(f"  browser-use --direct \"Quick search task\"")
    print(f"  browser-use --direct --keep-open \"Log into Gmail\"  # Stays open until Ctrl+C")
    
    print(f"\n👻 Headless Mode (invisible browser):")
    print(f"  browser-use --headless \"Background data scraping\"")
    print(f"  browser-use --direct --headless \"One-off invisible task\"")
    
    print(f"\n📋 Mode Summary:")
    print(f"  🔄 Default: Service Mode + Visible Browser (best for interactive use)")
    print(f"  📱 --direct: Traditional one-off tasks")
    print(f"  👻 --headless: Background/scripted automation")
    print()

def main():
    parser = argparse.ArgumentParser(
        description="Browser automation CLI using browser-use library with persistent sessions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  browser-use "go to reddit.com and find the top post"
  browser-use "search for python tutorials on YouTube" --headless
  browser-use --examples
  browser-use --stop-service
  browser-use --test-wrapper

For more help: browser-use --help
        """
    )
    parser.add_argument("task", nargs="?", help="Task description for browser automation")
    parser.add_argument("--direct", action="store_true", help="Run in direct mode (browser closes after task)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode (invisible)")
    parser.add_argument("--stop-service", action="store_true", help="Stop the persistent browser service")
    parser.add_argument("--examples", action="store_true", help="Show usage examples")
    parser.add_argument("--test-wrapper", action="store_true", help="Test the new persistent browser wrapper")

    args = parser.parse_args()

    if args.examples:
        print_examples()
        return
        
    if args.test_wrapper:
        test_wrapper()
        return

    if args.stop_service:
        cli = BrowserUseCLI()
        cli.stop_service()
        return

    cli = BrowserUseCLI()
    
    # Require task for automation
    if not args.task:
        parser.print_help()
        print(f"\n❌ Error: Task description is required")
        print(f"💡 Use --examples to see example tasks")
        sys.exit(1)
    
    try:
        # New defaults: visible mode and service mode
        run_headless = args.headless  # Default is False (visible)
        use_service_mode = not args.direct  # Default is True (service mode)
        
        if use_service_mode:
            # Service mode - browser persists between tasks (DEFAULT)
            success = asyncio.run(cli.run_task_via_service(
                task_description=args.task,
                headless=run_headless,
                enable_memory=True
            ))
        else:
            # Direct mode - original behavior
            success = asyncio.run(cli.run_task_direct(
                task_description=args.task,
                headless=run_headless, 
                enable_memory=True,
                keep_open=False
            ))
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\n👋 Task interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        sys.exit(1)

def test_wrapper():
    """Run the wrapper test script"""
    print("🧪 Testing PersistentBrowserWrapper...")
    
    # Get the current directory and construct the test script path
    current_dir = Path(__file__).parent.parent
    test_script = current_dir / "test_wrapper.py"
    venv_python = current_dir.parent.parent / ".venv" / "bin" / "python"
    
    if not test_script.exists():
        print(f"❌ Error: Test script not found at {test_script}")
        return
        
    if not venv_python.exists():
        print(f"❌ Error: Virtual environment Python not found at {venv_python}")
        return
    
    try:
        # Run the test script using the virtual environment Python
        print(f"▶️ Running test script with virtual environment Python...")
        os.system(f'cd "{current_dir}" && "{venv_python}" test_wrapper.py')
    except Exception as e:
        print(f"❌ Error running test script: {e}")

if __name__ == "__main__":
    main() 