# Autonomous Execution Guide for CLI Tools

This guide documents the interactive modes found in CLI tools and how to ensure autonomous execution.

## Problem Statement
Interactive modes in CLI tools block autonomous execution in workflows and scripts. Tools that wait for user input prevent automation from completing.

## Interactive Modes Identified

### 1. screenshot-cli
**Interactive Commands:**
- `-w, --window`: Opens interactive window selection mode
- `-r, --region`: Opens interactive region selection mode

**Non-Interactive Alternatives:**
- Default mode (fullscreen): `screenshot-cli -o output.png`
- Window by ID: `screenshot-cli --window-id 123 -o output.png`
- With delay: `screenshot-cli -d 5 -o output.png`

### 2. ai-monitor-cli
**Interactive Commands:**
- `monitor` without flags: Runs continuous monitoring loop
- `monitor-all`: Runs live display with periodic updates

**Non-Interactive Alternatives:**
- Single run mode: `ai-monitor-cli monitor --once --session session-name`

## All Other CLI Tools
The following tools were verified to have NO blocking interactive modes:
- selenium-cli
- gmail-cli
- pdf-ai-cli
- spawn-cli
- workflow-cli
- firebase-cli
- google-sheets-cli
- openrouter-multi-model
- desktop-automation-cli
- startup-manager
- screen-tools/*
- record-cli

## Testing for Autonomous Execution

Run the test script to verify all tools can execute autonomously:
```bash
./tests/test-autonomous-execution.sh
```

The test will:
1. Verify non-interactive commands complete successfully
2. Confirm interactive commands timeout as expected
3. Provide recommendations for autonomous usage

## Best Practices for Autonomous Execution

1. **Always use non-interactive flags** when available
2. **Set timeouts** for commands that might hang
3. **Test scripts** with the autonomous execution test
4. **Document** any interactive features in new tools
5. **Provide non-interactive alternatives** when creating new tools

## Example Usage in Scripts

```bash
# Good - Non-blocking commands
screenshot-cli -o screenshot.png
ai-monitor-cli monitor --once --session my-session

# Bad - Blocking commands
screenshot-cli -w -o screenshot.png  # Waits for window selection
ai-monitor-cli monitor --session my-session  # Runs forever
```