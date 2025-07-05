#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import WorkflowEngine from './workflow-engine.js';
import SpawnManager from './spawn-manager.js';
import StateManager from './state-manager.js';
import MonitorManager from './monitor-manager.js';

const workflowEngine = new WorkflowEngine();
const spawnManager = new SpawnManager();
const stateManager = new StateManager();
const monitorManager = new MonitorManager();

program
  .name('workflow')
  .description('Unified workflow management system for AI agents')
  .version('1.0.0');

// Spawn command - creates new tmux window
program
  .command('spawn <project> <mode> <task>')
  .description('Spawn a new workflow in a tmux window')
  .option('-f, --force', 'Force spawn even if workflow exists')
  .option('--no-monitor', 'Disable AI monitor auto-start')
  .action(async (project, mode, task, options) => {
    try {
      await spawnManager.spawnWorkflow(project, mode, task, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Start command - internal use only (called by spawn)
program
  .command('start <project> <mode> <task>')
  .description('Internal command - use "workflow spawn" instead')
  .option('-f, --force', 'Force start even if workflow exists')
  .option('--spawned', 'Internal flag indicating this was spawned')
  .option('--no-monitor', 'Disable AI monitor auto-start')
  .action(async (project, mode, task, options) => {
    // Only allow if spawned internally
    if (!options.spawned) {
      console.error(chalk.red('Error: Direct use of "workflow start" is deprecated.'));
      console.error(chalk.yellow('Use "workflow spawn" instead:'));
      console.error(chalk.white(`  workflow spawn ${project} ${mode} "${task}"`));
      process.exit(1);
    }
    
    try {
      await workflowEngine.start(project, mode, task, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Continue/next command
program
  .command('next [project]')
  .alias('continue')
  .description('Continue to the next workflow step')
  .action(async (project) => {
    try {
      // If no project specified, try to detect from current state
      if (!project) {
        const states = await stateManager.listStates();
        if (states.length === 1) {
          project = states[0].project;
        } else if (states.length > 1) {
          console.log(chalk.yellow('Multiple workflows found. Please specify project:'));
          states.forEach(s => console.log(`  workflow next ${s.project}`));
          return;
        } else {
          console.log(chalk.red('No active workflows found'));
          return;
        }
      }
      
      await workflowEngine.continue(project);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Set step command
program
  .command('set-step <project> <step>')
  .description('Jump to a specific workflow step')
  .action(async (project, step) => {
    try {
      await workflowEngine.setStep(project, parseInt(step));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all active workflows')
  .action(async () => {
    try {
      await workflowEngine.list();
      console.log(chalk.gray('\nTmux sessions:'));
      await spawnManager.listSessions();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Kill command
program
  .command('kill <project>')
  .description('Kill a workflow and its tmux session')
  .action(async (project) => {
    try {
      await spawnManager.killSession(project);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Attach command
program
  .command('attach <project>')
  .description('Attach to a workflow tmux session')
  .action(async (project) => {
    try {
      await spawnManager.attachToWorkflow(project);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Sub-task completion
program
  .command('sub-task-next <project>')
  .description('Mark current sub-task as complete and continue')
  .action(async (project) => {
    try {
      await workflowEngine.recordTestPass(project);
      console.log(chalk.green('Sub-task marked as complete. Continue with next task.'));
      console.log('');
      console.log(chalk.blue('=== TASK COMPLETION REMINDER ==='));
      console.log('');
      console.log('📝 **sub-task-next**: After completing ONE todo task');
      console.log('📋 **next**: After completing ALL todos in current step');
      console.log('');
      console.log('Check your todo list. If tasks remain, continue working. If all done, use --next.');
      
      // Also display workflow rules
      await workflowEngine.remindRules(project);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Remind rules command
program
  .command('remind-rules <project>')
  .description('Display workflow rules reminder')
  .action(async (project) => {
    try {
      await workflowEngine.remindRules(project);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Monitor commands group
const monitor = program
  .command('monitor')
  .description('AI monitor commands');

monitor
  .command('start [project]')
  .description('Start AI monitor for a project')
  .action(async (project) => {
    try {
      if (!project) {
        // Start for all active workflows
        const states = await stateManager.listStates();
        for (const state of states) {
          if (!state.monitor?.enabled) {
            await monitorManager.startMonitor(state.project);
          }
        }
      } else {
        await monitorManager.startMonitor(project);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

monitor
  .command('stop [project]')
  .description('Stop AI monitor for a project')
  .action(async (project) => {
    try {
      if (!project) {
        await monitorManager.stopAllMonitors();
      } else {
        await monitorManager.stopMonitor(project);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

monitor
  .command('status')
  .description('Show AI monitor status')
  .action(async () => {
    try {
      await monitorManager.displayStatus();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Direct workflow commands (for use within spawned Claude sessions)
program
  .command('dev <task>')
  .description('Start dev mode workflow directly (use within spawned sessions)')
  .option('--no-monitor', 'Disable AI monitor')
  .action(async (task, options) => {
    try {
      // Generate a project name from the task
      const project = task.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30);
      
      await workflowEngine.start(project, 'dev', task, {
        spawned: true,
        monitor: options.monitor
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('task <task>')
  .description('Start task mode workflow directly (use within spawned sessions)')
  .option('--no-monitor', 'Disable AI monitor')
  .action(async (task, options) => {
    try {
      // Generate a project name from the task
      const project = task.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30);
      
      await workflowEngine.start(project, 'task', task, {
        spawned: true,
        monitor: options.monitor
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });


// Parse arguments
program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}