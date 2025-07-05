import { execSync, spawn, spawnSync } from 'child_process';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import StateManager from './state-manager.js';

export class SpawnManager {
  constructor() {
    this.stateManager = new StateManager();
  }

  async spawnWorkflow(project, mode, task, options = {}) {
    // Check if workflow already exists
    const existingState = await this.stateManager.loadState(project);
    if (existingState && !options.force) {
      console.log(chalk.yellow(`Workflow already exists for project: ${project}`));
      console.log(chalk.yellow(`Use 'workflow kill ${project}' first or add --force`));
      return null;
    }

    // Create tmux session name
    const sessionName = `${project}-workflow`;
    
    // Check if tmux window already exists
    try {
      execSync(`tmux list-windows -F "#{window_name}" | grep -q "^${sessionName}$"`, { shell: true });
      if (options.force) {
        // Force option enabled, kill existing window
        console.log(chalk.yellow(`Killing existing tmux window: ${sessionName}`));
        try {
          execSync(`tmux kill-window -t ${sessionName} 2>/dev/null`);
        } catch (killError) {
          // Window might have been killed already
        }
      } else {
        console.log(chalk.yellow(`Tmux window '${sessionName}' already exists`));
        console.log(chalk.yellow(`Use 'tmux kill-window -t ${sessionName}' first`));
        return null;
      }
    } catch (error) {
      // Window doesn't exist, good to proceed
    }

    // Detect current git branch and worktree
    let branch = 'main';
    let worktree = process.cwd();
    
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.log(chalk.yellow('Not in a git repository, using default branch: main'));
    }

    // Workflow will be started by sending the command to Claude after it launches
    
    // Check if we're already in a tmux session
    const inTmuxSession = process.env.TMUX !== undefined;
    
    if (!inTmuxSession) {
      console.log(chalk.red('Error: You must be inside a tmux session to spawn workflows'));
      console.log(chalk.yellow('Start tmux first with: tmux new-session -s main'));
      return null;
    }
    
    // Create a new window in the current session without switching to it
    const tmuxCmd = [
      'tmux', 'new-window',
      '-d',  // Detached (don't switch focus)
      '-n', sessionName,  // Window name
      '-c', worktree,    // Start directory
    ];

    // Create the shell command to launch Claude Code
    // The workflow will be initiated by sending the command after Claude starts
    const shellCmd = [
      'zsh', '-c',
      `
      echo '=== Starting Claude Code for ${project} workflow ==='
      echo 'Task: ${task}'
      echo ''
      echo 'Launching Claude Code...'
      
      # Export environment for workflow detection
      export TMUX_WINDOW_NAME="${sessionName}"
      export SPAWN_WORKFLOW=1
      export SPAWN_PROJECT="${project}"
      
      # Launch Claude Code
      /Users/areeb2/.claude/local/claude --dangerously-skip-permissions
      
      # After Claude exits, keep shell open
      echo ''
      echo 'Claude session ended.'
      exec zsh
      `
    ];

    console.log(chalk.cyan(`Creating tmux window: ${sessionName}`));
    console.log(chalk.gray(`Branch: ${branch}`));
    console.log(chalk.gray(`Directory: ${worktree}`));
    
    try {
      try {
        // Get current tmux session
        const currentSession = execSync('tmux display-message -p "#S"', { encoding: 'utf8' }).trim();
        console.log(chalk.gray(`Current tmux session: ${currentSession}`));
        
        // Use spawnSync for better control - spread the shell command array
        const tmuxArgs = [
          'new-window',
          '-t', `${currentSession}:`,  // Target the current session
          '-d',
          '-n', sessionName,
          '-c', worktree,
          ...shellCmd  // Spread the shell command array
        ];
        
        const result = spawnSync('tmux', tmuxArgs, { encoding: 'utf8' });
        
        if (result.error) {
          throw result.error;
        }
        if (result.status !== 0) {
          console.error(chalk.red('Command failed with status:'), result.status);
          if (result.stderr) console.error(chalk.red('stderr:'), result.stderr);
          if (result.stdout) console.error(chalk.red('stdout:'), result.stdout);
          throw new Error(`tmux command failed with status ${result.status}`);
        }
      } catch (cmdError) {
        console.error(chalk.red('Command failed:'), cmdError.message);
        throw cmdError;
      }
      
      // Force rename the window (in case automatic-rename is on)
      try {
        execSync(`tmux rename-window -t :$ ${sessionName}`);
      } catch (renameError) {
        console.warn(chalk.yellow('Could not rename window:'), renameError.message);
      }
      
      // Don't create state here - let the workflow command create it
      // This prevents the "workflow already exists" error

      console.log(chalk.green(`✓ Spawned workflow in tmux window: ${sessionName}`));
      
      // Wait for Claude to start and send the workflow command
      console.log(chalk.cyan('⏳ Waiting for Claude Code to start...'));
      setTimeout(() => {
        try {
          // Send the workflow command to Claude
          const workflowCommand = `workflow ${mode} "${task}"`;
          console.log(chalk.cyan(`📤 Sending workflow command: ${workflowCommand}`));
          
          // Use C-u to clear any existing text, then send the command
          execSync(`tmux send-keys -t ${sessionName} C-u`);
          execSync(`tmux send-keys -t ${sessionName} 'run command: ${workflowCommand}'`);
          execSync(`tmux send-keys -t ${sessionName} Enter`);
          
          console.log(chalk.green(`✓ Workflow command sent to Claude Code`));
        } catch (error) {
          console.error(chalk.yellow('Could not send workflow command:'), error.message);
        }
      }, 15000); // Wait 15 seconds for Claude to start
      
      console.log(chalk.cyan(`\nTo switch to the window:`));
      console.log(chalk.white(`  tmux select-window -t ${sessionName}`));
      console.log(chalk.cyan(`\nTo view without switching:`));
      console.log(chalk.white(`  tmux capture-pane -t ${sessionName} -p`));
      
      return sessionName;
    } catch (error) {
      console.error(chalk.red('Failed to spawn workflow:'), error.message);
      return null;
    }
  }

  async attachToWorkflow(project) {
    const state = await this.stateManager.loadState(project);
    
    if (!state) {
      console.log(chalk.yellow(`No workflow found for project: ${project}`));
      return;
    }

    if (!state.workflow.tmuxSession) {
      console.log(chalk.yellow(`No tmux session found for project: ${project}`));
      return;
    }

    const sessionName = state.workflow.tmuxSession;
    
    try {
      // Check if session exists
      execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
      
      // Attach to session
      console.log(chalk.cyan(`Attaching to tmux session: ${sessionName}`));
      execSync(`tmux attach -t ${sessionName}`, { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red(`Tmux session '${sessionName}' not found`));
      console.log(chalk.yellow('The workflow may have completed or been killed'));
    }
  }

  detectTerminal() {
    // Detect which terminal emulator is being used
    const term = process.env.TERM_PROGRAM;
    
    if (term === 'iTerm.app') return 'iTerm2';
    if (term === 'Apple_Terminal') return 'Terminal';
    if (process.env.ALACRITTY_SOCKET) return 'Alacritty';
    if (process.env.KITTY_WINDOW_ID) return 'Kitty';
    
    return 'Unknown';
  }

  async listSessions() {
    try {
      // Get all tmux windows
      const output = execSync('tmux list-windows -F "#{window_name}"', { encoding: 'utf8' });
      const windows = output.trim().split('\n').filter(w => w.endsWith('-workflow'));
      
      if (windows.length === 0) {
        console.log(chalk.yellow('No workflow tmux windows found'));
        return;
      }

      console.log(chalk.cyan('\nActive Workflow Windows:\n'));
      
      for (const window of windows) {
        const project = window.replace('-workflow', '');
        const state = await this.stateManager.loadState(project);
        
        if (state) {
          const age = Math.floor((Date.now() - new Date(state.createdAt).getTime()) / 1000 / 60);
          console.log(`• ${chalk.bold(window)}`);
          console.log(`  Project: ${project} | Mode: ${state.mode} | Step: ${state.currentStep}`);
          console.log(`  Created: ${age} minutes ago`);
          console.log(`  Switch to: tmux select-window -t ${window}`);
        } else {
          console.log(`• ${chalk.bold(window)} (no state found)`);
        }
        console.log();
      }
    } catch (error) {
      if (error.message.includes('no server running')) {
        console.log(chalk.yellow('No tmux server running'));
      } else {
        console.error(chalk.red('Error listing windows:'), error.message);
      }
    }
  }

  async killSession(project) {
    const state = await this.stateManager.loadState(project);
    const windowName = `${project}-workflow`;
    
    // Kill tmux window (not session)
    try {
      execSync(`tmux kill-window -t ${windowName} 2>/dev/null`);
      console.log(chalk.yellow(`Killed tmux window: ${windowName}`));
    } catch (error) {
      // Window might not exist
      console.log(chalk.gray(`Window ${windowName} not found (may have already closed)`));
    }

    // Delete state
    if (state) {
      await this.stateManager.deleteState(project);
      console.log(chalk.yellow(`Deleted workflow state for: ${project}`));
    }
    
    console.log(chalk.green(`✓ Workflow killed: ${project}`));
  }
}

export default SpawnManager;