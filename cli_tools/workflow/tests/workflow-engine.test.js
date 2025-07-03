import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import WorkflowEngine from '../src/workflow-engine.js';
import StateManager from '../src/state-manager.js';

describe('WorkflowEngine', () => {
  let workflowEngine;
  let stateManager;
  const testProject = 'test-engine-project';

  beforeEach(async () => {
    workflowEngine = new WorkflowEngine();
    stateManager = new StateManager();
    
    // Clean up any existing test state
    await stateManager.deleteState(testProject);
  });

  afterEach(async () => {
    // Clean up
    await stateManager.deleteState(testProject);
  });

  test('should start new workflow', async () => {
    const state = await workflowEngine.start(testProject, 'dev', 'Test task');
    
    assert.equal(state.project, testProject);
    assert.equal(state.mode, 'dev');
    assert.equal(state.task, 'Test task');
    assert.equal(state.currentStep, 1);
  });

  test('should prevent starting duplicate workflow without force', async () => {
    // Start first workflow
    await workflowEngine.start(testProject, 'dev', 'First task');
    
    // Try to start another
    const state = await workflowEngine.start(testProject, 'dev', 'Second task');
    
    // Should return existing state
    assert.equal(state.task, 'First task');
  });

  test('should allow force start', async () => {
    // Start first workflow
    await workflowEngine.start(testProject, 'dev', 'First task');
    
    // Force start another
    const state = await workflowEngine.start(testProject, 'dev', 'Second task', { force: true });
    
    assert.equal(state.task, 'Second task');
  });

  test('should continue to next step', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Continue
    await workflowEngine.continue(testProject);
    
    // Check state
    const state = await stateManager.loadState(testProject);
    assert.equal(state.currentStep, 2);
  });

  test('should throw error when continuing non-existent workflow', async () => {
    await assert.rejects(
      async () => await workflowEngine.continue('non-existent'),
      /No workflow found/
    );
  });

  test('should set specific step', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Set step
    await workflowEngine.setStep(testProject, 5);
    
    // Check state
    const state = await stateManager.loadState(testProject);
    assert.equal(state.currentStep, 5);
  });

  test('should record test pass', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Record test
    const state = await workflowEngine.recordTestPass(testProject);
    
    assert.equal(state.tests.totalTests, 1);
    assert.equal(state.tests.passedTests, 1);
  });

  test('should handle remind rules', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Should not throw
    await assert.doesNotReject(async () => {
      await workflowEngine.remindRules(testProject);
    });
  });

  test('should detect git info', async () => {
    const gitInfo = await workflowEngine.detectGitInfo();
    
    assert.ok(typeof gitInfo === 'object');
    assert.ok('branch' in gitInfo);
    assert.ok('worktree' in gitInfo);
    assert.ok('tmuxSession' in gitInfo);
    assert.ok('tmuxWindow' in gitInfo);
  });

  test('should list workflows', async () => {
    // Create a few workflows
    await workflowEngine.start('project1', 'dev', 'Task 1');
    await workflowEngine.start('project2', 'task', 'Task 2');
    
    // Should not throw
    await assert.doesNotReject(async () => {
      await workflowEngine.list();
    });
    
    // Clean up
    await stateManager.deleteState('project1');
    await stateManager.deleteState('project2');
  });

  test('should kill workflow', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Kill it
    await workflowEngine.kill(testProject);
    
    // Verify it's gone
    const state = await stateManager.loadState(testProject);
    assert.equal(state, null);
  });

  test('should handle kill non-existent workflow', async () => {
    await assert.rejects(
      async () => await workflowEngine.kill('non-existent'),
      /No workflow found/
    );
  });

  test('should execute step with proper formatting', async () => {
    // Start workflow
    await workflowEngine.start(testProject, 'dev', 'Test task');
    
    // Execute specific step (should not throw)
    await assert.doesNotReject(async () => {
      await workflowEngine.executeStep(testProject, 3);
    });
    
    // Verify step was updated
    const state = await stateManager.loadState(testProject);
    assert.equal(state.currentStep, 3);
  });
});