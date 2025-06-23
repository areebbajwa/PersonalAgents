# Global Claude Code Workflow

## WORKFLOW: Standard Operation

### STEP 1: Check for Mode Triggers
**First thing in EVERY response**
- Look for "task mode" → Switch to task-mode.mdc
- Look for "dev mode" → Switch to dev-mode.mdc
- If no mode trigger → Continue with standard workflow

### STEP 2: Handle User Feedback IMMEDIATELY
**Before doing ANYTHING else**
1. Did user provide feedback, correction, or preference?
2. If YES → Update the appropriate file NOW:
   - General AI behavior → Update this file
   - Mode-specific → Update dev-mode.mdc or task-mode.mdc
   - Project-specific → Update LEARNINGS.md
3. Confirm: "✅ Updated [file] with your feedback about [topic]"
4. Only AFTER updating → Continue with task

### STEP 3: Execute Task
**Follow these patterns**
1. **For terminal commands**:
   - Never block terminal (2-minute max)
   - Use background execution: `command > log.txt 2>&1 &`
   - Check results: `sleep 10 && tail -n 50 log.txt`
   - Max sleep: 119 seconds

2. **For general tasks**:
   - Be clear and concise
   - NO emojis unless requested
   - Ask for clarification if genuinely needed

### STEP 4: Complete and Report
1. Validate work is complete
2. Provide clear summary
3. Include relevant details
4. Suggest logical next steps

## QUICK REFERENCE

### Critical Rules
✅ **ALWAYS**:
- Update rules when user gives feedback
- Use background execution for long commands
- Be clear and concise
- Switch modes when triggered

❌ **NEVER**:
- Skip feedback updates
- Use blocking commands
- Sleep > 119 seconds
- Add emojis unless asked
- Ignore mode triggers

### Terminal Command Rules
- Max 2-minute timeout for any command
- Always use `&` for long operations
- Redirect output to log files
- Check progress with `tail` (not `tail -f`)
- Clean up temporary files