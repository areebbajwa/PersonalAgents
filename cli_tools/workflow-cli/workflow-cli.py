#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import yaml
try:
    from jinja2 import Template
except ImportError:
    Template = None

class WorkflowManager:
    def __init__(self, rules_dir: Path, project: Optional[str] = None, workflow_file: Optional[Path] = None, no_auto_monitor: bool = False, spawned: bool = False, task: Optional[str] = None):
        self.rules_dir = rules_dir
        
        # Always use worktree project name if in a worktree directory
        cwd = Path.cwd()
        cwd_str = str(cwd)
        if '/worktrees/' in cwd_str:
            # Extract project name from worktree path
            # Format: .../worktrees/[project-name]-YYYYMMDD/...
            try:
                worktree_parent = cwd_str.split('/worktrees/')[1]
                worktree_project = worktree_parent.split('/')[0]
                # Always use worktree project, even if a different project was specified
                if worktree_project:
                    project = worktree_project
            except IndexError:
                pass
        
        self.project = project  # Store the project name
        self.spawned = spawned  # Store spawned flag
        self.task = task  # Store task description
        # Store state in workflow-cli's state directory
        # Always use the main PersonalAgents path, not relative to script
        state_dir = Path.home() / 'PersonalAgents' / 'cli_tools' / 'workflow-cli' / 'state'
        state_dir.mkdir(exist_ok=True, parents=True)
        
        # Determine state file name
        if workflow_file:
            # Custom workflow: use filename for state (no multi-project support)
            safe_name = "".join(c for c in workflow_file.stem if c.isalnum() or c in "-_").lower()
            self.state_file = state_dir / f"workflow_state_{safe_name}.json"
        elif project:
            # Project-based workflow: use project name
            safe_project = "".join(c for c in project if c.isalnum() or c in "-_").lower()
            self.state_file = state_dir / f"workflow_state_{safe_project}.json"
        else:
            self.state_file = state_dir / "workflow_state_default.json"
        
        self.current_state = self._load_state()
        self.no_auto_monitor = no_auto_monitor
        
    def _render_content(self, content: str) -> str:
        """Render content with Jinja2 template variables"""
        if Template and (self.task or self.spawned):
            template = Template(content)
            return template.render(task=self.task, spawned=self.spawned)
        return content
    
    def _load_state(self) -> Dict:
        """Load current workflow state from disk"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {
            "current_mode": None,
            "current_step": None,
            "completed_steps": [],
            "test_tracking": {}
        }
    
    def _save_state(self):
        """Save current workflow state to disk"""
        with open(self.state_file, 'w') as f:
            json.dump(self.current_state, f, indent=2)
    
    def _parse_workflow_file(self, file_path: Path) -> Dict:
        """Parse YAML workflow file into structured data"""
        with open(file_path, 'r') as f:
            data = yaml.safe_load(f)
        
        # Convert YAML structure to expected format
        workflow = {
            "metadata": {
                "name": data.get("name", ""),
                "description": data.get("description", "")
            },
            "global_rules": [{"title": rule.get("title", ""), "content": self._render_content(rule.get("content", ""))} 
                           for rule in data.get("global_rules", [])],
            "steps": {},
            "quick_reference": data.get("quick_reference", {}),
            "emergency_procedures": data.get("emergency_procedures", {})
        }
        
        # Convert steps list to dictionary keyed by step number
        for step in data.get("steps", []):
            workflow["steps"][step["number"]] = {
                "title": step["title"],
                "content": self._render_content(step["content"]),
                "mandatory": step.get("mandatory", False),
                "rules": []
            }
        
        return workflow
    
    def auto_start_ai_monitor_if_needed(self, mode: str, step: int, project: str, no_auto_monitor: bool = False) -> None:
        """Automatically start AI Monitor on any step if not already running"""
        # Skip if auto-monitor is disabled
        if no_auto_monitor:
            return
            
        # Always check if AI Monitor should be running
        status = self.get_ai_monitor_status(project)
        if status.get('status') != 'running':
            result = self.start_ai_monitor(project, mode)
            if result.get('status') == 'started':
                print(f"🤖 AI Monitor auto-started for project '{project}'")
            elif 'error' in result and 'screen session' in result['error']:
                print(f"ℹ️  AI Monitor not started (not in screen session)")
            else:
                print(f"⚠️  Could not start AI Monitor: {result.get('error', 'Unknown error')}")

    def auto_stop_ai_monitor_if_needed(self, project: str) -> None:
        """Automatically stop AI Monitor when workflow is complete or cleaned"""
        status = self.get_ai_monitor_status(project)
        if status.get('status') == 'running':
            result = self.stop_ai_monitor(project)
            if result.get('status') == 'stopped':
                print(f"🤖 AI Monitor auto-stopped for project '{project}'")

    def get_workflow_rules(self, mode: str, step: Optional[int] = None, workflow_file: Optional[Path] = None) -> Dict:
        """Get relevant rules for current mode and step"""
        # Update current state
        self.current_state["current_mode"] = mode
        if step is not None:
            self.current_state["current_step"] = step
        self._save_state()
        
        # Rename tmux session on step 1
        if step == 1 and self.project and self.project != 'default':
            rename_result = self.rename_tmux_session(self.project)
            if rename_result.get("error"):
                print(f"Warning: {rename_result['error']}", file=sys.stderr)
            elif rename_result.get("status") == "renamed":
                print(f"✓ {rename_result['message']}", file=sys.stderr)
        if workflow_file:
            # Use custom workflow file
            if not workflow_file.exists():
                return {"error": f"Workflow file not found: {workflow_file}"}
            workflow = self._parse_workflow_file(workflow_file)
            # Use filename without extension as mode for display
            mode = workflow_file.stem
        else:
            # Map mode to workflow file
            mode_files = {
                "dev": "dev-mode.yaml",
                "task": "task-mode.yaml"
            }
            
            workflow_file = self.rules_dir / mode_files.get(mode, "CLAUDE.md")
            if not workflow_file.exists():
                return {"error": f"Workflow file not found: {workflow_file}"}
            
            workflow = self._parse_workflow_file(workflow_file)
        
        # Build response
        response = {
            "mode": mode,
            "current_step": step,
            "rules": []
        }
        
        # Always include global rules
        response["rules"].extend(workflow["global_rules"])
        
        # Add quick reference if no specific step
        if step is None and workflow["quick_reference"]:
            # Format quick reference as readable content
            qr_content = []
            for key, value in workflow["quick_reference"].items():
                if isinstance(value, list):
                    qr_content.append(f"**{key.replace('_', ' ').title()}**:")
                    for item in value:
                        if isinstance(item, dict):
                            for k, v in item.items():
                                qr_content.append(f"  - {k}: {v}")
                        else:
                            qr_content.append(f"  - {item}")
                elif isinstance(value, dict):
                    qr_content.append(f"**{key.replace('_', ' ').title()}**:")
                    for k, v in value.items():
                        qr_content.append(f"  - {k}: {v}")
            
            response["rules"].append({
                "title": "Quick Reference",
                "content": "\n".join(qr_content)
            })
        
        # Add step-specific rules
        if step and step in workflow["steps"]:
            step_info = workflow["steps"][step]
            response["rules"].append({
                "title": f"STEP {step}: {step_info['title']}",
                "content": step_info["content"],
                "is_current_step": True
            })
            
            # Add next step preview if available
            next_step = step + 1
            if next_step in workflow["steps"]:
                response["next_step"] = {
                    "number": next_step,
                    "title": workflow["steps"][next_step]["title"]
                }
        
        # Add emergency procedures (always available)
        if workflow["emergency_procedures"]:
            if isinstance(workflow["emergency_procedures"], list):
                ep_content = []
                for proc in workflow["emergency_procedures"]:
                    if isinstance(proc, dict):
                        if "title" in proc:
                            ep_content.append(f"**{proc['title']}**")
                        if "commands" in proc:
                            for cmd in proc["commands"]:
                                ep_content.append(f"  {cmd}")
                        elif "actions" in proc:
                            for i, action in enumerate(proc["actions"], 1):
                                ep_content.append(f"{i}. {action}")
                        elif "action" in proc and "number" in proc:
                            ep_content.append(f"{proc['number']}. {proc['action']}")
                response["emergency_procedures"] = "\n".join(ep_content)
            else:
                response["emergency_procedures"] = str(workflow["emergency_procedures"])
        
        return response
    
    def advance_step(self, mode: str, workflow_file: Optional[Path] = None) -> Dict:
        """Move to the next step in the workflow"""
        self.current_state["current_mode"] = mode
        current = self.current_state.get("current_step")
        if current is None:
            current = 0
        next_step = current + 1
        
        # First, check if the next step exists
        if workflow_file:
            if not workflow_file.exists():
                return {"error": f"Workflow file not found: {workflow_file}"}
            workflow = self._parse_workflow_file(workflow_file)
        else:
            mode_files = {
                "dev": "dev-mode.yaml",
                "task": "task-mode.yaml"
            }
            workflow_file_path = self.rules_dir / mode_files.get(mode, "CLAUDE.md")
            if not workflow_file_path.exists():
                return {"error": f"Workflow file not found: {workflow_file_path}"}
            workflow = self._parse_workflow_file(workflow_file_path)
        
        # Check if next step exists
        if next_step not in workflow["steps"]:
            # We've completed the final step - delete state file
            if self.state_file.exists():
                self.state_file.unlink()
            return {
                "mode": mode,
                "message": f"Workflow complete! All steps in {mode} mode have been finished.",
                "state_cleared": True
            }
        
        # Mark previous step as completed
        if current > 0:
            completed_key = f"{mode}_step_{current}"
            if completed_key not in self.current_state["completed_steps"]:
                self.current_state["completed_steps"].append(completed_key)
        
        self.current_state["current_step"] = next_step
        self._save_state()
        
        # Auto-start AI Manager on step 1
        project_name = self.state_file.stem.replace('workflow_state_', '')
        if project_name != 'default':
            self.auto_start_ai_monitor_if_needed(mode, next_step, project_name, self.no_auto_monitor)
        
        return self.get_workflow_rules(mode, self.current_state["current_step"], workflow_file=workflow_file)
    
    def set_step(self, mode: str, step: int, workflow_file: Optional[Path] = None) -> Dict:
        """Jump to a specific step"""
        self.current_state["current_mode"] = mode
        self.current_state["current_step"] = step
        self._save_state()
        
        # Get project name
        project_name = self.state_file.stem.replace('workflow_state_', '')
        
        # Rename tmux session on step 1
        if step == 1 and project_name != 'default':
            rename_result = self.rename_tmux_session(project_name)
            if rename_result.get("error"):
                print(f"Warning: {rename_result['error']}", file=sys.stderr)
            elif rename_result.get("status") == "renamed":
                print(f"✓ {rename_result['message']}", file=sys.stderr)
        
        # Auto-start AI Manager on step 1
        if project_name != 'default':
            self.auto_start_ai_monitor_if_needed(mode, step, project_name, self.no_auto_monitor)
        
        return self.get_workflow_rules(mode, step, workflow_file=workflow_file)
    
    def track_test(self, test_name: str, status: str) -> Dict:
        """Track test execution status"""
        from datetime import datetime
        self.current_state["test_tracking"][test_name] = {
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        self._save_state()
        return {"test": test_name, "status": status}
    
    def reset_workflow(self, mode: Optional[str] = None) -> Dict:
        """Reset workflow state"""
        if mode:
            # Reset only specific mode
            self.current_state["completed_steps"] = [
                s for s in self.current_state["completed_steps"] 
                if not s.startswith(f"{mode}_")
            ]
            if self.current_state.get("current_mode") == mode:
                self.current_state["current_step"] = None
        else:
            # Full reset
            self.current_state = {
                "current_mode": None,
                "current_step": None,
                "completed_steps": [],
                "test_tracking": {}
            }
        
        self._save_state()
        return {"status": "reset", "mode": mode}
    
    def clean_project_state(self) -> Dict:
        """Delete project state file completely and stop AI Manager"""
        project_name = self.state_file.stem.replace('workflow_state_', '')
        
        # Auto-stop AI Manager before cleaning
        if project_name != 'default':
            self.auto_stop_ai_monitor_if_needed(project_name)
        
        if self.state_file.exists():
            self.state_file.unlink()
            return {"status": "cleaned", "message": "Project state deleted successfully"}
        else:
            return {"status": "not_found", "message": "No project state file found"}
    
    def get_sub_task_reminder(self, mode: str, workflow_file: Optional[Path] = None) -> Dict:
        """Get global rules and reminders about sub-task completion"""
        # Get current workflow
        if workflow_file:
            if not workflow_file.exists():
                return {"error": f"Workflow file not found: {workflow_file}"}
            workflow = self._parse_workflow_file(workflow_file)
        else:
            mode_files = {
                "dev": "dev-mode.yaml",
                "task": "task-mode.yaml"
            }
            workflow_file_path = self.rules_dir / mode_files.get(mode, "CLAUDE.md")
            if not workflow_file_path.exists():
                return {"error": f"Workflow file not found: {workflow_file_path}"}
            workflow = self._parse_workflow_file(workflow_file_path)
        
        # Build response with global rules and reminders
        response = {
            "mode": mode,
            "current_step": self.current_state.get("current_step"),
            "rules": workflow["global_rules"],
            "reminder": {
                "title": "Task Completion Reminder",
                "content": """
📝 **--sub-task-next**: After completing ONE todo task
📋 **--next**: After completing ALL todos in current step

Check your todo list. If tasks remain, continue working. If all done, use --next.
"""
            }
        }
        
        return response
    
    def rename_tmux_session(self, project: str) -> Dict:
        """Rename current tmux session to match project name"""
        import subprocess
        import os
        
        # Check if we're in a tmux session
        tmux_pane = os.environ.get('TMUX_PANE')
        if not tmux_pane:
            return {"warning": "Not running in a tmux session, skipping rename"}
        
        try:
            # Get current session name
            result = subprocess.run(['tmux', 'display-message', '-p', '#S'], 
                                 capture_output=True, text=True)
            if result.returncode != 0:
                return {"error": "Could not get current tmux session name"}
            
            current_session = result.stdout.strip()
            
            # Create new session name based on project
            new_session_name = f"{project}-workflow"
            
            # Don't rename if already has the right name
            if current_session == new_session_name:
                return {"status": "unchanged", "session": new_session_name}
            
            # Rename the session
            result = subprocess.run(['tmux', 'rename-session', new_session_name],
                                 capture_output=True, text=True)
            if result.returncode != 0:
                return {"error": f"Failed to rename tmux session: {result.stderr}"}
            
            return {
                "status": "renamed",
                "old_session": current_session,
                "new_session": new_session_name,
                "message": f"Renamed tmux session from '{current_session}' to '{new_session_name}'"
            }
            
        except Exception as e:
            return {"error": f"Failed to rename tmux session: {str(e)}"}
    
    def start_ai_monitor(self, project: str = None, mode: str = None) -> Dict:
        """Start AI Monitor monitoring for the project"""
        import subprocess
        import os
        
        # Auto-detect project and mode from current state
        if not project:
            project = self.project or self.state_file.stem.replace('workflow_state_', '') or "unknown"
        if not mode:
            mode = self.current_state.get("current_mode") or "dev"
        
        # Find ai-monitor-cli
        script_dir = Path(__file__).resolve().parent
        ai_monitor_cli = script_dir.parent / 'ai-monitor-cli' / 'ai-monitor-cli'
        
        if not ai_monitor_cli.exists():
            return {"error": f"AI Monitor CLI not found at {ai_monitor_cli}"}
        
        # Get current tmux session and window
        tmux_pane = os.environ.get('TMUX_PANE')
        if tmux_pane:
            # We're in tmux, get the CURRENT session and window name (after any renaming)
            try:
                # CRITICAL FIX: Use -t flag to specify the pane context
                # This ensures we get the correct window name for spawned workflows
                # Get current session name (this will be the renamed name if session was renamed)
                result = subprocess.run(['tmux', 'display-message', '-t', tmux_pane, '-p', '#S'], 
                                     capture_output=True, text=True)
                if result.returncode != 0:
                    return {"error": "Could not get tmux session name"}
                tmux_session_name = result.stdout.strip()
                
                # Get window name from the correct pane context
                result = subprocess.run(['tmux', 'display-message', '-t', tmux_pane, '-p', '#W'], 
                                     capture_output=True, text=True)
                if result.returncode == 0:
                    tmux_window_name = result.stdout.strip()
                    # If we have a window name, use session:window format
                    tmux_target = f"{tmux_session_name}:{tmux_window_name}"
                else:
                    # Fallback to just session name
                    tmux_target = tmux_session_name
            except:
                return {"error": "Failed to get tmux session info"}
        else:
            return {"error": "Not running in a tmux session. AI Monitor requires tmux."}
        
        # Store tmux session with project state
        current_state = self.current_state.copy()
        current_state[f"{project}_tmux_session"] = tmux_session_name
        current_state[f"{project}_tmux_target"] = tmux_target
        self.current_state = current_state
        self._save_state()
        
        try:
            # Start AI Monitor in background
            cmd = [
                str(ai_monitor_cli), 'monitor',
                '--project', project,
                '--mode', mode,
                '--session', tmux_target,
                '--interval', '60'  # Check every minute
            ]
            
            # Start in background and save PID
            process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # Save PID to state
            pid_file = self.state_file.parent / f"ai_monitor_pid_{project}.txt"
            with open(pid_file, 'w') as f:
                f.write(str(process.pid))
            
            return {
                "status": "started",
                "project": project,
                "mode": mode,
                "tmux_session": tmux_session_name,
                "tmux_target": tmux_target,
                "pid": process.pid,
                "message": f"AI Monitor started for project '{project}' in {mode} mode"
            }
            
        except Exception as e:
            return {"error": f"Failed to start AI Monitor: {str(e)}"}
    
    def stop_ai_monitor(self, project: str = None) -> Dict:
        """Stop AI Monitor monitoring for the project"""
        import os
        import signal
        
        # Auto-detect project from current state
        if not project:
            project = self.project or self.state_file.stem.replace('workflow_state_', '') or "unknown"
        
        # Find PID file
        pid_file = self.state_file.parent / f"ai_monitor_pid_{project}.txt"
        
        if not pid_file.exists():
            return {"error": f"AI Monitor not running for project '{project}' (no PID file found)"}
        
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Try to kill the process
            os.kill(pid, signal.SIGTERM)
            
            # Remove PID file
            pid_file.unlink()
            
            return {
                "status": "stopped",
                "project": project,
                "pid": pid,
                "message": f"AI Monitor stopped for project '{project}'"
            }
            
        except ProcessLookupError:
            # Process already dead, just clean up PID file
            pid_file.unlink()
            return {
                "status": "stopped",
                "project": project,
                "message": f"AI Monitor was not running for project '{project}' (cleaned up PID file)"
            }
        except Exception as e:
            return {"error": f"Failed to stop AI Monitor: {str(e)}"}
    
    def stop_all_ai_monitors(self) -> Dict:
        """Stop all running AI monitors"""
        import os
        import signal
        
        stopped_monitors = []
        errors = []
        
        # Find all PID files
        pid_files = list(self.state_file.parent.glob('ai_monitor_pid_*.txt'))
        
        if not pid_files:
            return {"message": "No AI monitors are running", "stopped": []}
        
        for pid_file in pid_files:
            # Extract project name from filename
            project = pid_file.stem.replace('ai_monitor_pid_', '')
            
            try:
                with open(pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                # Try to kill the process
                try:
                    os.kill(pid, signal.SIGTERM)
                    stopped_monitors.append({"project": project, "pid": pid, "status": "stopped"})
                except ProcessLookupError:
                    # Process already dead
                    stopped_monitors.append({"project": project, "pid": pid, "status": "already_stopped"})
                
                # Remove PID file
                pid_file.unlink()
                
            except Exception as e:
                errors.append({"project": project, "error": str(e)})
        
        return {
            "message": f"Stopped {len(stopped_monitors)} AI monitor(s)",
            "stopped": stopped_monitors,
            "errors": errors if errors else None
        }
    
    def get_ai_monitor_status(self, project: str) -> Dict:
        """Get AI Monitor status for the project"""
        import os
        
        pid_file = self.state_file.parent / f"ai_monitor_pid_{project}.txt"
        
        if not pid_file.exists():
            return {
                "status": "stopped",
                "project": project,
                "message": "AI Monitor is not running"
            }
        
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process is still running
            os.kill(pid, 0)  # This will raise an exception if process doesn't exist
            
            return {
                "status": "running",
                "project": project,
                "pid": pid,
                "message": f"AI Monitor is running for project '{project}'"
            }
            
        except ProcessLookupError:
            # Process is dead, clean up PID file
            pid_file.unlink()
            return {
                "status": "stopped", 
                "project": project,
                "message": "AI Monitor was not running (cleaned up stale PID file)"
            }
        except Exception as e:
            return {"error": f"Failed to check AI Monitor status: {str(e)}"}


def main():
    parser = argparse.ArgumentParser(description='Workflow CLI - Get relevant workflow rules')
    parser.add_argument('--mode', choices=['dev', 'task'], 
                       help='Workflow mode (dev/task)')
    parser.add_argument('--workflow', type=Path, help='Path to custom workflow YAML file')
    parser.add_argument('--step', type=int, help='Current step number')
    parser.add_argument('--next', action='store_true', help='Advance to next step')
    parser.add_argument('--sub-task-next', action='store_true', 
                       help='Show global rules and remind about task completion')
    parser.add_argument('--remind-rules', action='store_true', 
                       help='Alias for --sub-task-next: Show global rules and remind about task completion')
    parser.add_argument('--start-ai-monitor', action='store_true',
                       help='Start AI Monitor monitoring for this project')
    parser.add_argument('--stop-ai-monitor', action='store_true',
                       help='Stop AI Monitor monitoring for this project')
    parser.add_argument('--stop-all-ai-monitors', action='store_true',
                       help='Stop all running AI Monitors')
    parser.add_argument('--no-auto-monitor', action='store_true',
                       help='Disable automatic AI Monitor startup (default: enabled)')
    parser.add_argument('--set-step', type=int, help='Jump to specific step')
    parser.add_argument('--track-test', nargs=2, metavar=('NAME', 'STATUS'),
                       help='Track test execution (name and status)')
    parser.add_argument('--reset', action='store_true', help='Reset workflow state')
    parser.add_argument('--clean', action='store_true', help='Delete project state completely')
    parser.add_argument('--project', type=str, help='Project/task name for state isolation')
    parser.add_argument('--spawned', action='store_true', 
                       help='Indicates workflow was spawned (exits Claude on completion)')
    parser.add_argument('--task', type=str,
                       help='Task description for the workflow')
    parser.add_argument('--rules-dir', type=Path, 
                       help='Directory containing workflow rules')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    
    # Determine rules directory
    if args.rules_dir:
        rules_dir = args.rules_dir
    else:
        # Always use the main PersonalAgents workflows directory
        rules_dir = Path.home() / 'PersonalAgents' / 'cli_tools' / 'workflow-cli' / 'workflows'
    
    # For AI monitor commands without project, try to detect from most recent state file
    if (args.start_ai_monitor or args.stop_ai_monitor) and not args.project:
        state_dir = Path.home() / 'PersonalAgents' / 'cli_tools' / 'workflow-cli' / 'state'
        if state_dir.exists():
            # Find most recently modified workflow state file
            state_files = list(state_dir.glob('workflow_state_*.json'))
            if state_files:
                # Filter out default state file
                state_files = [f for f in state_files if f.stem != 'workflow_state_default']
                if state_files:
                    # Sort by modification time
                    most_recent = max(state_files, key=lambda f: f.stat().st_mtime)
                    # Extract project name from filename
                    project_name = most_recent.stem.replace('workflow_state_', '')
                    args.project = project_name
    
    # Initialize workflow manager
    manager = WorkflowManager(rules_dir, project=args.project, workflow_file=args.workflow, 
                            no_auto_monitor=args.no_auto_monitor, spawned=args.spawned, task=args.task)
    
    # Handle commands
    result = {}
    
    if args.reset:
        result = manager.reset_workflow(args.mode)
    elif args.clean:
        result = manager.clean_project_state()
    elif args.track_test:
        result = manager.track_test(args.track_test[0], args.track_test[1])
    elif args.start_ai_monitor:
        # Auto-detect everything from current state
        result = manager.start_ai_monitor()
    elif args.stop_ai_monitor:
        # Auto-detect project from current state
        result = manager.stop_ai_monitor()
    elif args.stop_all_ai_monitors:
        # Stop all running AI monitors
        result = manager.stop_all_ai_monitors()
    elif args.sub_task_next or args.remind_rules:
        # Handle sub-task-next and remind-rules commands (they're identical)
        if args.workflow:
            mode = args.workflow.stem
            result = manager.get_sub_task_reminder(mode, workflow_file=args.workflow)
        else:
            mode = args.mode or manager.current_state.get("current_mode")
            if not mode:
                result = {"error": "No mode specified and no current mode in project state. Use --mode to set initial mode."}
            else:
                result = manager.get_sub_task_reminder(mode)
    elif args.next or args.set_step is not None or args.step is not None:
        if args.workflow:
            # Custom workflow file - use filename as mode
            mode = args.workflow.stem
            if args.next:
                result = manager.advance_step(mode, workflow_file=args.workflow)
            elif args.set_step is not None:
                result = manager.set_step(mode, args.set_step, workflow_file=args.workflow)
            else:
                # Get specific step
                result = manager.get_workflow_rules(mode, args.step, workflow_file=args.workflow)
        else:
            # Use mode from args or fall back to current state
            mode = args.mode or manager.current_state.get("current_mode")
            if not mode:
                result = {"error": "No mode specified and no current mode in project state. Use --mode to set initial mode."}
            else:
                if args.next:
                    result = manager.advance_step(mode)
                elif args.set_step is not None:
                    result = manager.set_step(mode, args.set_step)
                else:
                    # Get specific step
                    result = manager.get_workflow_rules(mode, args.step)
    elif args.mode:
        # Just showing current or overview for a mode
        step = manager.current_state.get("current_step") if not args.step else args.step
        result = manager.get_workflow_rules(args.mode, step)
    elif args.workflow:
        # Custom workflow file without specific step
        mode = args.workflow.stem
        step = manager.current_state.get("current_step") if not args.step else args.step
        result = manager.get_workflow_rules(mode, step, workflow_file=args.workflow)
    else:
        # No mode specified, return current state
        result = {
            "current_state": manager.current_state,
            "project": args.project or "default",
            "help": "Use --mode [dev|task] to get workflow rules"
        }
    
    # Output result
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        # Format for human reading
        if "rules" in result:
            # Check if this is a sub-task-next response
            if "reminder" in result:
                print(f"=== {result['mode'].upper()} MODE - Global Rules (Step {result.get('current_step', 'N/A')}) ===\n")
                
                # Print global rules
                print("### GLOBAL RULES ###")
                for rule in result["rules"]:
                    if isinstance(rule, dict):
                        print(f"### {rule.get('title', 'Rule')}")
                        print(rule.get('content', ''))
                    else:
                        print(f"- {rule}")
                    print()
                
                # Print reminder
                print(f"\n### {result['reminder']['title']} ###")
                print(result['reminder']['content'])
            else:
                # Regular rules output
                print(f"=== {result['mode'].upper()} MODE - Step {result.get('current_step', 'Overview')} ===\n")
                
                for rule in result["rules"]:
                    if rule.get("is_current_step"):
                        print(f">>> CURRENT STEP <<<")
                    print(f"### {rule['title']}")
                    print(rule["content"])
                    print()
                
                if "next_step" in result:
                    print(f"\nNext: STEP {result['next_step']['number']} - {result['next_step']['title']}")
                
                if "emergency_procedures" in result:
                    print("\n=== EMERGENCY PROCEDURES ===")
                    print(result["emergency_procedures"])
        elif "message" in result and "state_cleared" in result:
            # Handle completion message
            print(f"\n✅ {result['message']}\n")
            if result.get("state_cleared"):
                print("State file has been cleared. Start a new workflow with --mode [dev|task]")
        else:
            print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()