/**
 * AI Monitor Screen Monitor
 * Core functionality moved from scripts/ai-monitor/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('yaml');

class ScreenMonitor {
    constructor(options = {}) {
        this.screenSessionName = options.screenSessionName;
        // Use provided log path, or auto-generate from screen session
        if (options.screenLogPath) {
            this.screenLogPath = options.screenLogPath;
        } else if (this.screenSessionName) {
            this.screenLogPath = `/tmp/screen_output_${this.screenSessionName}.log`;
        } else {
            throw new Error('Either screenLogPath or screenSessionName must be provided');
        }
        this.lastPosition = 0;
        this.isRunning = false;
        this.intervalMs = options.intervalMs || 60000; // 1 minute default
        this.geminiApiKey = options.geminiApiKey || this.loadGeminiApiKey();
        this.projectName = options.projectName || 'unknown';
        this.workflowMode = options.workflowMode || 'dev';
        this.enableGuidance = options.enableGuidance !== false;
        this.lastRemindRulesTime = 0;
        this.remindRulesIntervalMs = 600000; // 10 minutes for remind-rules
        this.alertLevel = options.alertLevel || 'WARNING';
        this.onCheckResult = options.onCheckResult || null; // Callback for check results
        this.lastStatus = 'COMPLIANT'; // Track last status to detect state changes
        this.geminiLogsDir = options.geminiLogsDir || path.join(__dirname, '..', 'logs', 'gemini');
        this.ensureGeminiLogsDir();
    }

    /**
     * Get screen log path based on session name
     */
    getScreenLogPath() {
        if (!this.screenSessionName) {
            throw new Error('Screen session name is required');
        }
        return `/tmp/screen_output_${this.screenSessionName}.log`;
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
            const envPath = path.resolve(__dirname, '../../../config/.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
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
            return cleanContent.trim();

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
     * Send guidance instruction to screen session
     */
    async sendGuidanceToScreen(instruction) {
        if (!this.enableGuidance) {
            console.log(`Guidance disabled. Would send: ${instruction}`);
            return false;
        }
        
        if (!this.screenSessionName) {
            console.log(`No screen session specified. Would send: ${instruction}`);
            return false;
        }
        
        try {
            // Use proper Enter key (\015) for command execution
            // Send command and Enter key separately to avoid shell escaping issues
            const { spawn } = require('child_process');
            
            // First send the instruction
            const stuffCmd = spawn('screen', ['-S', this.screenSessionName, '-p', '0', '-X', 'stuff', instruction]);
            
            await new Promise((resolve, reject) => {
                stuffCmd.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Screen stuff command failed with code ${code}`));
                    } else {
                        resolve();
                    }
                });
                stuffCmd.on('error', reject);
            });
            
            // Then send the Enter key (carriage return)
            const enterKey = String.fromCharCode(13); // ASCII 13 = carriage return
            const enterCmd = spawn('screen', ['-S', this.screenSessionName, '-p', '0', '-X', 'stuff', enterKey]);
            
            await new Promise((resolve, reject) => {
                enterCmd.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Screen enter command failed with code ${code}`));
                    } else {
                        console.log(`✅ Sent guidance to screen session '${this.screenSessionName}': ${instruction}`);
                        resolve();
                    }
                });
                enterCmd.on('error', reject);
            });
            
            return true;
        } catch (error) {
            console.error(`Error sending guidance to screen: ${error.message}`);
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
        
        // Remove code block markers if present
        if (instruction.includes('```')) {
            const match = instruction.match(/```(?:yaml|json|text)?\s*\n?([\s\S]*?)\n?```/);
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
            // Determine workflow file path
            const workflowDir = path.resolve(__dirname, '../../workflow-cli/workflows');
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
            terminal: terminalOutput,
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
                    await this.sendGuidanceToScreen(prefixedGuidance);
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
     * Send --remind-rules command every 5 minutes
     */
    async checkAndSendRemindRules() {
        const now = Date.now();
        if (now - this.lastRemindRulesTime >= this.remindRulesIntervalMs) {
            this.lastRemindRulesTime = now;
            const remindCommand = `workflow-cli --remind-rules --project ${this.projectName} --mode ${this.workflowMode}`;
            
            if (this.enableGuidance && this.screenSessionName) {
                console.log('⏰ Sending 10-minute remind-rules command...');
                await this.sendGuidanceToScreen(remindCommand);
            } else {
                console.log(`⏰ Would send remind-rules command: ${remindCommand}`);
            }
        }
    }

    /**
     * Perform one check cycle
     */
    async check() {
        try {
            // Check for remind-rules every cycle (every minute check for 10-minute intervals)
            await this.checkAndSendRemindRules();
            
            // Read last 200 lines of terminal output
            const terminalOutput = this.readLast200Lines();
            if (terminalOutput) {
                // Get todo content
                const todoContent = this.readTodoList();
                
                // Process terminal content and todo list
                const result = await this.processTerminalContent(terminalOutput, todoContent);
                
                // Call the callback if provided
                if (result && this.onCheckResult) {
                    this.onCheckResult(result);
                }
                
                return result;
            } else {
                // Log why no terminal output was processed
                if (!fs.existsSync(this.screenLogPath)) {
                    console.log(`ℹ️  No screen log file found at: ${this.screenLogPath}`);
                } else {
                    console.log(`ℹ️  No recent terminal output to process (file may be stale or empty)`);
                }
            }
            return null;
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