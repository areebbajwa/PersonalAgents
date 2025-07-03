#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import WorkflowEngine from './workflow-engine.js';
import SpawnManager from './spawn-manager.js';
import StateManager from './state-manager.js';

const workflowEngine = new WorkflowEngine();
const spawnManager = new SpawnManager();
const stateManager = new StateManager();

program
  .name('workflow')
  .description('Unified workflow management system for AI agents')
  .version('1.0.0');

// Spawn command - creates new tmux session
program
  .command('spawn <project> <mode> <task>')
  .description('Spawn a new workflow in a tmux session')
  .option('-f, --force', 'Force spawn even if workflow exists')
  .action(async (project, mode, task, options) => {
    try {
      await spawnManager.spawnWorkflow(project, mode, task, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Start command - runs in current terminal
program
  .command('start <project> <mode> <task>')
  .description('Start a workflow in the current terminal')
  .option('-f, --force', 'Force start even if workflow exists')
  .option('--spawned', 'Internal flag indicating this was spawned')
  .action(async (project, mode, task, options) => {
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
      console.log(chalk.yellow('AI Monitor integration coming in Phase 4'));
      // TODO: Implement in Phase 4
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
      console.log(chalk.yellow('AI Monitor integration coming in Phase 4'));
      // TODO: Implement in Phase 4
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
      console.log(chalk.yellow('AI Monitor integration coming in Phase 4'));
      // TODO: Implement in Phase 4
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Compatibility aliases for migration
program
  .command('--project <project>')
  .description('Legacy workflow-cli compatibility')
  .option('--mode <mode>', 'Workflow mode')
  .option('--step <step>', 'Workflow step')
  .option('--task <task>', 'Task description')
  .option('--next', 'Continue to next step')
  .option('--set-step <step>', 'Set specific step')
  .option('--sub-task-next', 'Mark sub-task complete')
  .option('--remind-rules', 'Show rules reminder')
  .option('--spawned', 'Spawned flag')
  .action(async (project, options) => {
    try {
      // Handle legacy workflow-cli commands
      if (options.next) {
        await workflowEngine.continue(project);
      } else if (options.setStep) {
        await workflowEngine.setStep(project, parseInt(options.setStep));
      } else if (options.subTaskNext) {
        await workflowEngine.recordTestPass(project);
        console.log(chalk.green('Sub-task marked as complete. Continue with next task.'));
      } else if (options.remindRules) {
        await workflowEngine.remindRules(project);
      } else if (options.mode && options.step && options.task) {
        // Starting a workflow with legacy syntax
        await workflowEngine.start(project, options.mode, options.task, {
          spawned: options.spawned
        });
      } else {
        console.log(chalk.yellow('Incomplete legacy command. Use new syntax:'));
        console.log('  workflow start <project> <mode> <task>');
        console.log('  workflow next <project>');
      }
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