#!/usr/bin/env python3

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

class SpawnCLI:
    def __init__(self):
        self.base_path = Path.home() / 'PersonalAgents'
        self.state_dir = self.base_path / 'cli_tools' / 'workflow-cli' / 'state'
        
    def spawn_workflow(self, project: str, mode: str, task: str, step: int = 1) -> Dict:
        """Spawn a workflow in a new tmux window"""
        window_name = f"{mode}-{project}"
        
        # Check if tmux session exists
        result = subprocess.run(['tmux', 'list-sessions'], capture_output=True, text=True)
        if result.returncode != 0:
            return {"error": "No tmux session found. Please start tmux first."}
        
        # Create new tmux window and start Claude
        cmd = [
            'tmux', 'new-window', '-n', window_name,
            '-c', str(self.base_path),
            'zsh'  # Start with just a shell
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return {"error": f"Failed to create tmux window: {result.stderr}"}
        
        # Set environment variables and start Claude
        env_cmds = [
            f'export SPAWN_WORKFLOW=1',
            f'export WORKFLOW_PROJECT={project}',
            f'export WORKFLOW_MODE={mode}',
            f'export WORKFLOW_STEP={step}',
            f"export WORKFLOW_TASK='{task}'",
            f'yolo {project}'
        ]
        
        for cmd in env_cmds:
            subprocess.run(['tmux', 'send-keys', '-t', window_name, cmd, 'Enter'])
            time.sleep(0.1)
        
        # Wait for Claude to start (check for cursor in pane)
        time.sleep(15)
        
        # Send workflow command (without Enter first)
        workflow_cmd = f'workflow-cli --project {project} --mode {mode} --step {step} --task "{task}" --spawned'
        subprocess.run(['tmux', 'send-keys', '-t', window_name, workflow_cmd])
        
        # Send Enter as a separate command
        subprocess.run(['tmux', 'send-keys', '-t', window_name, 'Enter'])
        
        return {"status": "spawned", "project": project, "mode": mode, "window": window_name}
    
    def list_workflows(self) -> List[Dict]:
        """List all active workflows"""
        workflows = []
        
        if not self.state_dir.exists():
            return workflows
            
        for state_file in self.state_dir.glob("workflow_state_*.json"):
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
                    
                # Extract project name from filename
                project = state_file.stem.replace("workflow_state_", "")
                
                workflows.append({
                    "project": project,
                    "mode": state.get("current_mode", "unknown"),
                    "step": state.get("current_step", 0),
                    "state_file": str(state_file)
                })
            except Exception as e:
                continue
                
        return workflows
    
    def kill_workflow(self, project: str) -> Dict:
        """Kill a workflow by project name"""
        # Try both dev and task mode window names
        for mode in ['dev', 'task']:
            window_name = f"{mode}-{project}"
            result = subprocess.run(['tmux', 'kill-window', '-t', window_name], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                # Clean up state file
                state_file = self.state_dir / f"workflow_state_{project}.json"
                if state_file.exists():
                    state_file.unlink()
                return {"status": "killed", "project": project, "window": window_name}
        
        return {"error": f"No workflow window found for project '{project}'"}

def main():
    parser = argparse.ArgumentParser(
        description='Spawn and manage workflows in tmux windows',
        epilog='''Examples:
  spawn-cli spawn my-project dev "Add a new feature"
  spawn-cli list
  spawn-cli kill my-project'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Spawn subcommand
    spawn_parser = subparsers.add_parser('spawn', help='Spawn a new workflow')
    spawn_parser.add_argument('project', help='Project name')
    spawn_parser.add_argument('mode', choices=['dev', 'task'], help='Workflow mode')
    spawn_parser.add_argument('task', help='Task description')
    spawn_parser.add_argument('--step', type=int, default=1, help='Starting step (default: 1)')
    
    # List subcommand
    list_parser = subparsers.add_parser('list', help='List active workflows')
    
    # Kill subcommand
    kill_parser = subparsers.add_parser('kill', help='Kill a workflow')
    kill_parser.add_argument('project', help='Project name to kill')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    cli = SpawnCLI()
    
    if args.command == 'spawn':
        result = cli.spawn_workflow(args.project, args.mode, args.task, args.step)
        if 'error' in result:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"✓ Spawned {result['mode']} workflow for '{result['project']}' in window '{result['window']}'")
    
    elif args.command == 'list':
        workflows = cli.list_workflows()
        if not workflows:
            print("No active workflows found.")
        else:
            print("Active workflows:")
            for wf in workflows:
                print(f"  - {wf['project']} ({wf['mode']} mode, step {wf['step']})")
    
    elif args.command == 'kill':
        result = cli.kill_workflow(args.project)
        if 'error' in result:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"✓ Killed workflow '{result['project']}' (window: {result['window']})")

if __name__ == '__main__':
    main()