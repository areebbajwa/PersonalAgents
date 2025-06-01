#!/usr/bin/env python3
"""
Startup script for the Undetected Playwright MCP Server
This server provides browser automation with anti-detection capabilities.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.undetected_playwright_mcp import main

if __name__ == "__main__":
    print("🎭 Starting Undetected Playwright MCP Server...")
    print("This server bypasses browser automation detection using undetected-playwright")
    main() 