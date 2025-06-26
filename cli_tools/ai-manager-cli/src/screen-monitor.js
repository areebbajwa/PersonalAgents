/**
 * AI Manager Screen Monitor
 * Core functionality moved from scripts/ai-manager/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('yaml');

class ScreenMonitor {
    constructor(options = {}) {
        this.screenLogPath = options.screenLogPath || '/tmp/screen_output.log';
        this.lastPosition = 0;
        this.isRunning = false;
        this.intervalMs = options.intervalMs || 60000; // 1 minute default
        this.geminiApiKey = options.geminiApiKey || this.loadGeminiApiKey();
        this.projectName = options.projectName || 'unknown';
        this.workflowMode = options.workflowMode || 'dev';
        this.enableGuidance = options.enableGuidance !== false;
        this.screenSessionName = options.screenSessionName;
        this.lastRemindRulesTime = 0;
        this.remindRulesIntervalMs = 300000; // 5 minutes for remind-rules
        this.alertLevel = options.alertLevel || 'WARNING';
        this.onCheckResult = options.onCheckResult || null; // Callback for check results
        this.contentBuffer = ''; // Buffer to store recent content for context
        this.maxBufferLines = 100; // Keep last 100 lines for context
        this.lastStatus = 'COMPLIANT'; // Track last status to detect state changes
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
     * Update content buffer with new content
     */
    updateContentBuffer(newContent) {
        if (!newContent) return;
        
        // Add new content to buffer
        this.contentBuffer += '\n' + newContent;
        
        // Keep only the last N lines
        const lines = this.contentBuffer.split('\n');
        if (lines.length > this.maxBufferLines) {
            this.contentBuffer = lines.slice(-this.maxBufferLines).join('\n');
        }
    }
    
    /**
     * Read new content from screen log file since last check
     */
    readNewContent() {
        try {
            if (!fs.existsSync(this.screenLogPath)) {
                return null;
            }

            const stats = fs.statSync(this.screenLogPath);
            const currentSize = stats.size;

            if (currentSize < this.lastPosition) {
                this.lastPosition = 0;
            }

            if (currentSize === this.lastPosition) {
                return null;
            }

            const buffer = Buffer.alloc(currentSize - this.lastPosition);
            const fd = fs.openSync(this.screenLogPath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
            fs.closeSync(fd);

            this.lastPosition = currentSize;
            let content = buffer.toString('utf8');
            content = this.cleanTerminalOutput(content);
            return content.trim();

        } catch (error) {
            console.error('Error reading screen log file:', error.message);
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
                maxOutputTokens: 1000,
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
                        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
                            const text = response.candidates[0].content.parts[0].text;
                            resolve(text);
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
        
        try {
            // Remove code block markers if present
            let cleanResponse = geminiAnalysis;
            if (cleanResponse.includes('```')) {
                // Extract content between code blocks
                const match = cleanResponse.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/);
                if (match) {
                    cleanResponse = match[1];
                }
            }
            
            // Parse YAML response
            const parsed = yaml.parse(cleanResponse);
            
            // Extract action field
            if (parsed && parsed.action) {
                // Check if it's null or "null" string
                if (parsed.action === null || 
                    parsed.action === 'null' || 
                    parsed.action.toLowerCase() === 'none') {
                    return null;
                }
                
                // Return the action if it's valid
                const action = String(parsed.action).trim();
                if (action.length > 5 && action.length < 500) {
                    return action;
                }
            }
        } catch (error) {
            // If YAML parsing fails, log error and return null
            console.error('Failed to parse Gemini YAML response:', error.message);
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
    generateCompliancePrompt(newContent, contextContent, todoContent = null) {
        const workflowRules = this.readWorkflowRules();
        
        let prompt = `You are an AI manager monitoring workflow compliance. The AI assistant must follow ALL rules in the workflow file STRICTLY.

<metadata>
WORKFLOW MODE: ${this.workflowMode}
PROJECT: ${this.projectName}
</metadata>

<workflow_rules>
${workflowRules || 'ERROR: Could not load workflow rules file'}
</workflow_rules>

<new_screen_output>
${newContent}
</new_screen_output>

<previous_context>
${contextContent || 'No previous output'}
</previous_context>`;

        if (todoContent) {
            prompt += `\n\n<todo_list>\n${todoContent}\n</todo_list>`;
        }
        
        prompt += `\n\n<instructions>
ANALYSIS REQUIRED:
Check if the AI is following ALL rules mentioned in the workflow file above. 

CRITICAL: First determine if the AI is in one of these states:
1. WAITING FOR USER - The AI has asked the user a question and is waiting for a response
2. WORKFLOW COMPLETE - The workflow has finished (e.g., after cleanup step or merge decision)
3. ACTIVE WORK - The AI is actively working on tasks

Pay special attention to:
- Questions directed at the user (e.g., "Should I merge this branch?")
- Workflow completion indicators (e.g., "Workflow Complete", "--clean" executed)
- Global rules that apply at all times
- Step-specific rules if you can identify the current step
- Any violations of the workflow process
- Signs of the AI getting stuck, confused, or going off-track

Respond ONLY with this YAML structure (no other text):

status: COMPLIANT or WARNING or VIOLATION or WAITING_FOR_USER or WORKFLOW_COMPLETE
issues: Brief description of problems found or current state
action: Text instruction to guide the AI (or null if none needed)

IMPORTANT: If status is WAITING_FOR_USER or WORKFLOW_COMPLETE, the action MUST be null (no automated messages should be sent).

Example responses:

status: VIOLATION
issues: Committed with failing tests. Todo not updated.
action: VIOLATION DETECTED! You committed with failing tests. Please run 'git reset --soft HEAD~1' to undo the commit, then fix the failing tests by running 'npm test' to see the errors.

status: WAITING_FOR_USER
issues: AI asked user whether to merge branch into main
action: null

status: WORKFLOW_COMPLETE
issues: Workflow cleanup completed successfully
action: null

status: COMPLIANT
issues: Following workflow correctly, implementing features
action: null
</instructions>`;
        
        return prompt;
    }

    /**
     * Process new screen content
     */
    async processNewContent(newContent, contextContent, todoContent = null) {
        if (!newContent || newContent.length === 0) {
            return null;
        }

        const timestamp = new Date().toISOString();
        
        try {
            let geminiAnalysis = null;
            if (this.geminiApiKey) {
                const prompt = this.generateCompliancePrompt(newContent, contextContent, todoContent);
                geminiAnalysis = await this.callGeminiAPI(prompt);
            }

            const logEntry = {
                timestamp,
                project: this.projectName,
                mode: this.workflowMode,
                newContentLength: newContent.length,
                contextLength: contextContent ? contextContent.length : 0,
                hasTodoList: !!todoContent,
                preview: newContent.substring(0, 200),
                geminiAnalysis: geminiAnalysis
            };

            // Parse status from Gemini response
            if (geminiAnalysis) {
                try {
                    let cleanResponse = geminiAnalysis;
                    if (cleanResponse.includes('```')) {
                        const match = cleanResponse.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/);
                        if (match) {
                            cleanResponse = match[1];
                        }
                    }
                    const parsed = yaml.parse(cleanResponse);
                    if (parsed && parsed.status) {
                        this.lastStatus = parsed.status;
                        logEntry.status = parsed.status;
                    }
                } catch (error) {
                    // Ignore parsing errors for status tracking
                }
                
                // Only send guidance if not waiting for user or workflow complete
                const guidanceInstruction = this.extractGuidanceInstruction(geminiAnalysis);
                if (guidanceInstruction) {
                    await this.sendGuidanceToScreen(guidanceInstruction);
                    logEntry.guidanceSent = guidanceInstruction;
                }
            }
            
            return logEntry;

        } catch (error) {
            console.error('Error processing screen content:', error.message);
            return {
                timestamp,
                project: this.projectName,
                mode: this.workflowMode,
                newContentLength: newContent.length,
                contextLength: contextContent ? contextContent.length : 0,
                hasTodoList: !!todoContent,
                preview: newContent.substring(0, 200),
                error: error.message
            };
        }
    }

    /**
     * Send --remind-rules command every 5 minutes
     */
    async checkAndSendRemindRules() {
        // Don't send remind-rules if waiting for user or workflow complete
        if (this.lastStatus === 'WAITING_FOR_USER' || this.lastStatus === 'WORKFLOW_COMPLETE') {
            return;
        }
        
        const now = Date.now();
        if (now - this.lastRemindRulesTime >= this.remindRulesIntervalMs) {
            this.lastRemindRulesTime = now;
            const remindCommand = `workflow-cli --remind-rules --project ${this.projectName} --mode ${this.workflowMode}`;
            
            if (this.enableGuidance && this.screenSessionName) {
                console.log('⏰ Sending 5-minute remind-rules command...');
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
            // Check for remind-rules every cycle (every minute check for 5-minute intervals)
            await this.checkAndSendRemindRules();
            
            // Check for new screen content
            const newContent = this.readNewContent();
            if (newContent) {
                // Update the content buffer
                this.updateContentBuffer(newContent);
                
                // Get todo content
                const todoContent = this.readTodoList();
                
                // Process with new content, buffer for context, and todo list
                const result = await this.processNewContent(newContent, this.contentBuffer, todoContent);
                
                // Call the callback if provided
                if (result && this.onCheckResult) {
                    this.onCheckResult(result);
                }
                
                return result;
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