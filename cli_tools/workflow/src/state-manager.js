import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StateManager {
  constructor() {
    // Always use absolute path from home directory
    this.stateDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'state');
    this.version = '1.0.0';
  }

  async ensureStateDir() {
    await fs.mkdir(this.stateDir, { recursive: true });
  }

  getStatePath(project) {
    return path.join(this.stateDir, `${project}.json`);
  }

  async createState(project, mode, task, options = {}) {
    await this.ensureStateDir();
    
    const state = {
      version: this.version,
      project,
      mode,
      currentStep: 1,
      completedSteps: [],
      task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workflow: {
        branch: options.branch || null,
        worktree: options.worktree || process.cwd(),
        tmuxSession: options.tmuxSession || null,
        tmuxWindow: options.tmuxWindow || null
      },
      monitor: {
        enabled: false,
        pid: null,
        lastCheck: null,
        remindInterval: 600000 // 10 minutes
      },
      spawn: {
        spawned: options.spawned || false,
        parentPid: options.parentPid || process.pid,
        terminal: options.terminal || null,
        environment: options.environment || {}
      },
      tests: {
        totalTests: 0,
        passedTests: 0,
        lastTestRun: null
      }
    };

    await this.saveState(project, state);
    return state;
  }

  async loadState(project) {
    const statePath = this.getStatePath(project);
    
    try {
      const data = await fs.readFile(statePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Check for legacy state files
        const legacyState = await this.migrateLegacyState(project);
        if (legacyState) {
          return legacyState;
        }
        return null;
      }
      throw error;
    }
  }

  async saveState(project, state) {
    await this.ensureStateDir();
    const statePath = this.getStatePath(project);
    
    state.updatedAt = new Date().toISOString();
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  async updateState(project, updates) {
    const state = await this.loadState(project);
    if (!state) {
      throw new Error(`No state found for project: ${project}`);
    }

    // Deep merge updates
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
        state[key] = { ...state[key], ...updates[key] };
      } else {
        state[key] = updates[key];
      }
    });

    await this.saveState(project, state);
    return state;
  }

  async deleteState(project) {
    const statePath = this.getStatePath(project);
    try {
      await fs.unlink(statePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async listStates() {
    await this.ensureStateDir();
    
    const files = await fs.readdir(this.stateDir);
    const states = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const project = file.replace('.json', '');
        try {
          const state = await this.loadState(project);
          states.push(state);
        } catch (error) {
          console.error(`Error loading state for ${project}:`, error.message);
        }
      }
    }
    
    return states;
  }

  async migrateLegacyState(project) {
    // Check workflow-cli state
    const workflowStatePath = path.join(
      os.homedir(),
      'PersonalAgents',
      'cli_tools',
      'workflow-cli',
      'state',
      `workflow_state_${project}.json`
    );

    try {
      const data = await fs.readFile(workflowStatePath, 'utf8');
      const legacyState = JSON.parse(data);
      
      // Convert to new format
      const newState = {
        version: this.version,
        project,
        mode: legacyState.mode || 'dev',
        currentStep: legacyState.currentStep || 1,
        completedSteps: legacyState.completedSteps || [],
        task: legacyState.task || '',
        createdAt: legacyState.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workflow: {
          branch: legacyState.branch || null,
          worktree: legacyState.worktree || null,
          tmuxSession: legacyState.tmuxSession || null,
          tmuxWindow: legacyState.tmuxWindow || null
        },
        monitor: {
          enabled: false,
          pid: null,
          lastCheck: null,
          remindInterval: 600000
        },
        spawn: {
          spawned: legacyState.spawned || false,
          parentPid: process.pid,
          terminal: null,
          environment: {}
        },
        tests: {
          totalTests: legacyState.totalTests || 0,
          passedTests: legacyState.passedTests || 0,
          lastTestRun: null
        }
      };

      // Check for AI monitor state
      const monitorStatePath = path.join(
        os.homedir(),
        'PersonalAgents',
        'cli_tools',
        'ai-monitor-cli',
        'state',
        `monitor-${project}.json`
      );

      try {
        const monitorData = await fs.readFile(monitorStatePath, 'utf8');
        const monitorState = JSON.parse(monitorData);
        
        newState.monitor = {
          enabled: true,
          pid: monitorState.pid || null,
          lastCheck: monitorState.lastCheck || null,
          remindInterval: monitorState.remindInterval || 600000
        };
      } catch (error) {
        // No monitor state found, use defaults
      }

      // Save migrated state
      await this.saveState(project, newState);
      
      console.log(`✓ Migrated legacy state for project: ${project}`);
      return newState;
    } catch (error) {
      // No legacy state found
      return null;
    }
  }

  // Test helper methods
  async recordTest(project, passed = true) {
    const state = await this.loadState(project);
    if (!state) {
      throw new Error(`No state found for project: ${project}`);
    }

    state.tests.totalTests++;
    if (passed) {
      state.tests.passedTests++;
    }
    state.tests.lastTestRun = new Date().toISOString();

    await this.saveState(project, state);
    return state;
  }

  async completeStep(project, step) {
    const state = await this.loadState(project);
    if (!state) {
      throw new Error(`No state found for project: ${project}`);
    }

    if (!state.completedSteps.includes(step)) {
      state.completedSteps.push(step);
    }
    
    await this.saveState(project, state);
    return state;
  }
}

export default StateManager;