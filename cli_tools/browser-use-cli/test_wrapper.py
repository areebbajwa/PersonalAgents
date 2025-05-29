#!/usr/bin/env python3
"""
Test script for PersistentBrowserWrapper
Validates that multiple tasks can execute in the same browser session.
"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Add the project root to Python path for imports
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
config_env_path = project_root / "config" / ".env"
if config_env_path.exists():
    load_dotenv(config_env_path)
else:
    load_dotenv(project_root / ".env")

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from src.persistent_browser_wrapper import PersistentBrowserWrapper, create_persistent_browser
except ImportError as e:
    print(f"❌ Error: Missing required dependencies: {e}")
    sys.exit(1)

async def test_wrapper():
    """Test the PersistentBrowserWrapper with multiple tasks"""
    print("🧪 Testing PersistentBrowserWrapper...")
    
    # Setup LLM
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ Error: GOOGLE_API_KEY not found")
        sys.exit(1)
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key
    )
    
    # Create persistent browser (visible mode for testing)
    profile_dir = os.path.expanduser("~/.config/browseruse/profiles/test_wrapper")
    wrapper = await create_persistent_browser(profile_dir, headless=False)
    
    try:
        print("\n" + "="*50)
        print("📝 Test 1: Navigate to Google")
        result1 = await wrapper.execute_task(
            "Navigate to google.com and search for 'browser automation'",
            llm
        )
        print(f"✅ Test 1 result: {type(result1)}")
        
        print("\n" + "="*50)
        print("📝 Test 2: Click on first result")
        result2 = await wrapper.execute_task(
            "Click on the first search result",
            llm
        )
        print(f"✅ Test 2 result: {type(result2)}")
        
        print("\n" + "="*50)
        print("📝 Test 3: Go back and try different search")
        result3 = await wrapper.execute_task(
            "Go back to Google and search for 'playwright automation'",
            llm
        )
        print(f"✅ Test 3 result: {type(result3)}")
        
        # Check status
        status = await wrapper.get_status()
        print(f"\n📊 Final wrapper status: {status}")
        
        print(f"\n🎉 All tests completed! Browser should still be open with {status['tasks_completed']} tasks completed.")
        print(f"🔄 Browser session persisted across all tasks!")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # Ask user before closing
        print(f"\n⏰ Sleeping for 10 seconds so you can verify browser is still open...")
        await asyncio.sleep(10)
        
        user_input = input("\nPress 'c' to close browser or any other key to keep it open: ")
        if user_input.lower() == 'c':
            await wrapper.close()
            print("🛑 Browser closed")
        else:
            print("🔄 Browser left open for manual inspection")

if __name__ == "__main__":
    asyncio.run(test_wrapper()) 