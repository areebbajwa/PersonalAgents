import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import MonitorManager from '../src/monitor-manager.js';
import StateManager from '../src/state-manager.js';

describe('MonitorManager', () => {
  let monitorManager;
  let stateManager;
  const testProject = 'test-monitor-project';

  beforeEach(async () => {
    monitorManager = new MonitorManager();
    stateManager = new StateManager();
    
    // Create test state
    await stateManager.createState(testProject, 'dev', 'Test monitoring', {
      tmuxSession: 'test-session',
      tmuxWindow: 'test-window'
    });
  });

  afterEach(async () => {
    // Clean up
    await monitorManager.stopMonitor(testProject);
    await stateManager.deleteState(testProject);
  });

  test('should start monitor for project', async () => {
    await monitorManager.startMonitor(testProject);
    
    const state = await stateManager.loadState(testProject);
    assert.equal(state.monitor.enabled, true);
    assert.ok(state.monitor.pid);
    assert.ok(state.monitor.lastCheck);
  });

  test('should prevent duplicate monitor start', async () => {
    await monitorManager.startMonitor(testProject);
    
    // Try to start again - should log warning but not throw
    await assert.doesNotReject(async () => {
      await monitorManager.startMonitor(testProject);
    });
  });

  test('should stop monitor', async () => {
    // Start monitor first
    await monitorManager.startMonitor(testProject);
    
    // Stop it
    await monitorManager.stopMonitor(testProject);
    
    const state = await stateManager.loadState(testProject);
    assert.equal(state.monitor.enabled, false);
    assert.equal(state.monitor.pid, null);
  });

  test('should handle stop non-existent monitor', async () => {
    // Should not throw
    await assert.doesNotReject(async () => {
      await monitorManager.stopMonitor('non-existent-project');
    });
  });

  test('should get monitor status', async () => {
    await monitorManager.startMonitor(testProject);
    
    const statuses = await monitorManager.getMonitorStatus();
    
    assert.ok(Array.isArray(statuses));
    const status = statuses.find(s => s.project === testProject);
    assert.ok(status);
    assert.equal(status.project, testProject);
    assert.ok(status.pid);
  });

  test('should stop all monitors', async () => {
    // Create another test project
    const testProject2 = 'test-monitor-project-2';
    await stateManager.createState(testProject2, 'dev', 'Test 2');
    
    // Start monitors
    await monitorManager.startMonitor(testProject);
    await monitorManager.startMonitor(testProject2);
    
    // Stop all
    await monitorManager.stopAllMonitors();
    
    // Check both are stopped
    const state1 = await stateManager.loadState(testProject);
    const state2 = await stateManager.loadState(testProject2);
    
    assert.equal(state1.monitor.enabled, false);
    assert.equal(state2.monitor.enabled, false);
    
    // Clean up
    await stateManager.deleteState(testProject2);
  });

  test('should display status without throwing', async () => {
    // With no monitors
    await assert.doesNotReject(async () => {
      await monitorManager.displayStatus();
    });
    
    // With a monitor
    await monitorManager.startMonitor(testProject);
    await assert.doesNotReject(async () => {
      await monitorManager.displayStatus();
    });
  });

  test('should cleanup stale PIDs', async () => {
    // Manually set a fake PID that doesn't exist
    await stateManager.updateState(testProject, {
      monitor: {
        enabled: true,
        pid: 999999 // Very unlikely to exist
      }
    });
    
    // Cleanup should mark it as disabled
    await monitorManager.cleanupStalePids();
    
    const state = await stateManager.loadState(testProject);
    assert.equal(state.monitor.enabled, false);
    assert.equal(state.monitor.pid, null);
  });

  test('should handle custom remind interval', async () => {
    await monitorManager.startMonitor(testProject, { remindInterval: 300000 }); // 5 minutes
    
    const state = await stateManager.loadState(testProject);
    assert.equal(state.monitor.remindInterval, 300000);
  });

  test('should create log file', async () => {
    await monitorManager.startMonitor(testProject);
    
    // Just verify it doesn't throw and creates the logs directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const logsDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'logs');
    await assert.doesNotReject(async () => {
      await fs.access(logsDir);
    });
  });
});