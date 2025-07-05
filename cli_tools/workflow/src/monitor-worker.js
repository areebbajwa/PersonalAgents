#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import https from 'https';

// Enhanced monitor worker with Gemini integration and Claude log monitoring
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
    this.lastCheckTime = Date.now();
    this.checkInterval = 60000; // 60 seconds for compliance checks
    this.geminiApiKey = this.loadGeminiApiKey();
    this.lastAnalyzedContent = '';
    
    // Paths for logs and rules
    this.claudeLogsDir = path.join(os.homedir(), '.claude', 'projects', '-Volumes-ExtremeSSD-PersonalAgents-PersonalAgents');
    this.rulesFile = path.join(os.homedir(), 'PersonalAgents', 'docs', 'workflow-rules.md');
    this.geminiLogsDir = path.join(os.homedir(), 'PersonalAgents', 'cli_tools', 'workflow', 'logs', 'gemini');
    
    // Ensure log directories exist
    this.ensureLogDirectories();
  }

  async ensureLogDirectories() {
    try {
      await fs.mkdir(this.geminiLogsDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directories: ${error.message}`);
    }
  }

  loadGeminiApiKey() {
    // Try environment variable first
    if (process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    
    // Try config file
    try {
      const configPath = path.join(os.homedir(), 'PersonalAgents', 'config', '.env');
      if (fsSync.existsSync(configPath)) {
        const envContent = fsSync.readFileSync(configPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);
        if (match) {
          return match[1].trim().replace(/['"]/g, '');
        }
      }
    } catch (error) {
      console.warn(`Could not load Gemini API key: ${error.message}`);
    }
    
    return null;
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

  async readClaudeLogs() {
    try {
      // Find the latest Claude log file
      const files = await fs.readdir(this.claudeLogsDir);
      
      // Get file stats to sort by modification time
      const fileStats = await Promise.all(
        files
          .filter(f => f.endsWith('.jsonl'))
          .map(async (file) => {
            const filePath = path.join(this.claudeLogsDir, file);
            const stats = await fs.stat(filePath);
            return { file, mtime: stats.mtime };
          })
      );
      
      // Sort by modification time (newest first)
      const logFiles = fileStats
        .sort((a, b) => b.mtime - a.mtime)
        .map(f => f.file);
      
      if (logFiles.length === 0) {
        return null;
      }
      
      // Read the latest log file
      const latestLog = path.join(this.claudeLogsDir, logFiles[0]);
      // For large files, only read the last 500KB
      const stats = await fs.stat(latestLog);
      const fileSize = stats.size;
      let content;
      
      if (fileSize > 500000) { // 500KB
        // Read only the last 500KB
        const fd = await fs.open(latestLog, 'r');
        const buffer = Buffer.alloc(500000);
        await fd.read(buffer, 0, 500000, fileSize - 500000);
        await fd.close();
        content = buffer.toString('utf8');
        
        // Find the first complete line
        const firstNewline = content.indexOf('\n');
        if (firstNewline > 0) {
          content = content.substring(firstNewline + 1);
        }
      } else {
        content = await fs.readFile(latestLog, 'utf8');
      }
      
      // Parse JSONL entries
      const entries = content.trim().split('\n')
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(e => e !== null);
      
      // Format entries for analysis
      return this.formatClaudeLogsForAnalysis(entries);
    } catch (error) {
      console.error(`Failed to read Claude logs: ${error.message}`);
      return null;
    }
  }

  formatClaudeLogsForAnalysis(entries) {
    // Get the last 50 entries or so for context
    const recentEntries = entries.slice(-50);
    
    const formatted = recentEntries.map(entry => {
      // Handle Claude Code log format
      if (entry.type === 'assistant' && entry.message) {
        const role = entry.message.role || 'assistant';
        const content = entry.message.content || [];
        
        // Extract text content from message
        let textContent = '';
        if (Array.isArray(content)) {
          textContent = content.map(c => {
            if (c.type === 'text') {
              return c.text;
            } else if (c.type === 'tool_use') {
              return `[tool:${c.name}]`;
            }
            return '';
          }).join(' ');
        } else if (typeof content === 'string') {
          textContent = content;
        }
        
        return `[${role}]: ${textContent.substring(0, 500)}${textContent.length > 500 ? '...' : ''}`;
      } else if (entry.type === 'user' && entry.message) {
        const role = entry.message.role || 'user';
        const content = entry.message.content || [];
        
        // Extract text content from message
        let textContent = '';
        if (Array.isArray(content)) {
          textContent = content.map(c => {
            if (c.type === 'text') {
              return c.text;
            } else if (c.type === 'tool_result') {
              return `[tool_result]`;
            }
            return '';
          }).join(' ');
        } else if (typeof content === 'string') {
          textContent = content;
        }
        
        return `[${role}]: ${textContent.substring(0, 500)}${textContent.length > 500 ? '...' : ''}`;
      }
      return null;
    }).filter(e => e !== null).join('\n');
    
    return formatted;
  }

  async readWorkflowRules() {
    try {
      // Load workflow rules from YAML file based on current mode
      const state = await this.loadState();
      if (!state) return 'No workflow state found';
      
      const mode = state.mode || 'dev';
      const workflowFile = path.join(
        os.homedir(),
        'PersonalAgents',
        'cli_tools',
        'workflow',
        'workflows',
        `${mode}-mode.yaml`
      );
      
      const yamlContent = await fs.readFile(workflowFile, 'utf8');
      const yaml = await import('js-yaml');
      const workflowData = yaml.default.load(yamlContent);
      
      // Extract rules from YAML
      let rules = [];
      if (workflowData.principles) {
        rules.push('### Core Principles');
        rules.push(...workflowData.principles);
        rules.push('');
      }
      
      if (workflowData.global_rules) {
        rules.push('### Global Rules');
        workflowData.global_rules.forEach(rule => {
          if (typeof rule === 'string') {
            rules.push(rule);
          } else if (rule.title && rule.content) {
            rules.push(`**${rule.title}**`);
            rules.push(rule.content);
          }
        });
        rules.push('');
      }
      
      if (workflowData.emergency_procedures) {
        rules.push('### Emergency Procedures');
        workflowData.emergency_procedures.forEach(procedure => {
          if (typeof procedure === 'string') {
            rules.push(procedure);
          } else if (procedure.title && procedure.commands) {
            rules.push(`**${procedure.title}**`);
            if (Array.isArray(procedure.commands)) {
              rules.push(procedure.commands.join('\n'));
            }
          }
        });
        rules.push('');
      }
      
      return rules.join('\n');
    } catch (error) {
      console.warn(`Could not read workflow rules: ${error.message}`);
      return 'No workflow rules found';
    }
  }

  async readTodoFile() {
    try {
      const state = await this.loadState();
      if (!state) return null;
      
      // Look for todo file in standard location
      const todoDir = path.join(os.homedir(), 'PersonalAgents', 'todos');
      const files = await fs.readdir(todoDir);
      const todoFile = files.find(f => f.includes(this.project) && f.endsWith('.md'));
      
      if (todoFile) {
        const content = await fs.readFile(path.join(todoDir, todoFile), 'utf8');
        return content;
      }
      
      return null;
    } catch (error) {
      console.warn(`Could not read todo file: ${error.message}`);
      return null;
    }
  }

  generateCompliancePrompt(terminalOutput, todoContent, workflowRules) {
    const prompt = {
      systemRole: "You are an AI workflow compliance monitor acting like a hands-off engineering manager. Only intervene when absolutely necessary - let the AI work autonomously unless there's a critical issue.",
      
      stuckDefinition: "An AI is considered STUCK when it exhibits any of these patterns over 20+ conversation turns:\n1. Repeating the same failed command or action 3+ times without trying alternatives\n2. Making no meaningful progress towards the goal stated in the TODO file\n3. Cycling through the same set of actions without advancing the task\n4. Spending 20+ turns on debugging/fixing errors without resolving them\n5. Unable to find files/functions that should exist based on the TODO requirements\n\nMeaningful progress means: completing subtasks, writing new code, passing tests, or getting closer to the stated goal.",
      
      interventionCriteria: "ONLY intervene if:\n1. The AI is stuck according to the above definition\n2. The AI is violating critical workflow rules that will cause problems\n3. The AI is about to do something destructive or dangerous\n\nDO NOT intervene for:\n- Minor inefficiencies\n- Style preferences\n- Alternative approaches (unless current approach is failing)\n- Progress that's slow but steady",
      
      generalInstructions: "Act like a good manager - trust the AI to do its job. Only speak up when intervention is truly needed. When you do intervene, be concise and specific. If the AI is making progress (even slowly), stay silent. If AI is stuck, suggest specific untried approaches or tools. IMPORTANT: If conversations are compacting, wait - do not intervene during compaction.",
      
      responseFormat: "Return empty string unless intervention is necessary. If intervening, return only a short, specific instruction. No explanations, no formatting.",
      
      workflowRules: workflowRules,
      currentTodo: todoContent || "No TODO file found",
      terminalOutput: terminalOutput
    };
    
    return JSON.stringify(prompt);
  }

  async callGeminiAPI(prompt) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not available');
    }

    const requestData = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        topP: 0.8
      }
    };

    const postData = JSON.stringify(requestData);
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            if (response.error) {
              reject(new Error(`Gemini API error: ${response.error.message}`));
              return;
            }
            if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
              resolve(response.candidates[0].content.parts[0].text);
            } else {
              reject(new Error('Unexpected Gemini API response structure'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse Gemini API response: ${error.message}`));
          }
        });
      });
      req.on('error', (error) => {
        reject(new Error(`Gemini API request failed: ${error.message}`));
      });
      req.write(postData);
      req.end();
    });
  }

  async saveGeminiInteraction(prompt, response) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `gemini-${this.project}-${timestamp}.json`;
      const filepath = path.join(this.geminiLogsDir, filename);
      
      const data = {
        timestamp: new Date().toISOString(),
        project: this.project,
        prompt: JSON.parse(prompt),
        response: response,
        promptLength: prompt.length,
        responseLength: response.length
      };
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to save Gemini interaction: ${error.message}`);
    }
  }

  sendGuidance(guidance) {
    if (!this.tmuxWindow || !guidance || guidance.trim() === '') return;
    
    try {
      // Send guidance to tmux window
      const message = `ai-monitor: ${guidance}`;
      const cmd = `tmux send-keys -t ${this.tmuxWindow} "${message}" Enter`;
      execSync(cmd);
    } catch (error) {
      console.error(`Failed to send guidance: ${error.message}`);
    }
  }

  sendReminder() {
    if (!this.tmuxWindow) return;

    const message = 'ai-monitor: run workflow-cli --remind-rules';
    
    try {
      // Send reminder to tmux window
      const cmd = `tmux send-keys -t ${this.tmuxWindow} "${message}" Enter`;
      execSync(cmd);
      console.log(`Sent reminder to window ${this.tmuxWindow}`);
    } catch (error) {
      console.error(`Failed to send reminder: ${error.message}`);
    }
  }

  async checkCompliance() {
    const now = Date.now();
    
    // Send periodic reminders
    if (now - this.lastRemindTime >= this.remindInterval) {
      this.sendReminder();
      this.lastRemindTime = now;
      await this.updateState({ lastRemind: new Date().toISOString() });
    }
    
    // Do Gemini-based compliance check every checkInterval
    if (now - this.lastCheckTime >= this.checkInterval && this.geminiApiKey) {
      this.lastCheckTime = now;
      
      try {
        // Read all necessary data
        const [claudeLogs, todoContent, workflowRules] = await Promise.all([
          this.readClaudeLogs(),
          this.readTodoFile(),
          this.readWorkflowRules()
        ]);
        
        if (claudeLogs && claudeLogs !== this.lastAnalyzedContent) {
          this.lastAnalyzedContent = claudeLogs;
          
          // Generate prompt and call Gemini
          const prompt = this.generateCompliancePrompt(claudeLogs, todoContent, workflowRules);
          
          const response = await this.callGeminiAPI(prompt);
          await this.saveGeminiInteraction(prompt, response);
          
          // Send guidance if Gemini provided any
          if (response && response.trim() !== '') {
            this.sendGuidance(response.trim());
            await this.updateState({ 
              lastGuidance: new Date().toISOString(),
              lastGuidanceText: response.trim()
            });
          }
        }
      } catch (error) {
        console.error(`Compliance check error: ${error.message}`);
      }
    }
  }

  async run() {
    console.log(`Monitor worker started for project: ${this.project}`);
    console.log(`Tmux window: ${this.tmuxWindow}`);
    console.log(`Gemini API: ${this.geminiApiKey ? '✅ Available' : '❌ Not configured'}`);
    
    // Load initial state
    const state = await this.loadState();
    if (state?.monitor?.remindInterval) {
      this.remindInterval = state.monitor.remindInterval;
    }
    if (state?.monitor?.checkInterval) {
      this.checkInterval = state.monitor.checkInterval;
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

        // Sleep for 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        console.error(`Monitor error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait longer on error
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