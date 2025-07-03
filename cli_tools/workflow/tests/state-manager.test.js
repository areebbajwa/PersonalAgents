import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import StateManager from '../src/state-manager.js';

describe('StateManager', () => {
  let stateManager;
  const testProject = 'test-project';
  const testStateDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'state');

  beforeEach(async () => {
    stateManager = new StateManager();
    // Clean up any existing test state
    try {
      await fs.unlink(path.join(testStateDir, `${testProject}.json`));
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test state
    try {
      await fs.unlink(path.join(testStateDir, `${testProject}.json`));
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  test('should create state directory if it does not exist', async () => {
    await stateManager.ensureStateDir();
    const dirExists = await fs.access(testStateDir).then(() => true).catch(() => false);
    assert.equal(dirExists, true);
  });

  test('should create new state with default values', async () => {
    const task = 'Test task description';
    const mode = 'dev';
    
    const state = await stateManager.createState(testProject, mode, task);
    
    assert.equal(state.project, testProject);
    assert.equal(state.mode, mode);
    assert.equal(state.task, task);
    assert.equal(state.currentStep, 1);
    assert.deepEqual(state.completedSteps, []);
    assert.equal(state.version, '1.0.0');
    assert.equal(state.monitor.enabled, false);
    assert.equal(state.spawn.spawned, false);
    assert.equal(state.tests.totalTests, 0);
    assert.equal(state.tests.passedTests, 0);
  });

  test('should create state with custom options', async () => {
    const options = {
      branch: 'feature-branch',
      worktree: '/custom/path',
      tmuxSession: 'test-session',
      tmuxWindow: 'test-window',
      spawned: true,
      terminal: 'iTerm2'
    };
    
    const state = await stateManager.createState(testProject, 'task', 'Task', options);
    
    assert.equal(state.workflow.branch, options.branch);
    assert.equal(state.workflow.worktree, options.worktree);
    assert.equal(state.workflow.tmuxSession, options.tmuxSession);
    assert.equal(state.workflow.tmuxWindow, options.tmuxWindow);
    assert.equal(state.spawn.spawned, options.spawned);
    assert.equal(state.spawn.terminal, options.terminal);
  });

  test('should load existing state', async () => {
    const task = 'Test task';
    await stateManager.createState(testProject, 'dev', task);
    
    const loadedState = await stateManager.loadState(testProject);
    
    assert.equal(loadedState.project, testProject);
    assert.equal(loadedState.task, task);
  });

  test('should return null for non-existent state', async () => {
    const state = await stateManager.loadState('non-existent-project');
    assert.equal(state, null);
  });

  test('should update state fields', async () => {
    await stateManager.createState(testProject, 'dev', 'Task');
    
    const updates = {
      currentStep: 5,
      monitor: {
        enabled: true,
        pid: 12345
      }
    };
    
    const updatedState = await stateManager.updateState(testProject, updates);
    
    assert.equal(updatedState.currentStep, 5);
    assert.equal(updatedState.monitor.enabled, true);
    assert.equal(updatedState.monitor.pid, 12345);
    assert.equal(updatedState.monitor.remindInterval, 600000); // Should preserve existing value
  });

  test('should throw error when updating non-existent state', async () => {
    await assert.rejects(
      async () => await stateManager.updateState('non-existent', {}),
      /No state found/
    );
  });

  test('should delete state file', async () => {
    await stateManager.createState(testProject, 'dev', 'Task');
    
    const deleted = await stateManager.deleteState(testProject);
    assert.equal(deleted, true);
    
    const state = await stateManager.loadState(testProject);
    assert.equal(state, null);
  });

  test('should return false when deleting non-existent state', async () => {
    const deleted = await stateManager.deleteState('non-existent');
    assert.equal(deleted, false);
  });

  test('should list all states', async () => {
    await stateManager.createState('project1', 'dev', 'Task 1');
    await stateManager.createState('project2', 'task', 'Task 2');
    
    const states = await stateManager.listStates();
    
    const projects = states.map(s => s.project).sort();
    assert.ok(projects.includes('project1'));
    assert.ok(projects.includes('project2'));
    
    // Clean up
    await stateManager.deleteState('project1');
    await stateManager.deleteState('project2');
  });

  test('should record test results', async () => {
    await stateManager.createState(testProject, 'dev', 'Task');
    
    // Record passing test
    let state = await stateManager.recordTest(testProject, true);
    assert.equal(state.tests.totalTests, 1);
    assert.equal(state.tests.passedTests, 1);
    
    // Record failing test
    state = await stateManager.recordTest(testProject, false);
    assert.equal(state.tests.totalTests, 2);
    assert.equal(state.tests.passedTests, 1);
  });

  test('should complete steps without duplicates', async () => {
    await stateManager.createState(testProject, 'dev', 'Task');
    
    // Complete step 1
    let state = await stateManager.completeStep(testProject, 1);
    assert.deepEqual(state.completedSteps, [1]);
    
    // Complete step 1 again (should not duplicate)
    state = await stateManager.completeStep(testProject, 1);
    assert.deepEqual(state.completedSteps, [1]);
    
    // Complete step 2
    state = await stateManager.completeStep(testProject, 2);
    assert.deepEqual(state.completedSteps, [1, 2]);
  });

  test('should update timestamps on save', async () => {
    const state = await stateManager.createState(testProject, 'dev', 'Task');
    const originalUpdatedAt = state.updatedAt;
    
    // Wait a bit to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await stateManager.updateState(testProject, { currentStep: 2 });
    const updatedState = await stateManager.loadState(testProject);
    
    assert.notEqual(updatedState.updatedAt, originalUpdatedAt);
  });

  describe('Legacy Migration', () => {
    const legacyWorkflowDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow-cli', 'state');
    const legacyMonitorDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'ai-monitor-cli', 'state');
    
    beforeEach(async () => {
      // Create legacy directories
      await fs.mkdir(legacyWorkflowDir, { recursive: true });
      await fs.mkdir(legacyMonitorDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up legacy files
      try {
        await fs.unlink(path.join(legacyWorkflowDir, `workflow_state_${testProject}.json`));
      } catch (error) {
        // Ignore
      }
      try {
        await fs.unlink(path.join(legacyMonitorDir, `monitor-${testProject}.json`));
      } catch (error) {
        // Ignore
      }
    });

    test('should migrate legacy workflow state', async () => {
      // Create legacy state
      const legacyState = {
        mode: 'dev',
        currentStep: 3,
        completedSteps: [1, 2],
        task: 'Legacy task',
        branch: 'legacy-branch',
        totalTests: 5,
        passedTests: 4
      };
      
      await fs.writeFile(
        path.join(legacyWorkflowDir, `workflow_state_${testProject}.json`),
        JSON.stringify(legacyState, null, 2)
      );
      
      // Load should trigger migration
      const migratedState = await stateManager.loadState(testProject);
      
      assert.equal(migratedState.version, '1.0.0');
      assert.equal(migratedState.project, testProject);
      assert.equal(migratedState.mode, 'dev');
      assert.equal(migratedState.currentStep, 3);
      assert.deepEqual(migratedState.completedSteps, [1, 2]);
      assert.equal(migratedState.task, 'Legacy task');
      assert.equal(migratedState.workflow.branch, 'legacy-branch');
      assert.equal(migratedState.tests.totalTests, 5);
      assert.equal(migratedState.tests.passedTests, 4);
    });

    test('should migrate with monitor state', async () => {
      // Create legacy workflow state
      await fs.writeFile(
        path.join(legacyWorkflowDir, `workflow_state_${testProject}.json`),
        JSON.stringify({ mode: 'dev', task: 'Task' }, null, 2)
      );
      
      // Create legacy monitor state
      const monitorState = {
        pid: 9999,
        lastCheck: '2024-01-01T00:00:00Z',
        remindInterval: 300000
      };
      
      await fs.writeFile(
        path.join(legacyMonitorDir, `monitor-${testProject}.json`),
        JSON.stringify(monitorState, null, 2)
      );
      
      // Load should trigger migration
      const migratedState = await stateManager.loadState(testProject);
      
      assert.equal(migratedState.monitor.enabled, true);
      assert.equal(migratedState.monitor.pid, 9999);
      assert.equal(migratedState.monitor.lastCheck, '2024-01-01T00:00:00Z');
      assert.equal(migratedState.monitor.remindInterval, 300000);
    });
  });
});