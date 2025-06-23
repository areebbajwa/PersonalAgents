#!/usr/bin/env python3

import subprocess
import json
import sys
from pathlib import Path

def run_command(cmd):
    """Run a workflow-cli command and return the output"""
    # Run from project root directory
    project_root = Path(__file__).parent.parent.parent
    full_cmd = f"cd {project_root} && {cmd}"
    result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
    return result.stdout, result.returncode

def test_basic_functionality():
    """Test basic workflow CLI functionality"""
    tests_passed = 0
    tests_total = 0
    
    print("Testing Workflow CLI...")
    print("=" * 50)
    
    # Test 1: Help command
    tests_total += 1
    print("\n1. Testing help command...")
    output, code = run_command("workflow-cli --help")
    if code == 0 and "Workflow CLI" in output:
        print("✓ Help command works")
        tests_passed += 1
    else:
        print("✗ Help command failed")
    
    # Test 2: Reset workflow
    tests_total += 1
    print("\n2. Testing workflow reset...")
    output, code = run_command("workflow-cli --reset --json")
    if code == 0:
        data = json.loads(output)
        if data.get("status") == "reset":
            print("✓ Reset command works")
            tests_passed += 1
        else:
            print("✗ Reset command failed")
    
    # Test 3: Get dev mode rules
    tests_total += 1
    print("\n3. Testing dev mode rules...")
    output, code = run_command("workflow-cli --mode dev --json")
    if code == 0:
        data = json.loads(output)
        if data.get("mode") == "dev" and "rules" in data:
            print(f"✓ Dev mode returns {len(data['rules'])} rules")
            tests_passed += 1
        else:
            print("✗ Dev mode failed")
    
    # Test 4: Get specific step
    tests_total += 1
    print("\n4. Testing specific step retrieval...")
    output, code = run_command("workflow-cli --mode dev --step 1 --json")
    if code == 0:
        data = json.loads(output)
        if data.get("current_step") == 1:
            print("✓ Step retrieval works")
            tests_passed += 1
        else:
            print("✗ Step retrieval failed")
    
    # Test 5: Advance to next step
    tests_total += 1
    print("\n5. Testing step advancement...")
    output, code = run_command("workflow-cli --mode dev --next --json")
    if code == 0:
        try:
            data = json.loads(output)
            if data.get("current_step") and data["current_step"] > 0:
                print(f"✓ Advanced to step {data['current_step']}")
                tests_passed += 1
            else:
                print("✗ Step advancement failed")
        except json.JSONDecodeError:
            print(f"✗ Invalid JSON output: {output}")
    
    # Test 6: Track test status
    tests_total += 1
    print("\n6. Testing test tracking...")
    output, code = run_command("workflow-cli --track-test test_example passed --json")
    if code == 0:
        try:
            data = json.loads(output)
            if data.get("status") == "passed":
                print("✓ Test tracking works")
                tests_passed += 1
            else:
                print("✗ Test tracking failed")
        except json.JSONDecodeError:
            print(f"✗ Invalid JSON output: {output}")
    
    # Test 7: Get task mode rules
    tests_total += 1
    print("\n7. Testing task mode rules...")
    output, code = run_command("workflow-cli --mode task --json")
    if code == 0:
        try:
            data = json.loads(output)
            if data.get("mode") == "task" and "rules" in data:
                print(f"✓ Task mode returns {len(data['rules'])} rules")
                tests_passed += 1
            else:
                print(f"✗ Task mode failed - unexpected data: {data}")
        except json.JSONDecodeError:
            print(f"✗ Invalid JSON output: {output}")
    
    # Summary
    print("\n" + "=" * 50)
    print(f"Tests passed: {tests_passed}/{tests_total}")
    
    if tests_passed == tests_total:
        print("\n✓ All tests passed!")
        return 0
    else:
        print(f"\n✗ {tests_total - tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(test_basic_functionality())