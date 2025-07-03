# 20250103-workflow-simplification-todo.md
Last updated: [17:20]

## Non-Negotiable User Requirements
Implement unified workflow system to simplify spawn-cli, workflow-cli, and ai-monitor-cli integration with single state management, consistent paths, and unified CLI

## Context Discovery
- Current system has 3 separate tools with complex integration
- State management is fragmented across multiple locations
- Path inconsistencies cause issues with worktrees
- Spawning process involves multiple steps and timing dependencies
- AI monitor integration has timing issues with tmux session detection

## Key Simplifications Identified
1. Merge all 3 tools into single unified `workflow` CLI
2. Single state store for all workflow data
3. Keep tmux for visibility but simplify integration
4. Consistent absolute paths from ~/PersonalAgents
5. Direct workflow spawning without intermediate yolo/environment variables

## Tasks

### Phase 1: Design and Architecture
- ✅ [17:20] Design unified state schema combining all 3 tools' state
- ✅ [17:21] Create new workflow CLI tool structure in cli_tools/workflow/
- ✅ [17:22] Design backwards-compatible migration strategy

### Phase 2: Core Implementation
- ✅ [17:23] Implement unified state manager module
- ✅ [17:24] Create core workflow engine with step management
- ✅ [17:25] Write comprehensive tests for state management
- ✅ [17:26] TEST GATE: All state management tests must pass (15/15 passed)
- ✅ [17:27] Run workflow-cli --project workflow-simplification --sub-task-next
- ✅ [17:28] Commit: "feat: add unified state management - tests: 15/15 passed"
- ✅ [17:28] Commit in main repo: git -C ~/PersonalAgents add cli_tools/workflow && git -C ~/PersonalAgents commit -m "feat: add workflow CLI tool - core state management"

### Phase 3: Spawn Integration
- ✅ [17:29] Implement direct spawning with simplified tmux integration
- ✅ [17:30] Create tmux sessions/windows without complex environment variables
- ✅ [17:31] Write tests for spawn functionality
- ✅ [17:32] TEST GATE: All spawn tests must pass (36/36 passed)
- ✅ [17:33] Run workflow-cli --project workflow-simplification --sub-task-next
- 🕒 [17:33] Commit: "feat: add direct spawn integration - tests: 36/36 passed"
- 🕒 Commit in main repo: git -C ~/PersonalAgents add cli_tools/workflow && git -C ~/PersonalAgents commit -m "feat: add workflow CLI tool - spawn integration"

### Phase 4: AI Monitor Integration
- 🕒 Port AI monitor functionality into unified tool
- 🕒 Implement direct process communication
- 🕒 Remove tmux send-keys dependency
- 🕒 Write tests for AI monitoring
- 🕒 TEST GATE: All AI monitor tests must pass
- 🕒 Run workflow-cli --project workflow-simplification --sub-task-next
- 🕒 Commit: "feat: integrate AI monitoring - tests: X/X passed"
- 🕒 Commit in main repo: git -C ~/PersonalAgents add cli_tools/workflow && git -C ~/PersonalAgents commit -m "feat: add workflow CLI tool - AI monitor integration"

### Phase 5: Migration and Compatibility
- 🕒 Create migration script for existing state files
- 🕒 Add compatibility layer for old commands
- 🕒 Update all references in CLAUDE.md and other docs
- 🕒 Write migration tests
- 🕒 TEST GATE: All migration tests must pass
- 🕒 Run workflow-cli --project workflow-simplification --sub-task-next
- 🕒 Commit: "feat: add migration support - tests: X/X passed"
- 🕒 Commit in main repo: git -C ~/PersonalAgents add cli_tools/workflow && git -C ~/PersonalAgents commit -m "feat: add workflow CLI tool - migration support"

### Phase 6: Cleanup and Finalization
- 🕒 Remove old tools (spawn-cli, workflow-cli, ai-monitor-cli)
- 🕒 Update all documentation
- 🕒 Run full E2E test suite
- 🕒 TEST GATE: All E2E tests must pass
- 🕒 Run workflow-cli --project workflow-simplification --sub-task-next
- 🕒 Final commit: "feat: complete unified workflow system - tests: X/X passed"
- 🕒 Final commit in main repo: git -C ~/PersonalAgents add cli_tools/workflow && git -C ~/PersonalAgents commit -m "feat: complete unified workflow CLI tool"
- 🕒 Run ./scripts/setup-global-cli-tools.sh
- 🕒 Run workflow-cli --project workflow-simplification --next

## Notes
- [17:16] BREAKTHROUGH: Instead of fixing integration issues, create single unified tool
- Key insight: Current complexity comes from 3 tools trying to coordinate via tmux
- Solution: Direct integration eliminates timing issues and state fragmentation
- [17:20] Unified State Schema Design:
  ```json
  {
    "version": "1.0.0",
    "project": "project-name",
    "mode": "dev|task",
    "currentStep": 1,
    "completedSteps": [],
    "task": "task description",
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp",
    "workflow": {
      "branch": "branch-name",
      "worktree": "/path/to/worktree",
      "tmuxSession": "session-name",
      "tmuxWindow": "window-name"
    },
    "monitor": {
      "enabled": true,
      "pid": 12345,
      "lastCheck": "ISO timestamp",
      "remindInterval": 600000
    },
    "spawn": {
      "spawned": true,
      "parentPid": 12345,
      "terminal": "Terminal|iTerm2",
      "environment": {}
    },
    "tests": {
      "totalTests": 0,
      "passedTests": 0,
      "lastTestRun": "ISO timestamp"
    }
  }
  ```
- [17:22] Migration Strategy:
  1. **Auto-detection**: Check for existing state files on first run
  2. **Seamless Migration**: Convert old formats to unified schema
  3. **Command Aliases**: Support old command syntax during transition
  4. **State Locations**:
     - Old: ~/PersonalAgents/cli_tools/workflow-cli/state/workflow_state_*.json
     - Old: ~/PersonalAgents/cli_tools/ai-monitor-cli/state/monitor-*.json
     - New: ~/PersonalAgents/cli_tools/workflow/state/*.json
  5. **Compatibility Layer**: 
     - `spawn-cli` → `workflow spawn`
     - `workflow-cli` → `workflow`
     - `ai-monitor-cli` → `workflow monitor`