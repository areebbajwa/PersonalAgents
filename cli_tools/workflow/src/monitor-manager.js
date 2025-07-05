import { spawn, fork } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import StateManager from './state-manager.js';

export class MonitorManager {
  constructor() {
    this.stateManager = new StateManager();
    this.monitors = new Map(); // project -> monitor process
    this.logsDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'logs');
  }

  async ensureLogsDir() {
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  async startMonitor(project, options = {}) {
    // Check if monitor already running
    if (this.monitors.has(project)) {
      console.log(chalk.yellow(`Monitor already running for project: ${project}`));
      return;
    }

    const state = await this.stateManager.loadState(project);
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    await this.ensureLogsDir();

    // Use fork for ES modules - it handles module loading properly
    const monitorWorkerPath = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'src', 'monitor-worker.js');
    
    const monitorProcess = fork(monitorWorkerPath, [
      project,
      state.workflow.tmuxSession || '',
      state.workflow.tmuxWindow || ''
    ], {
      detached: true,
      silent: true, // Use silent to pipe stdout/stderr
      env: {
        ...process.env,
        NODE_PATH: process.env.NODE_PATH || '',
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || os.homedir(),
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
      }
    });

    // Log monitor output
    const logFile = path.join(this.logsDir, `monitor-${project}-${Date.now()}.log`);
    const logStream = await fs.open(logFile, 'w');
    
    monitorProcess.stdout.on('data', async (data) => {
      await logStream.write(data);
    });
    
    monitorProcess.stderr.on('data', async (data) => {
      await logStream.write(data);
    });

    // Monitor process exit
    monitorProcess.on('exit', (code, signal) => {
      console.log(chalk.yellow(`Monitor process exited for ${project} (PID: ${monitorProcess.pid}, code: ${code})`));
      this.monitors.delete(project);
      logStream.close();
    });

    monitorProcess.on('error', (error) => {
      console.error(chalk.red(`Monitor process error for ${project}:`), error);
    });

    // Update state with monitor info
    await this.stateManager.updateState(project, {
      monitor: {
        enabled: true,
        pid: monitorProcess.pid,
        lastCheck: new Date().toISOString(),
        remindInterval: options.remindInterval || 600000 // 10 minutes default
      }
    });

    this.monitors.set(project, monitorProcess);
    
    console.log(chalk.green(`✓ AI Monitor started for project: ${project}`));
    console.log(chalk.gray(`PID: ${monitorProcess.pid}`));
    console.log(chalk.gray(`Logs: ${logFile}`));

    // Don't wait for process to exit
    monitorProcess.unref();
  }

  async stopMonitor(project) {
    const state = await this.stateManager.loadState(project);
    
    // Stop running process
    const monitor = this.monitors.get(project);
    if (monitor) {
      try {
        process.kill(monitor.pid, 'SIGTERM');
        this.monitors.delete(project);
      } catch (error) {
        // Process might already be dead
      }
    }

    // Also try PID from state
    if (state?.monitor?.pid) {
      try {
        process.kill(state.monitor.pid, 'SIGTERM');
      } catch (error) {
        // Process might already be dead
      }
    }

    // Update state
    if (state) {
      await this.stateManager.updateState(project, {
        monitor: {
          enabled: false,
          pid: null,
          lastCheck: new Date().toISOString()
        }
      });
    }

    console.log(chalk.yellow(`Stopped AI Monitor for project: ${project}`));
  }

  async stopAllMonitors() {
    const states = await this.stateManager.listStates();
    
    for (const state of states) {
      if (state.monitor?.enabled) {
        await this.stopMonitor(state.project);
      }
    }
    
    console.log(chalk.green('✓ All AI Monitors stopped'));
  }

  async getMonitorStatus() {
    const states = await this.stateManager.listStates();
    const statuses = [];
    
    for (const state of states) {
      if (state.monitor?.enabled) {
        // Check if process is actually running
        let isRunning = false;
        if (state.monitor.pid) {
          try {
            process.kill(state.monitor.pid, 0); // Signal 0 just checks if process exists
            isRunning = true;
          } catch (error) {
            isRunning = false;
          }
        }

        statuses.push({
          project: state.project,
          pid: state.monitor.pid,
          isRunning,
          lastCheck: state.monitor.lastCheck,
          remindInterval: state.monitor.remindInterval
        });
      }
    }
    
    return statuses;
  }

  async displayStatus() {
    const statuses = await this.getMonitorStatus();
    
    if (statuses.length === 0) {
      console.log(chalk.yellow('No AI Monitors running'));
      return;
    }

    console.log(chalk.cyan('\nAI Monitor Status:\n'));
    
    for (const status of statuses) {
      const statusIcon = status.isRunning ? '🟢' : '🔴';
      const lastCheckAgo = Math.floor((Date.now() - new Date(status.lastCheck).getTime()) / 1000 / 60);
      
      console.log(`${statusIcon} ${chalk.bold(status.project)}`);
      console.log(`   PID: ${status.pid || 'N/A'} | Running: ${status.isRunning ? 'Yes' : 'No'}`);
      console.log(`   Last Check: ${lastCheckAgo} minutes ago`);
      console.log(`   Remind Interval: ${status.remindInterval / 60000} minutes`);
      console.log();
    }
  }

  async cleanupStalePids() {
    const states = await this.stateManager.listStates();
    
    for (const state of states) {
      if (state.monitor?.pid) {
        try {
          process.kill(state.monitor.pid, 0);
        } catch (error) {
          // Process is dead, clean up state
          await this.stateManager.updateState(state.project, {
            monitor: {
              ...state.monitor,
              enabled: false,
              pid: null
            }
          });
          console.log(chalk.gray(`Cleaned up stale monitor PID for: ${state.project}`));
        }
      }
    }
  }

  async forceCheck(project) {
    const state = await this.stateManager.loadState(project);
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    if (!state.monitor?.enabled || !state.monitor?.pid) {
      throw new Error(`No AI monitor running for project: ${project}`);
    }

    // Create a force-check file that the monitor will detect
    const forceCheckFile = path.join(
      os.homedir(),
      'PersonalAgents',
      'cli_tools',
      'workflow',
      'state',
      `${project}-force-check`
    );

    try {
      // Write timestamp to force-check file
      await fs.writeFile(forceCheckFile, Date.now().toString());
      console.log(chalk.green(`✓ Force check triggered for: ${project}`));
      console.log(chalk.gray('The monitor will perform compliance check within seconds...'));
    } catch (error) {
      throw new Error(`Failed to trigger force check: ${error.message}`);
    }
  }
}

export default MonitorManager;