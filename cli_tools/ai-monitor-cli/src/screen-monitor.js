/**
 * AI Monitor - Tmux + Claude Code Logs
 * Monitors Claude Code JSONL logs and sends guidance via tmux
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('yaml');

class ScreenMonitor {
    constructor(options = {}) {
        this.tmuxSessionName = options.tmuxSessionName || options.session;
        if (!this.tmuxSessionName) {
            throw new Error('Tmux session name is required (--session)');
        }
        
        this.lastClaudeLogTimestamp = null; // Track last processed Claude log entry
        this.isRunning = false;
        this.intervalMs = options.intervalMs || 60000; // 1 minute default
        this.geminiApiKey = options.geminiApiKey || this.loadGeminiApiKey();
        this.projectName = options.projectName || 'unknown';
        this.workflowMode = options.workflowMode || 'dev';
        this.enableGuidance = options.enableGuidance !== false;
        // Initialize to current time to prevent immediate remind-rules on startup
        this.lastRemindRulesTime = Date.now();
        this.remindRulesIntervalMs = options.remindRulesIntervalMs || 600000; // 10 minutes default for remind-rules
        this.alertLevel = options.alertLevel || 'WARNING';
        this.onCheckResult = options.onCheckResult || null; // Callback for check results
        this.lastStatus = 'COMPLIANT'; // Track last status to detect state changes
        
        // Use symlink from home directory for portability
        const MAIN_REPO_PATH = path.join(process.env.HOME, 'PersonalAgents');
        
        // Always use absolute path for gemini logs directory
        if (options.geminiLogsDir) {
            this.geminiLogsDir = path.resolve(options.geminiLogsDir);
        } else {
            // Use hardcoded path to ensure consistency across worktrees
            this.geminiLogsDir = path.join(MAIN_REPO_PATH, 'cli_tools', 'ai-monitor-cli', 'logs', 'gemini');
        }
        this.ensureGeminiLogsDir();
    }

    /**
     * Find the actual log file - first try terminal logs, then screen logs
     * Terminal logs: ~/.terminal-logs/latest-{session-name}.log
     * Screen logs: ~/.screen-logs/screenlog-{date}-{session-name}-{window}.log
     */
    findScreenLogFile(sessionName) {
        // First, try to find terminal output log (preferred)
        const terminalLog = this.findTerminalLogFile(sessionName);
        if (terminalLog) {
            return terminalLog;
        }
        
        // Fallback to screen logs
        const screenLogsDir = path.join(process.env.HOME, '.screen-logs');
        
        if (!fs.existsSync(screenLogsDir)) {
            return null;
        }
        
        try {
            // Extract just the session name part (after the PID)
            // e.g., "57001.PersonalAgents-5951" -> "PersonalAgents-5951"
            const sessionParts = sessionName.split('.');
            const nameOnly = sessionParts.length > 1 ? sessionParts.slice(1).join('.') : sessionName;
            
            // Get today's date in YYYYMMDD format
            const today = new Date();
            const dateStr = today.getFullYear() + 
                           String(today.getMonth() + 1).padStart(2, '0') + 
                           String(today.getDate()).padStart(2, '0');
            
            // Look for files matching the pattern
            const files = fs.readdirSync(screenLogsDir);
            
            // Screen log pattern: screenlog-YYYYMMDD-{window-title}-{window-num}.log
            // Try to find exact match first
            const exactMatch = `screenlog-${dateStr}-${nameOnly}-0.log`;
            if (files.includes(exactMatch)) {
                const fullPath = path.join(screenLogsDir, exactMatch);
                console.log(`Found screen log: ${fullPath}`);
                return fullPath;
            }
            
            // If no exact match, look for partial matches with the session name
            const candidates = files.filter(f => 
                f.startsWith('screenlog-') && 
                f.includes(nameOnly) && 
                f.endsWith('.log')
            );
            
            if (candidates.length > 0) {
                // Sort by modification time and pick the most recent
                const sorted = candidates
                    .map(f => ({
                        name: f,
                        path: path.join(screenLogsDir, f),
                        mtime: fs.statSync(path.join(screenLogsDir, f)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                console.log(`Found screen log: ${sorted[0].path}`);
                return sorted[0].path;
            }
            
            return null;
        } catch (error) {
            console.error('Error finding screen log file:', error.message);
            return null;
        }
    }

    /**
     * Find terminal output log file
     * Terminal logs: ~/.terminal-logs/latest-{session-name}.log (symlink)
     * or ~/.terminal-logs/terminal-{session-name}-{timestamp}.log
     */
    findTerminalLogFile(sessionName) {
        const terminalLogsDir = path.join(process.env.HOME, '.terminal-logs');
        
        if (!fs.existsSync(terminalLogsDir)) {
            return null;
        }
        
        try {
            // Extract session name
            const sessionParts = sessionName.split('.');
            const nameOnly = sessionParts.length > 1 ? sessionParts.slice(1).join('.') : sessionName;
            
            // First try the symlink to latest log
            const latestLink = path.join(terminalLogsDir, `latest-${nameOnly}.log`);
            if (fs.existsSync(latestLink)) {
                console.log(`Found terminal log (symlink): ${latestLink}`);
                return latestLink;
            }
            
            // Otherwise look for most recent terminal log file
            const files = fs.readdirSync(terminalLogsDir);
            const candidates = files.filter(f => 
                f.startsWith('terminal-') && 
                f.includes(nameOnly) && 
                f.endsWith('.log')
            );
            
            if (candidates.length > 0) {
                // Sort by modification time and pick the most recent
                const sorted = candidates
                    .map(f => ({
                        name: f,
                        path: path.join(terminalLogsDir, f),
                        mtime: fs.statSync(path.join(terminalLogsDir, f)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                console.log(`Found terminal log: ${sorted[0].path}`);
                return sorted[0].path;
            }
            
            return null;
        } catch (error) {
            console.error('Error finding terminal log file:', error.message);
            return null;
        }
    }

    /**
     * Get screen log path based on session name
     */
    getScreenLogPath() {
        if (!this.screenSessionName) {
            throw new Error('Screen session name is required');
        }
        return this.screenLogPath;
    }
    
    /**
     * Ensure Gemini logs directory exists
     */
    ensureGeminiLogsDir() {
        try {
            if (!fs.existsSync(this.geminiLogsDir)) {
                fs.mkdirSync(this.geminiLogsDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create Gemini logs directory:', error.message);
        }
    }

    /**
     * Save Gemini prompt and response to file
     */
    saveGeminiInteraction(prompt, response) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `gemini-${this.projectName}-${timestamp}.json`;
            const filepath = path.join(this.geminiLogsDir, filename);
            
            // Parse the prompt JSON to make it readable in the log
            let parsedPrompt;
            try {
                parsedPrompt = JSON.parse(prompt);
                // Convert string fields to arrays for better readability in logs
                if (parsedPrompt.terminal && typeof parsedPrompt.terminal === 'string') {
                    parsedPrompt.terminal = parsedPrompt.terminal.split('\n');
                }
                if (parsedPrompt.rules && typeof parsedPrompt.rules === 'string') {
                    parsedPrompt.rules = parsedPrompt.rules.split('\n');
                }
            } catch (e) {
                parsedPrompt = prompt; // Keep as string if not valid JSON
            }
            
            const data = {
                timestamp: new Date().toISOString(),
                project: this.projectName,
                mode: this.workflowMode,
                prompt: parsedPrompt, // Store as parsed object instead of escaped string
                response: response,
                promptLength: prompt.length,
                responseLength: response.length
            };
            
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
            console.log(`💾 Saved Gemini interaction to: ${filename}`);
        } catch (error) {
            console.error('Failed to save Gemini interaction:', error.message);
        }
    }

    /**
     * Load Gemini API key from environment or config file
     */
    loadGeminiApiKey() {
        // First try environment variable
        if (process.env.GEMINI_API_KEY) {
            return process.env.GEMINI_API_KEY;
        }
        
        // Try to load from config/.env file
        try {
            // Use symlink from home directory for portability
            const MAIN_REPO_PATH = path.join(process.env.HOME, 'PersonalAgents');
            const mainConfigPath = path.join(MAIN_REPO_PATH, 'config', '.env');
            
            if (fs.existsSync(mainConfigPath)) {
                const envContent = fs.readFileSync(mainConfigPath, 'utf8');
                const match = envContent.match(/GEMINI_API_KEY=(.+)/);
                if (match) {
                    return match[1].trim().replace(/['"]/g, '');
                }
            }
            
            // Also try current working directory (for worktrees)
            const cwdEnvPath = path.resolve(process.cwd(), '.env');
            if (fs.existsSync(cwdEnvPath)) {
                const envContent = fs.readFileSync(cwdEnvPath, 'utf8');
                const match = envContent.match(/GEMINI_API_KEY=(.+)/);
                if (match) {
                    return match[1].trim().replace(/['"]/g, '');
                }
            }
        } catch (error) {
            console.warn('Could not load Gemini API key from config file:', error.message);
        }
        
        return null;
    }

    /**
     * Read last 200 lines from screen log file
     */
    readLast200Lines() {
        try {
            if (!fs.existsSync(this.screenLogPath)) {
                console.log(`⚠️  Log file not found: ${this.screenLogPath}`);
                console.log(`   Looking for terminal logs in: ${path.join(process.env.HOME, '.terminal-logs/')}`);
                console.log(`   Looking for screen logs in: ${path.join(process.env.HOME, '.screen-logs/')}`);
                return null;
            }

            // Check if log file is stale (older than 5 minutes)
            const stats = fs.statSync(this.screenLogPath);
            const fileAge = Date.now() - stats.mtime.getTime();
            const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
            
            if (fileAge > maxAge) {
                console.log(`⚠️  Screen log file is stale (${Math.round(fileAge / 60000)} minutes old), skipping processing`);
                return null;
            }

            const content = fs.readFileSync(this.screenLogPath, 'utf8');
            const lines = content.split('\n');
            
            // Get last 200 lines
            const last200Lines = lines.slice(-200).join('\n');
            
            if (last200Lines.trim().length === 0) {
                return null;
            }
            
            // Clean terminal escape sequences
            const cleanContent = this.cleanTerminalOutput(last200Lines);
            
            // Add timestamp header to show when this content was processed
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const timestampedContent = `[AI Monitor processed at ${timestamp}]\n${cleanContent.trim()}`;
            
            return timestampedContent;

        } catch (error) {
            console.error('Error reading screen log:', error.message);
            return null;
        }
    }

    /**
     * Clean terminal output of escape sequences and control characters
     */
    cleanTerminalOutput(content) {
        // Remove all ANSI escape sequences (comprehensive pattern)
        content = content.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        content = content.replace(/\x1b\([0-9;]*[a-zA-Z]/g, '');
        content = content.replace(/\x1b\][0-9;]*[a-zA-Z]/g, '');
        content = content.replace(/\x1b\[[0-9]*[ABCD]/g, '');
        content = content.replace(/\x1b\[[0-9]*[EFGH]/g, '');
        content = content.replace(/\x1b\[[0-9]*[JK]/g, '');
        content = content.replace(/\r(?!\n)/g, '');
        content = content.replace(/\x07/g, '');
        content = content.replace(/\x08+/g, '');
        content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        content = content.replace(/\r\n/g, '\n');
        content = content.replace(/\n{3,}/g, '\n\n');
        return content;
    }

    /**
     * Find Claude Code log directory for current working directory
     */
    findClaudeLogDir() {
        const claudeProjectsDir = path.join(process.env.HOME, '.claude', 'projects');
        
        // Get current working directory and encode it for Claude's format
        const cwd = process.cwd();
        const encodedPath = cwd.replace(/\//g, '-');
        
        const projectLogDir = path.join(claudeProjectsDir, encodedPath);
        
        if (fs.existsSync(projectLogDir)) {
            return projectLogDir;
        }
        
        // Try without leading slash encoding
        const altEncodedPath = cwd.substring(1).replace(/\//g, '-');
        const altProjectLogDir = path.join(claudeProjectsDir, altEncodedPath);
        
        if (fs.existsSync(altProjectLogDir)) {
            return altProjectLogDir;
        }
        
        return null;
    }

    /**
     * Read recent Claude Code JSONL logs
     */
    readClaudeLogs() {
        try {
            const logDir = this.findClaudeLogDir();
            if (!logDir) {
                console.log('⚠️  Claude Code log directory not found for current project');
                return null;
            }

            // Get all JSONL files in the directory
            const files = fs.readdirSync(logDir)
                .filter(f => f.endsWith('.jsonl'))
                .map(f => ({
                    name: f,
                    path: path.join(logDir, f),
                    mtime: fs.statSync(path.join(logDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length === 0) {
                console.log('⚠️  No Claude Code log files found');
                return null;
            }

            // Read the most recent log file
            const recentLog = files[0];
            const content = fs.readFileSync(recentLog.path, 'utf8');
            const lines = content.trim().split('\n');

            // Parse JSONL and extract recent conversation
            const entries = [];
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    entries.push(entry);
                } catch (e) {
                    // Skip malformed lines
                }
            }

            // Get last 20 entries or entries since last check
            let recentEntries = entries.slice(-20);
            
            if (this.lastClaudeLogTimestamp) {
                const lastIndex = entries.findIndex(e => 
                    e.timestamp && new Date(e.timestamp) > new Date(this.lastClaudeLogTimestamp)
                );
                if (lastIndex >= 0) {
                    recentEntries = entries.slice(lastIndex);
                }
            }

            if (recentEntries.length === 0) {
                return null;
            }

            // Update last timestamp
            const lastEntry = recentEntries[recentEntries.length - 1];
            if (lastEntry.timestamp) {
                this.lastClaudeLogTimestamp = lastEntry.timestamp;
            }

            // Format entries for AI monitor
            const formattedContent = this.formatClaudeLogsForMonitor(recentEntries);
            
            // Add timestamp header
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            return `[AI Monitor processed Claude logs at ${timestamp}]\n${formattedContent}`;

        } catch (error) {
            console.error('Error reading Claude logs:', error.message);
            return null;
        }
    }

    /**
     * Format Claude Code log entries for AI monitor
     */
    formatClaudeLogsForMonitor(entries) {
        const lines = [];
        
        for (const entry of entries) {
            if (entry.type === 'user') {
                lines.push(`\n> ${entry.message || entry.content}`);
            } else if (entry.type === 'assistant') {
                const content = entry.message || entry.content || '';
                // Truncate very long responses
                const truncated = content.length > 500 ? 
                    content.substring(0, 500) + '... [truncated]' : 
                    content;
                lines.push(`Assistant: ${truncated}`);
            } else if (entry.type === 'tool_use') {
                lines.push(`[Tool: ${entry.tool_name}]`);
            } else if (entry.type === 'tool_result') {
                // Show brief tool results
                const result = JSON.stringify(entry.result || {}).substring(0, 100);
                lines.push(`[Result: ${result}...]`);
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Call Gemini 2.5 Pro API to analyze screen content
     */
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
            path: `/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=${this.geminiApiKey}`,
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
                        if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0]) {
                            const text = response.candidates[0].content.parts[0].text;
                            resolve(text);
                        } else {
                            // Log the actual response structure for debugging
                            console.error('Gemini API response structure:', JSON.stringify(response, null, 2));
                            reject(new Error(`Unexpected Gemini API response structure. Response: ${JSON.stringify(response)}`));
                        }
                    } catch (error) {
                        console.error('Raw response data:', responseData);
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

    /**
     * Send guidance instruction to tmux session
     */
    async sendGuidanceToTmux(instruction) {
        if (!this.enableGuidance) {
            console.log(`Guidance disabled. Would send: ${instruction}`);
            return false;
        }
        
        try {
            const { spawn } = require('child_process');
            
            // Use tmux send-keys
            const sendCmd = spawn('tmux', ['send-keys', '-t', this.tmuxSessionName, instruction]);
            
            await new Promise((resolve, reject) => {
                sendCmd.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Tmux send-keys command failed with code ${code}`));
                    } else {
                        resolve();
                    }
                });
                sendCmd.on('error', reject);
            });
            
            // Send Enter key
            const enterCmd = spawn('tmux', ['send-keys', '-t', this.tmuxSessionName, 'Enter']);
            
            await new Promise((resolve, reject) => {
                enterCmd.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Tmux enter command failed with code ${code}`));
                    } else {
                        console.log(`✅ Sent guidance to tmux session '${this.tmuxSessionName}': ${instruction}`);
                        resolve();
                    }
                });
                enterCmd.on('error', reject);
            });
            
            return true;
        } catch (error) {
            console.error(`Error sending guidance to tmux: ${error.message}`);
            return false;
        }
    }

    /**
     * Extract guidance instruction from Gemini analysis
     */
    extractGuidanceInstruction(geminiAnalysis) {
        if (!geminiAnalysis) return null;
        
        // Clean the response - remove any formatting
        let instruction = geminiAnalysis.trim();
        
        // Check if response is JSON with a "response" field
        try {
            // First try to extract from code block
            if (instruction.includes('```json')) {
                const match = instruction.match(/```json\s*\n?([\s\S]*?)\n?```/);
                if (match) {
                    const jsonStr = match[1].trim();
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.response !== undefined) {
                        instruction = parsed.response;
                    }
                }
            } else {
                // Try parsing as direct JSON
                const parsed = JSON.parse(instruction);
                if (parsed.response !== undefined) {
                    instruction = parsed.response;
                }
            }
        } catch (e) {
            // Not JSON, continue with string processing
        }
        
        // Remove code block markers if present
        if (instruction.includes('```') && !instruction.includes('```json')) {
            const match = instruction.match(/```(?:yaml|text)?\s*\n?([\s\S]*?)\n?```/);
            if (match) {
                instruction = match[1].trim();
            }
        }
        
        // Remove quotes if the entire response is quoted
        if ((instruction.startsWith('"') && instruction.endsWith('"')) ||
            (instruction.startsWith("'") && instruction.endsWith("'"))) {
            instruction = instruction.slice(1, -1).trim();
        }
        
        // If empty string or just whitespace, return null (don't send anything)
        if (instruction.length === 0) {
            return null;
        }
        
        // If it's a reasonable length instruction, return it
        if (instruction.length > 0 && instruction.length < 2000) {
            return instruction;
        }
        
        return null;
    }

    /**
     * Read todo list file if it exists
     */
    readTodoList() {
        try {
            // Look for todo list in common locations
            const possiblePaths = [
                path.join(process.cwd(), 'TODO.md'),
                path.join(process.cwd(), 'todo.md'),
                path.join(process.cwd(), 'todos.md'),
                path.join(process.cwd(), 'TODOS.md')
            ];
            
            for (const todoPath of possiblePaths) {
                if (fs.existsSync(todoPath)) {
                    return fs.readFileSync(todoPath, 'utf8');
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Read workflow rules file
     */
    readWorkflowRules() {
        try {
            // Use symlink from home directory for portability
            const MAIN_REPO_PATH = path.join(process.env.HOME, 'PersonalAgents');
            const workflowDir = path.join(MAIN_REPO_PATH, 'cli_tools', 'workflow-cli', 'workflows');
            const workflowFile = this.workflowMode === 'task' 
                ? path.join(workflowDir, 'task-mode.yaml')
                : path.join(workflowDir, 'dev-mode.yaml');
            
            if (fs.existsSync(workflowFile)) {
                return fs.readFileSync(workflowFile, 'utf8');
            }
            
            return null;
        } catch (error) {
            console.error('Error reading workflow rules:', error.message);
            return null;
        }
    }
    
    /**
     * Generate workflow compliance analysis prompt
     */
    generateCompliancePrompt(terminalOutput, todoContent = null) {
        const workflowRules = this.readWorkflowRules();
        
        const promptData = {
            instruction: "Check if AI is correctly following workflow rules. Rule violations must be strictly enforced. Only if AI seems extremely stuck (repeating same failed actions multiple times), suggest untried approaches, especially tools at our disposal that can give more insight (like screenshot-cli, record-cli etc). AI only knows global rules, not the full workflow steps. If it needs to jump to a specific workflow step, tell it explicitly which workflow command to run.",
            rules: workflowRules || 'ERROR: Could not load workflow rules file',
            terminal: terminalOutput.split('\n'), // Store as array for better readability
            todo: todoContent || "No TODO file found",
            responseFormat: "Return only a short instruction text or empty string. No explanations, no formatting, just the instruction."
        };
        
        return JSON.stringify(promptData, null, 2);
    }

    /**
     * Process terminal content
     */
    async processTerminalContent(terminalOutput, todoContent = null) {
        if (!terminalOutput || terminalOutput.length === 0) {
            return null;
        }

        const timestamp = new Date().toISOString();
        
        try {
            let geminiAnalysis = null;
            if (this.geminiApiKey) {
                const prompt = this.generateCompliancePrompt(terminalOutput, todoContent);
                geminiAnalysis = await this.callGeminiAPI(prompt);
                
                // Save the interaction to file
                this.saveGeminiInteraction(prompt, geminiAnalysis);
            }

            const logEntry = {
                timestamp,
                project: this.projectName,
                mode: this.workflowMode,
                terminalOutputLength: terminalOutput.length,
                hasTodoList: !!todoContent,
                preview: terminalOutput.substring(0, 200),
                geminiAnalysis: geminiAnalysis
            };

            // Extract and send guidance if available
            if (geminiAnalysis) {
                const guidanceInstruction = this.extractGuidanceInstruction(geminiAnalysis);
                if (guidanceInstruction) {
                    // Prefix with ai-monitor:
                    const prefixedGuidance = `ai-monitor: ${guidanceInstruction}`;
                    await this.sendGuidanceToTmux(prefixedGuidance);
                    logEntry.guidanceSent = prefixedGuidance;
                }
            }
            
            return logEntry;

        } catch (error) {
            console.error('Error processing terminal content:', error.message);
            return {
                timestamp,
                project: this.projectName,
                mode: this.workflowMode,
                terminalOutputLength: terminalOutput.length,
                hasTodoList: !!todoContent,
                preview: terminalOutput.substring(0, 200),
                error: error.message
            };
        }
    }

    /**
     * Send --remind-rules command every 10 minutes (configurable)
     */
    async checkAndSendRemindRules() {
        const now = Date.now();
        if (now - this.lastRemindRulesTime >= this.remindRulesIntervalMs) {
            this.lastRemindRulesTime = now;
            const remindCommand = `workflow-cli --remind-rules --project ${this.projectName} --mode ${this.workflowMode}`;
            
            if (this.enableGuidance && this.tmuxSessionName) {
                console.log('⏰ Sending 10-minute remind-rules command...');
                // Add ai-monitor: prefix to remind-rules command
                await this.sendGuidanceToTmux(`ai-monitor: ${remindCommand}`);
                return true;
            } else {
                console.log(`⏰ Would send remind-rules command: ${remindCommand}`);
                // Still return true to indicate the timer triggered
                return true;
            }
        }
        return false;
    }

    /**
     * Perform one check cycle
     */
    async check() {
        try {
            // Check for remind-rules every cycle (every minute check for 10-minute intervals)
            await this.checkAndSendRemindRules();
            
            // Read from Claude Code JSONL logs
            const terminalOutput = this.readClaudeLogs();
            if (!terminalOutput) {
                console.log('ℹ️  No recent Claude Code logs to process');
                return null;
            }
            
            // Get todo content
            const todoContent = this.readTodoList();
            
            // Process terminal content and todo list
            const result = await this.processTerminalContent(terminalOutput, todoContent);
            
            // Call the callback if provided
            if (result && this.onCheckResult) {
                this.onCheckResult(result);
            }
            
            return result;
        } catch (error) {
            console.error('Error during check cycle:', error.message);
            return null;
        }
    }

    /**
     * Start monitoring the screen log file
     */
    start() {
        if (this.isRunning) {
            return false;
        }

        this.isRunning = true;
        this.intervalId = setInterval(async () => {
            await this.check();
        }, this.intervalMs);

        return true;
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            return false;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        return true;
    }
}

module.exports = { ScreenMonitor };