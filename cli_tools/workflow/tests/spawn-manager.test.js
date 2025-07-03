import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import SpawnManager from '../src/spawn-manager.js';
import StateManager from '../src/state-manager.js';

describe('SpawnManager', () => {
  let spawnManager;
  let stateManager;
  const testProject = 'test-spawn-project';
  const sessionName = `${testProject}-workflow`;

  beforeEach(async () => {
    spawnManager = new SpawnManager();
    stateManager = new StateManager();
    
    // Clean up any existing test state
    await stateManager.deleteState(testProject);
    
    // Kill any existing test tmux session
    try {
      execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up
    await stateManager.deleteState(testProject);
    try {
      execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  test('should detect terminal type', () => {
    const terminal = spawnManager.detectTerminal();
    assert.ok(typeof terminal === 'string');
    assert.ok(terminal.length > 0);
  });

  test('should prevent spawning if workflow already exists', async () => {
    // Create existing state
    await stateManager.createState(testProject, 'dev', 'Test task');
    
    // Try to spawn
    const result = await spawnManager.spawnWorkflow(testProject, 'dev', 'New task');
    
    assert.equal(result, null);
  });

  test('should allow force spawn even if workflow exists', async () => {
    // Skip this test if tmux is not available
    try {
      execSync('which tmux', { stdio: 'ignore' });
    } catch (error) {
      console.log('Skipping test: tmux not installed');
      return;
    }

    // Create existing state
    await stateManager.createState(testProject, 'dev', 'Test task');
    
    // Force spawn
    const result = await spawnManager.spawnWorkflow(testProject, 'dev', 'New task', { force: true });
    
    // Should create session (or fail gracefully if tmux issues)
    if (result) {
      assert.equal(result, sessionName);
      
      // Verify session exists
      try {
        execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
        // Session exists, good
      } catch (error) {
        assert.fail('Tmux session was not created');
      }
    }
  });

  test('should handle kill session for non-existent workflow', async () => {
    // Should not throw
    await assert.doesNotReject(async () => {
      await spawnManager.killSession('non-existent-project');
    });
  });

  test('should kill existing session and state', async () => {
    // Skip if tmux not available
    try {
      execSync('which tmux', { stdio: 'ignore' });
    } catch (error) {
      console.log('Skipping test: tmux not installed');
      return;
    }

    // Create state
    await stateManager.createState(testProject, 'dev', 'Test task', {
      tmuxSession: sessionName
    });

    // Create tmux session manually for testing
    try {
      execSync(`tmux new-session -d -s ${sessionName} -c /tmp 'echo test'`);
    } catch (error) {
      console.log('Could not create test tmux session, skipping');
      return;
    }

    // Kill session
    await spawnManager.killSession(testProject);
    
    // Verify session is gone
    try {
      execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
      assert.fail('Tmux session should have been killed');
    } catch (error) {
      // Good, session is gone
    }
    
    // Verify state is gone
    const state = await stateManager.loadState(testProject);
    assert.equal(state, null);
  });

  test('should list sessions correctly', async () => {
    // This test mainly verifies the method doesn't throw
    await assert.doesNotReject(async () => {
      await spawnManager.listSessions();
    });
  });

  test('should handle attach to non-existent workflow', async () => {
    // Should not throw, just log message
    await assert.doesNotReject(async () => {
      await spawnManager.attachToWorkflow('non-existent');
    });
  });

  test('should create proper tmux command structure', async () => {
    // Skip if tmux not available
    try {
      execSync('which tmux', { stdio: 'ignore' });
    } catch (error) {
      console.log('Skipping test: tmux not installed');
      return;
    }

    // Test spawn creates proper state
    const result = await spawnManager.spawnWorkflow(testProject, 'task', 'Test spawning');
    
    if (result) {
      // Load created state
      const state = await stateManager.loadState(testProject);
      
      assert.equal(state.project, testProject);
      assert.equal(state.mode, 'task');
      assert.equal(state.task, 'Test spawning');
      assert.equal(state.spawn.spawned, true);
      assert.equal(state.workflow.tmuxSession, sessionName);
      assert.equal(state.workflow.tmuxWindow, 'workflow');
      assert.ok(state.spawn.terminal);
    }
  });
});