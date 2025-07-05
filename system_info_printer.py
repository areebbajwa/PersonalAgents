#!/usr/bin/env python3
"""Script to print system info every 30 seconds for 10 minutes"""

import time
import platform
import os
import psutil
from datetime import datetime

def get_system_info():
    """Gather system information"""
    info = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "platform": platform.system(),
        "platform_version": platform.version(),
        "cpu_count": os.cpu_count(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
        "boot_time": datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
    }
    return info

def main():
    # Configuration
    interval_seconds = 30
    duration_seconds = 600  # 10 minutes
    
    # Calculate number of prints
    num_prints = duration_seconds // interval_seconds
    
    print(f"Starting system info monitor - printing every {interval_seconds} seconds for {duration_seconds} seconds")
    print(f"Total prints expected: {num_prints}")
    print("-" * 80)
    
    start_time = time.time()
    print_count = 0
    
    while print_count < num_prints:
        # Get system info
        info = get_system_info()
        
        # Print system info
        print(f"\n[Print #{print_count + 1}] {info['timestamp']}")
        print(f"Platform: {info['platform']} - {info['platform_version'][:50]}...")
        print(f"CPU: {info['cpu_count']} cores, {info['cpu_percent']}% usage")
        print(f"Memory: {info['memory_percent']}% used")
        print(f"Disk: {info['disk_percent']}% used")
        print(f"System boot time: {info['boot_time']}")
        
        print_count += 1
        
        # Wait for next interval (unless it's the last print)
        if print_count < num_prints:
            print(f"\nNext update in {interval_seconds} seconds...")
            time.sleep(interval_seconds)
    
    # Final summary
    end_time = time.time()
    elapsed_time = end_time - start_time
    print("\n" + "=" * 80)
    print(f"Done! Completed {print_count} prints in {elapsed_time:.2f} seconds")

if __name__ == "__main__":
    main()