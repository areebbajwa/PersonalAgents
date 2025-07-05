#!/usr/bin/env python3
"""Script to write to a test file every 5 seconds for 2 minutes"""

import time
from datetime import datetime

def main():
    # Configuration
    output_file = "test_output.txt"
    interval_seconds = 5
    duration_seconds = 120
    
    # Calculate number of writes
    num_writes = duration_seconds // interval_seconds
    
    print(f"Starting to write to {output_file} every {interval_seconds} seconds for {duration_seconds} seconds")
    print(f"Total writes expected: {num_writes}")
    
    # Open file in append mode
    with open(output_file, 'a') as f:
        start_time = time.time()
        write_count = 0
        
        while write_count < num_writes:
            # Get current timestamp
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Write to file
            f.write(f"Write #{write_count + 1} at {current_time}\n")
            f.flush()  # Ensure immediate write
            
            write_count += 1
            print(f"Write #{write_count} completed at {current_time}")
            
            # Wait for next interval (unless it's the last write)
            if write_count < num_writes:
                time.sleep(interval_seconds)
        
        # Final summary
        end_time = time.time()
        elapsed_time = end_time - start_time
        f.write(f"\nCompleted {write_count} writes in {elapsed_time:.2f} seconds\n")
    
    print(f"\nDone! Completed {write_count} writes in {elapsed_time:.2f} seconds")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    main()