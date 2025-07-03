#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Simple monitor worker that runs independently
class MonitorWorker {
  constructor(project, tmuxSession, tmuxWindow) {
    this.project = project;
    this.tmuxSession = tmuxSession;
    this.tmuxWindow = tmuxWindow;
    this.stateFile = path.join(
      os.homedir(),
      'PersonalAgents',
      'cli_tools',
      'workflow',
      'state',
      `${project}.json`
    );
    this.lastRemindTime = Date.now();
    this.remindInterval = 600000; // 10 minutes default
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to load state: ${error.message}`);
      return null;
    }
  }

  async updateState(updates) {
    try {
      const state = await this.loadState();
      if (!state) return;

      const updatedState = {
        ...state,
        monitor: {
          ...state.monitor,
          ...updates,
          lastCheck: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(this.stateFile, JSON.stringify(updatedState, null, 2));
    } catch (error) {
      console.error(`Failed to update state: ${error.message}`);
    }
  }

  sendReminder() {
    if (!this.tmuxSession) return;

    const message = 'ai-monitor: run workflow-cli --remind-rules';
    
    try {
      // Send reminder to tmux session
      const cmd = `tmux send-keys -t ${this.tmuxSession}:${this.tmuxWindow || '0'} "${message}" Enter`;
      execSync(cmd);
      console.log(`Sent reminder to ${this.tmuxSession}`);
    } catch (error) {
      console.error(`Failed to send reminder: ${error.message}`);
    }
  }

  async checkCompliance() {
    // In the unified system, we'll do simpler compliance checks
    // For now, just send periodic reminders
    const now = Date.now();
    
    if (now - this.lastRemindTime >= this.remindInterval) {
      this.sendReminder();
      this.lastRemindTime = now;
      await this.updateState({ lastRemind: new Date().toISOString() });
    }
  }

  async run() {
    console.log(`Monitor worker started for project: ${this.project}`);
    console.log(`Tmux: ${this.tmuxSession}:${this.tmuxWindow || '0'}`);
    
    // Load initial state
    const state = await this.loadState();
    if (state?.monitor?.remindInterval) {
      this.remindInterval = state.monitor.remindInterval;
    }

    // Main monitoring loop
    while (true) {
      try {
        await this.checkCompliance();
        
        // Check if we should still be running
        const currentState = await this.loadState();
        if (!currentState?.monitor?.enabled) {
          console.log('Monitor disabled, shutting down');
          break;
        }

        // Sleep for 30 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error(`Monitor error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait longer on error
      }
    }
  }
}

// Start the monitor if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, project, tmuxSession, tmuxWindow] = process.argv;
  
  if (!project) {
    console.error('Usage: monitor-worker.js <project> [tmuxSession] [tmuxWindow]');
    process.exit(1);
  }

  const worker = new MonitorWorker(project, tmuxSession, tmuxWindow);
  worker.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}