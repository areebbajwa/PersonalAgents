#!/usr/bin/env python3
"""
Browser Service - Updated to use PersistentBrowserWrapper
Now uses our wrapper that extends browser-use while controlling session lifecycle.
"""

import asyncio
import json
import sys
import signal
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import os
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
    sys.path.append(str(Path(__file__).parent))
    from persistent_browser_wrapper import PersistentBrowserWrapper
except ImportError as e:
    print(f"❌ Error: Missing required dependencies: {e}")
    sys.exit(1)

# Configuration
PERSISTENT_PROFILE_DIR = os.path.expanduser("~/.config/browseruse/profiles/google_account_persistent")
SERVICE_PORT = 8765

app = FastAPI(title="Browser-use Service", description="Persistent browser automation service using wrapper")

class TaskRequest(BaseModel):
    task: str
    headless: bool = True
    enable_memory: bool = True

class BrowserService:
    def __init__(self):
        self.browser_wrapper = None
        self.llm = None
        self.running = True
        
    async def initialize(self):
        """Initialize the browser service"""
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise Exception("GOOGLE_API_KEY not found")
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key
        )
        
        print(f"🚀 Browser service initialized")
    
    async def ensure_browser_wrapper(self, headless=True):
        """Ensure browser wrapper is started"""
        if self.browser_wrapper is None:
            print(f"📱 Creating persistent browser wrapper (headless={headless})...")
            self.browser_wrapper = PersistentBrowserWrapper(
                profile_dir=PERSISTENT_PROFILE_DIR,
                headless=headless
            )
            await self.browser_wrapper.start()
            print(f"✅ Persistent browser wrapper ready")
        else:
            print(f"🔄 Reusing existing browser wrapper")
        
        return self.browser_wrapper
    
    async def execute_task(self, task_description, headless=True, enable_memory=True):
        """Execute a browser automation task using the wrapper"""
        try:
            # Ensure wrapper is ready
            wrapper = await self.ensure_browser_wrapper(headless)
            
            # Execute task using wrapper (which uses browser-use internally)
            result = await wrapper.execute_task(task_description, self.llm)
            
            # Get status from wrapper
            status = await wrapper.get_status()
            print(f"📊 Wrapper status: {status}")
            
            return {
                "success": True,
                "result": str(result),
                "message": "Task completed successfully",
                "tasks_completed": status["tasks_completed"]
            }
            
        except Exception as e:
            print(f"❌ Task execution failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "result": None,
                "message": f"Task failed: {str(e)}"
            }
    
    async def shutdown(self):
        """Shutdown the browser service"""
        self.running = False
        if self.browser_wrapper:
            print(f"🛑 Closing browser wrapper...")
            await self.browser_wrapper.close()
            self.browser_wrapper = None
            print(f"✅ Browser wrapper closed")
        print(f"🛑 Browser service shutting down...")

# Global service instance
service = BrowserService()

@app.on_event("startup")
async def startup_event():
    await service.initialize()

@app.on_event("shutdown") 
async def shutdown_event():
    await service.shutdown()

@app.post("/task")
async def execute_task(request: TaskRequest):
    """Execute a browser automation task"""
    result = await service.execute_task(
        task_description=request.task,
        headless=request.headless,
        enable_memory=request.enable_memory
    )
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])

@app.get("/status")
async def get_status():
    """Get service status"""
    wrapper_status = {}
    if service.browser_wrapper:
        wrapper_status = await service.browser_wrapper.get_status()
    
    return {
        "status": "running" if service.running else "stopped",
        "wrapper_active": service.browser_wrapper is not None,
        **wrapper_status
    }

@app.post("/shutdown")
async def shutdown_service():
    """Shutdown the service"""
    await service.shutdown()
    return {"message": "Service shutting down"}

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    print(f"\n🛑 Received shutdown signal...")
    asyncio.create_task(service.shutdown())

if __name__ == "__main__":
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print(f"🚀 Starting Browser Service on port {SERVICE_PORT}")
    print(f"📡 Service will be available at http://localhost:{SERVICE_PORT}")
    print(f"🔄 Using PersistentBrowserWrapper for true session persistence")
    
    uvicorn.run(
        app,
        host="localhost",
        port=SERVICE_PORT,
        log_level="info"
    ) 