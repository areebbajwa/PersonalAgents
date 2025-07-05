import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import yaml from 'js-yaml';
import StateManager from './state-manager.js';
import MonitorManager from './monitor-manager.js';

export class WorkflowEngine {
  constructor() {
    this.stateManager = new StateManager();
    this.monitorManager = new MonitorManager();
    this.workflowsDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'workflows');
  }

  async start(project, mode, task, options = {}) {
    console.log(chalk.cyan(`Starting ${mode} workflow for project: ${project}`));
    
    // Check if state already exists
    let state = await this.stateManager.loadState(project);
    
    if (state && !options.force) {
      console.log(chalk.yellow(`Workflow already exists for project: ${project}`));
      console.log(chalk.yellow(`Use 'workflow continue ${project}' or add --force to restart`));
      return state;
    }

    // Detect current git info
    const gitInfo = await this.detectGitInfo();
    
    // Create new state, but preserve tmuxWindow from options if provided
    state = await this.stateManager.createState(project, mode, task, {
      ...gitInfo,
      ...options,
      // Ensure tmuxWindow from spawn is preserved
      tmuxWindow: options.tmuxWindow || gitInfo.tmuxWindow
    });

    // Execute first step
    await this.executeStep(project, 1);
    
    // Auto-start AI monitor (for all modes unless disabled)
    if (options.monitor !== false) {
      try {
        await this.monitorManager.startMonitor(project);
      } catch (error) {
        console.error(chalk.yellow('Failed to start AI monitor:'), error.message);
      }
    }
    
    return state;
  }

  async continue(project) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    const nextStep = state.currentStep + 1;
    await this.executeStep(project, nextStep);
    
    return state;
  }

  async executeStep(project, step) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    console.log(chalk.green(`\n=== ${state.mode.toUpperCase()} MODE - Step ${step} ===\n`));

    // Load workflow definition
    const workflow = await this.loadWorkflow(state.mode);
    
    if (!workflow.steps[step]) {
      console.log(chalk.yellow(`No step ${step} defined for ${state.mode} mode`));
      return;
    }

    const stepDef = workflow.steps[step];
    
    // Display core principles if defined
    if (workflow.principles) {
      console.log(chalk.cyan('### Core Principles'));
      workflow.principles.forEach((principle, index) => {
        console.log(`${index + 1}. ${principle}`);
      });
      console.log();
    }

    // Display step content
    console.log(chalk.cyan(`>>> CURRENT STEP <<<`));
    console.log(chalk.cyan(`### STEP ${step}: ${stepDef.name}`));
    
    if (stepDef.content) {
      console.log(stepDef.content);
    }

    // Update state
    await this.stateManager.updateState(project, { currentStep: step });
    
    // Display next step info
    if (workflow.steps[step + 1]) {
      console.log(chalk.gray(`\nNext: STEP ${step + 1} - ${workflow.steps[step + 1].name}`));
    } else {
      console.log(chalk.green(`\nWorkflow complete!`));
    }

    // Display emergency procedures if defined
    if (workflow.emergency) {
      console.log(chalk.red('\n=== EMERGENCY PROCEDURES ==='));
      console.log(workflow.emergency);
    }
  }

  async setStep(project, step) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    await this.executeStep(project, step);
  }

  async recordTestPass(project) {
    const state = await this.stateManager.recordTest(project, true);
    console.log(chalk.green(`✓ Test passed! (${state.tests.passedTests}/${state.tests.totalTests})`));
    return state;
  }

  async remindRules(project) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    const workflow = await this.loadWorkflow(state.mode);
    
    console.log(chalk.yellow('\n=== WORKFLOW RULES REMINDER ===\n'));
    
    // Display all global rules
    if (workflow.global_rules && Array.isArray(workflow.global_rules)) {
      workflow.global_rules.forEach(rule => {
        console.log(chalk.cyan(`### ${rule.title}`));
        console.log(rule.content);
        console.log();
      });
    }
    
    // Display emergency procedures
    if (workflow.emergency_procedures && Array.isArray(workflow.emergency_procedures)) {
      console.log(chalk.red('\n=== EMERGENCY PROCEDURES ===\n'));
      workflow.emergency_procedures.forEach(proc => {
        console.log(chalk.red(`**${proc.title}**`));
        if (proc.commands) {
          proc.commands.forEach(cmd => {
            console.log(`  ${cmd}`);
          });
        }
        console.log();
      });
    }
    
    // Display task completion reminder
    console.log(chalk.blue('\n=== TASK COMPLETION REMINDER ===\n'));
    console.log('📝 **--sub-task-next**: After completing ONE todo task');
    console.log('📋 **--next**: After completing ALL todos in current step');
    console.log('\nCheck your todo list. If tasks remain, continue working. If all done, use --next.');

    console.log(chalk.gray(`\nCurrent step: ${state.currentStep}`));
    console.log(chalk.gray(`Mode: ${state.mode}`));
    console.log(chalk.gray(`Project: ${project}`));
  }

  async loadWorkflow(mode) {
    try {
      const workflowFile = path.join(this.workflowsDir, `${mode}-mode.yaml`);
      const data = await fs.readFile(workflowFile, 'utf8');
      const workflowData = yaml.load(data);
      
      // Convert YAML format to our expected format
      const workflow = {
        name: workflowData.name,
        description: workflowData.description,
        principles: workflowData.principles || [],
        steps: {},
        emergency: workflowData.emergency,
        global_rules: workflowData.global_rules || [],
        emergency_procedures: workflowData.emergency_procedures || [],
        quick_reference: workflowData.quick_reference || {}
      };
      
      // Convert steps array to numbered object
      if (workflowData.steps && Array.isArray(workflowData.steps)) {
        workflowData.steps.forEach(step => {
          workflow.steps[step.number] = {
            name: step.title,
            content: step.content
          };
        });
      }
      
      return workflow;
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not load ${mode}-mode.yaml:`, error.message));
      
      // Return simplified fallback workflow
      return {
        principles: [
          'Simplify ruthlessly, test what matters',
          'Never proceed with failing tests',
          'Use batch APIs instead of loops',
          'Check existing code/todos first',
          'Ask before commits/final submissions'
        ],
        steps: {
          1: {
            name: 'Announce Mode',
            content: 'Starting workflow...'
          },
          2: {
            name: 'Setup',
            content: 'Setting up environment...'
          },
          3: {
            name: 'Research',
            content: 'Researching approach...'
          },
          4: {
            name: 'Simplify',
            content: 'Simplifying solution...'
          },
          5: {
            name: 'Plan',
            content: 'Creating implementation plan...'
          },
          6: {
            name: 'Verify Plan',
            content: 'Verifying test-gated plan...'
          },
          7: {
            name: 'Implement',
            content: 'Implementing solution...'
          },
          8: {
            name: 'Cleanup',
            content: 'Cleaning up environment...'
          },
          9: {
            name: 'Verify',
            content: 'Final verification...'
          },
          10: {
            name: 'Complete',
            content: 'Workflow complete!'
          }
        },
        emergency: `**Rollback**
  git reset --hard [commit-hash]
  git push --force-with-lease origin HEAD
**Session Recovery**
  git branch --show-current
  git status
  Check ~/PersonalAgents/todos/YYYYMMDD-[project]-todo.md for progress`
      };
    }
  }

  async detectGitInfo() {
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const worktree = process.cwd();
      
      // Detect tmux session/window if available
      let tmuxSession = null;
      let tmuxWindow = null;
      
      if (process.env.TMUX) {
        try {
          tmuxSession = execSync('tmux display-message -p "#{session_name}"', { encoding: 'utf8' }).trim();
          // Use spawned window name if available, otherwise detect current window
          tmuxWindow = process.env.TMUX_WINDOW_NAME || 
                       execSync('tmux display-message -p "#{window_name}"', { encoding: 'utf8' }).trim();
        } catch (error) {
          // Not in tmux, ignore
        }
      }

      return {
        branch,
        worktree,
        tmuxSession,
        tmuxWindow
      };
    } catch (error) {
      return {
        branch: null,
        worktree: process.cwd(),
        tmuxSession: null,
        tmuxWindow: null
      };
    }
  }

  async list() {
    const states = await this.stateManager.listStates();
    
    if (states.length === 0) {
      console.log(chalk.yellow('No active workflows found'));
      return;
    }

    console.log(chalk.cyan('\nActive Workflows:\n'));
    
    states.forEach(state => {
      const age = Math.floor((Date.now() - new Date(state.createdAt).getTime()) / 1000 / 60);
      const status = state.monitor?.enabled ? '🟢' : '⚪';
      
      console.log(`${status} ${chalk.bold(state.project)} (${state.mode} mode)`);
      console.log(`   Step: ${state.currentStep} | Created: ${age} minutes ago`);
      console.log(`   Task: ${state.task}`);
      console.log();
    });
  }

  async kill(project) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      throw new Error(`No workflow found for project: ${project}`);
    }

    // Stop AI monitor
    await this.monitorManager.stopMonitor(project);

    // Delete state
    await this.stateManager.deleteState(project);
    
    console.log(chalk.red(`Killed workflow for project: ${project}`));
  }
}

export default WorkflowEngine;