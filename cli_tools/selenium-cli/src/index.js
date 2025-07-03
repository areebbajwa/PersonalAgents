#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as browserManager from './browser-manager.js';
import * as screenshotManager from './screenshot-manager.js';
import * as persistentSession from './persistent-session.js';
import * as defaultSession from './default-session.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize screenshot manager
await screenshotManager.ensureScreenshotDir();
// Don't start periodic cleanup - it keeps the process alive
// Cleanup will happen when commands are run

// Clean up handlers removed - let process exit naturally

// Helper function to exit process after command completion
function exitAfterCommand() {
    // Small delay to ensure all output is flushed
    setTimeout(() => process.exit(0), 100);
}

// Helper function to display action results
function displayActionResult(result, options = {}) {
    if (result.screenshot) {
        console.log(`Screenshot: ${result.screenshot}`);
    }
    if (result.html) {
        console.log(`HTML: ${result.html}`);
    }
    if (result.htmlDiff) {
        const diff = result.htmlDiff;
        
        // Show text changes
        if (diff.textAdded > 0 || diff.textRemoved > 0) {
            console.log(chalk.cyan('HTML Diff:'));
            if (diff.textAdded > 0) {
                console.log(chalk.green(`  + ${diff.textAdded} chars added`));
            }
            if (diff.textRemoved > 0) {
                console.log(chalk.red(`  - ${diff.textRemoved} chars removed`));
            }
            
            // Show specific changes
            if (diff.changedSections && diff.changedSections.length > 0) {
                console.log(chalk.cyan('  Changed content:'));
                diff.changedSections.forEach(change => {
                    if (change.startsWith('+')) {
                        console.log(chalk.green(`    ${change}`));
                    } else {
                        console.log(chalk.red(`    ${change}`));
                    }
                });
                if (diff.totalChanges > diff.changedSections.length) {
                    console.log(chalk.gray(`    ... and ${diff.totalChanges - diff.changedSections.length} more changes`));
                }
            }
        } else {
            console.log(chalk.gray('HTML Diff: No changes detected'));
        }
    }
    
    // Show interactive elements if requested
    if (options.showElements && result.elements) {
        console.log(chalk.cyan(`\nInteractive Elements: ${result.elements.count} found`));
        if (result.elements.items && result.elements.items.length > 0) {
            const maxToShow = options.maxElements || 10;
            const elementsToShow = result.elements.items.slice(0, maxToShow);
            
            elementsToShow.forEach((el, index) => {
                const label = el.text || el.ariaLabel || el.placeholder || el.id || el.name || '(no label)';
                const truncatedLabel = label.length > 50 ? label.substring(0, 47) + '...' : label;
                console.log(chalk.gray(`  ${index + 1}. ${el.tag}${el.id ? '#' + el.id : ''} - "${truncatedLabel}" [${el.cssSelector}]`));
            });
            
            if (result.elements.count > maxToShow) {
                console.log(chalk.gray(`  ... and ${result.elements.count - maxToShow} more elements`));
            }
        }
    }
}

// Main program setup
program
    .name('selenium-cli')
    .description('Command-line tool for browser automation with MCP-compatible commands')
    .version('1.0.0')
    .addHelpText('after', `
Examples:
  # Basic browser automation
  $ selenium-cli navigate https://example.com
  $ selenium-cli screenshot
  $ selenium-cli close

  # Element interaction
  $ selenium-cli click "css=.submit-button"
  $ selenium-cli type "id=username" "john@example.com"
  $ selenium-cli text "xpath=//h1[@class='title']"

  # Show interactive elements after actions
  $ selenium-cli navigate https://example.com --show-elements
  $ selenium-cli click "id=submit" --show-elements
  $ selenium-cli type "id=search" "query" --show-elements

  # Advanced interactions
  $ selenium-cli hover "css=.menu-item"
  $ selenium-cli double-click "css=.file"
  $ selenium-cli right-click "id=context-menu"
  $ selenium-cli key Enter
  $ selenium-cli upload "id=file-input" "/path/to/file.pdf"
  
  # Wait commands
  $ selenium-cli wait "id=loading" --timeout 20000
  $ selenium-cli wait "css=.modal" --visible
  $ selenium-cli wait "xpath=//button[@disabled]" --present
  
  # Input field operations
  $ selenium-cli clear "id=search-box"

  # Session management
  $ selenium-cli session create my-session
  $ selenium-cli session send my-session navigate https://example.com
  $ selenium-cli session list
  $ selenium-cli session close my-session

Locator format: strategy=value
  - id=element-id
  - css=.selector
  - xpath=//xpath/expression
  - name=element-name
  - tag=tagname
  - class=classname

Features:
  - Firefox browser automation
  - Uses existing Firefox profile by default (for logged-in sessions)
  - Browser stays open between commands
  - Commands exit immediately after execution
  - Session isolation (multiple instances don't interfere)
  - Interactive element discovery (--show-elements flag)
  - HTML diff tracking after each action
  
New: Element Discovery
  Use --show-elements with navigate, click, or type commands to see all
  interactive elements on the page. Returns element details including:
  tag, text, id, class, href, and CSS selectors.
  
Note: By default, selenium-cli uses your existing Firefox profile to maintain
logged-in sessions. Use --no-profile flag with launch command to use a clean profile.
`);

// Session command group
const session = program.command('session');
session.description('Manage persistent browser sessions');

// Create new session
session
    .command('create <name>')
    .description('Create a new persistent browser session')
    .option('--headless', 'Run browser in headless mode')
    .option('--no-profile', 'Do not use existing Firefox profile')
    .option('--port <port>', 'Specific port for session server')
    .action(async (name, options) => {
        const spinner = ora(`Creating session '${name}'...`).start();
        
        try {
            // Check if session already exists
            const existingSession = await persistentSession.loadSessionInfo(name);
            if (existingSession && await persistentSession.isSessionRunning(existingSession)) {
                spinner.fail(chalk.red(`Session '${name}' already exists and is running`));
                process.exit(1);
            }
            
            // Find available port
            const port = options.port || (9600 + Math.floor(Math.random() * 400));
            
            // Start session server
            const serverPath = path.join(__dirname, 'session-server.js');
            const serverProcess = spawn('node', [serverPath, name, port.toString()], {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                env: { ...process.env }
            });
            
            await new Promise((resolve, reject) => {
                serverProcess.on('message', async (msg) => {
                    if (msg.type === 'ready') {
                        // Save session info
                        await persistentSession.saveSessionInfo(name, {
                            port: msg.port,
                            pid: serverProcess.pid,
                            created: new Date().toISOString()
                        });
                        
                        serverProcess.unref();
                        resolve();
                    }
                });
                
                serverProcess.on('error', reject);
                
                setTimeout(() => reject(new Error('Session server failed to start')), 10000);
            });
            
            spinner.succeed(chalk.green(`Session '${name}' created on port ${port}`));
            
            // Launch browser in the session
            const launchOptions = {
                headless: options.headless,
                useProfile: !options.noProfile
            };
            
            const launchResult = await persistentSession.sendCommandToSession(
                { port }, 
                { action: 'launch', options: launchOptions }
            );
            
            console.log(chalk.green('Browser launched in session'));
            console.log(chalk.gray(`Use 'selenium-cli session send ${name} <command>' to control the browser`));
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to create session: ${error.message}`));
            process.exit(1);
        }
    });

// Send command to session
session
    .command('send <name> <command> [args...]')
    .description('Send a command to an existing session')
    .action(async (name, command, args) => {
        try {
            const sessionInfo = await persistentSession.loadSessionInfo(name);
            if (!sessionInfo) {
                console.error(chalk.red(`Session '${name}' not found`));
                process.exit(1);
            }
            
            if (!await persistentSession.isSessionRunning(sessionInfo)) {
                console.error(chalk.red(`Session '${name}' is not running`));
                process.exit(1);
            }
            
            let cmd = { action: command };
            
            // Parse command and arguments
            switch (command) {
                case 'navigate':
                    cmd.url = args[0];
                    break;
                    
                case 'click':
                case 'text':
                case 'hover':
                case 'double-click':
                case 'right-click':
                    const [by, value] = args[0].split('=');
                    cmd.by = by;
                    cmd.value = value;
                    break;
                    
                case 'type':
                    const [typeBy, typeValue] = args[0].split('=');
                    cmd.by = typeBy;
                    cmd.value = typeValue;
                    cmd.text = args.slice(1).join(' ');
                    break;
                    
                case 'screenshot':
                    if (args[0]) cmd.path = args[0];
                    break;
                    
                case 'key':
                    cmd.key = args[0];
                    break;
                    
                case 'upload':
                    const [uploadBy, uploadValue] = args[0].split('=');
                    cmd.by = uploadBy;
                    cmd.value = uploadValue;
                    cmd.filePath = args[1];
                    break;
            }
            
            const spinner = ora(`Sending '${command}' to session '${name}'...`).start();
            
            const result = await persistentSession.sendCommandToSession(sessionInfo, cmd);
            spinner.succeed(chalk.green('Command executed successfully'));
            
            if (result.text !== undefined) {
                console.log(chalk.blue('Text:'), result.text);
            }
            displayActionResult(result);
            
            if (command === 'close') {
                await persistentSession.deleteSessionInfo(name);
                console.log(chalk.gray(`Session '${name}' closed and removed`));
            }
            exitAfterCommand();
        } catch (error) {
            console.error(chalk.red(`Failed to send command: ${error.message}`));
            process.exit(1);
        }
    });

// List sessions
session
    .command('list')
    .description('List all sessions')
    .action(async () => {
        try {
            const sessions = await persistentSession.listSessions();
            
            if (sessions.length === 0) {
                console.log(chalk.yellow('No sessions found'));
                return;
            }
            
            console.log(chalk.blue('Active sessions:\n'));
            
            for (const session of sessions) {
                const isRunning = await persistentSession.isSessionRunning(session);
                const status = isRunning ? chalk.green('● Running') : chalk.red('● Stopped');
                
                console.log(`${status} ${chalk.bold(session.name)}`);
                console.log(chalk.gray(`  Port: ${session.port}`));
                console.log(chalk.gray(`  Created: ${session.created}`));
                console.log();
            }
            exitAfterCommand();
        } catch (error) {
            console.error(chalk.red(`Failed to list sessions: ${error.message}`));
            process.exit(1);
        }
    });

// Close session
session
    .command('close <name>')
    .description('Close a session and its browser')
    .action(async (name) => {
        const spinner = ora(`Closing session '${name}'...`).start();
        
        try {
            const sessionInfo = await persistentSession.loadSessionInfo(name);
            if (!sessionInfo) {
                spinner.fail(chalk.red(`Session '${name}' not found`));
                process.exit(1);
            }
            
            if (await persistentSession.isSessionRunning(sessionInfo)) {
                // Send close command
                await persistentSession.sendCommandToSession(sessionInfo, { action: 'close' });
            }
            
            // Remove session file
            await persistentSession.deleteSessionInfo(name);
            
            spinner.succeed(chalk.green(`Session '${name}' closed`));
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to close session: ${error.message}`));
            process.exit(1);
        }
    });

// Launch browser command
program
    .command('launch')
    .description('Launch a new browser instance')
    .option('--headless', 'Run browser in headless mode')
    .option('--no-profile', 'Do not use existing Firefox profile')
    .option('--args <args...>', 'Additional browser arguments')
    .action(async (options) => {
        const spinner = ora('Launching browser...').start();
        try {
            const sessionInfo = await defaultSession.ensureDefaultSession({
                headless: options.headless,
                useProfile: !options.noProfile
            });
            spinner.succeed(chalk.green('Browser launched successfully'));
            console.log(chalk.gray(`Session port: ${sessionInfo.port}`));
            
            // Take initial screenshot
            const result = await defaultSession.sendToDefaultSession({
                action: 'screenshot'
            });
            
            if (result.screenshot) {
                console.log(chalk.gray(`Screenshot: ${result.screenshot}`));
            }
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to launch browser: ${error.message}`));
            process.exit(1);
        }
    });

// Navigate command
program
    .command('navigate <url>')
    .description('Navigate to a URL')
    .option('-e, --show-elements', 'Show interactive elements on the page')
    .action(async (url, options) => {
        const spinner = ora(`Navigating to ${url}...`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'navigate',
                url: url
            });
            spinner.succeed(chalk.green('Navigation successful'));
            displayActionResult(result, { showElements: options.showElements });
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to navigate: ${error.message}`));
            if (error.screenshot) console.log(chalk.gray(`Error screenshot: ${error.screenshot}`));
            if (error.html) console.log(chalk.gray(`Error HTML: ${error.html}`));
            process.exit(1);
        }
    });

// Click command
program
    .command('click <locator>')
    .description('Click an element (format: strategy=value, e.g., id=submit-button)')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .option('-e, --show-elements', 'Show interactive elements on the page after clicking')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value (e.g., id=submit-button)'));
            process.exit(1);
        }
        
        const spinner = ora(`Clicking element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'click',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Click successful'));
            displayActionResult(result, { showElements: options.showElements });
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to click: ${error.message}`));
            if (error.screenshot) console.log(chalk.gray(`Error screenshot: ${error.screenshot}`));
            if (error.html) console.log(chalk.gray(`Error HTML: ${error.html}`));
            process.exit(1);
        }
    });

// Type command
program
    .command('type <locator> <text>')
    .description('Type text into an element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .option('--no-clear', 'Do not clear the field before typing')
    .option('--enter', 'Press Enter after typing')
    .option('-e, --show-elements', 'Show interactive elements on the page after typing')
    .action(async (locator, text, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value (e.g., id=username)'));
            process.exit(1);
        }
        
        const spinner = ora(`Typing into element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'type',
                by,
                value,
                text,
                timeout: parseInt(options.timeout),
                clear: options.clear,
                pressEnter: options.enter
            });
            spinner.succeed(chalk.green('Text entered successfully'));
            displayActionResult(result, { showElements: options.showElements });
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to type: ${error.message}`));
            if (error.screenshot) console.log(chalk.gray(`Error screenshot: ${error.screenshot}`));
            if (error.html) console.log(chalk.gray(`Error HTML: ${error.html}`));
            process.exit(1);
        }
    });

// Get text command
program
    .command('text <locator>')
    .description('Get text from an element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value (e.g., class=message)'));
            process.exit(1);
        }
        
        const spinner = ora(`Getting text from element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'text',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Text retrieved successfully'));
            console.log(chalk.blue('Text:'), result.text);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to get text: ${error.message}`));
            process.exit(1);
        }
    });

// Screenshot command
program
    .command('screenshot [path]')
    .description('Take a screenshot (saves to screenshots/ if no path specified)')
    .action(async (path) => {
        const spinner = ora('Taking screenshot...').start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'screenshot',
                path: path
            });
            spinner.succeed(chalk.green('Screenshot saved'));
            if (result.path) {
                console.log(chalk.gray(`Path: ${result.path}`));
            }
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to take screenshot: ${error.message}`));
            process.exit(1);
        }
    });

// Export HTML command
program
    .command('export-html [path]')
    .description('Export page HTML source (saves to screenshots/ if no path specified)')
    .action(async (path) => {
        const spinner = ora('Exporting HTML...').start();
        try {
            const outputPath = path || screenshotManager.getScreenshotPath(
                screenshotManager.generateScreenshotFilename('export-html').replace('.png', '.html')
            );
            const result = await defaultSession.sendToDefaultSession({
                action: 'export-html',
                path: outputPath
            });
            spinner.succeed(chalk.green('HTML exported'));
            console.log(chalk.gray(`Path: ${result.path}`));
            console.log(chalk.gray(`Size: ${result.size} characters`));
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to export HTML: ${error.message}`));
            process.exit(1);
        }
    });

// Press key command
program
    .command('key <key>')
    .description('Press a keyboard key (e.g., Enter, Tab, Escape)')
    .action(async (key) => {
        const spinner = ora(`Pressing key: ${key}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'key',
                key
            });
            spinner.succeed(chalk.green('Key pressed successfully'));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to press key: ${error.message}`));
            process.exit(1);
        }
    });

// Hover command
program
    .command('hover <locator>')
    .description('Hover over an element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value'));
            process.exit(1);
        }
        
        const spinner = ora(`Hovering over element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'hover',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Hover successful'));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to hover: ${error.message}`));
            process.exit(1);
        }
    });

// Double click command
program
    .command('double-click <locator>')
    .description('Double-click an element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value'));
            process.exit(1);
        }
        
        const spinner = ora(`Double-clicking element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'double-click',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Double-click successful'));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to double-click: ${error.message}`));
            process.exit(1);
        }
    });

// Right click command
program
    .command('right-click <locator>')
    .description('Right-click an element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value'));
            process.exit(1);
        }
        
        const spinner = ora(`Right-clicking element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'right-click',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Right-click successful'));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to right-click: ${error.message}`));
            process.exit(1);
        }
    });

// Upload file command
program
    .command('upload <locator> <filePath>')
    .description('Upload a file to a file input element')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, filePath, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value'));
            process.exit(1);
        }
        
        const spinner = ora(`Uploading file to element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'upload',
                by,
                value,
                filePath,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('File uploaded successfully'));
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to upload file: ${error.message}`));
            process.exit(1);
        }
    });

// Wait for element command
program
    .command('wait <locator>')
    .description('Wait for an element to be visible and clickable')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .option('--visible', 'Wait only for visibility (not clickability)')
    .option('--present', 'Wait only for presence (not visibility)')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value (e.g., id=submit-button)'));
            process.exit(1);
        }
        
        const waitType = options.present ? 'present' : (options.visible ? 'visible' : 'clickable');
        const spinner = ora(`Waiting for element to be ${waitType}: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'wait',
                by,
                value,
                timeout: parseInt(options.timeout),
                waitType
            });
            spinner.succeed(chalk.green(`Element is ${waitType}`));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to wait for element: ${error.message}`));
            if (error.screenshot) console.log(chalk.gray(`Error screenshot: ${error.screenshot}`));
            if (error.html) console.log(chalk.gray(`Error HTML: ${error.html}`));
            process.exit(1);
        }
    });

// Clear input field command
program
    .command('clear <locator>')
    .description('Clear an input field')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (locator, options) => {
        const [by, ...valueParts] = locator.split('=');
        const value = valueParts.join('=');
        
        if (!by || !value) {
            console.error(chalk.red('Invalid locator format. Use: strategy=value (e.g., id=username)'));
            process.exit(1);
        }
        
        const spinner = ora(`Clearing element: ${locator}`).start();
        try {
            const result = await defaultSession.sendToDefaultSession({
                action: 'clear',
                by,
                value,
                timeout: parseInt(options.timeout)
            });
            spinner.succeed(chalk.green('Field cleared successfully'));
            displayActionResult(result);
            exitAfterCommand();
        } catch (error) {
            spinner.fail(chalk.red(`Failed to clear field: ${error.message}`));
            if (error.screenshot) console.log(chalk.gray(`Error screenshot: ${error.screenshot}`));
            if (error.html) console.log(chalk.gray(`Error HTML: ${error.html}`));
            process.exit(1);
        }
    });

// Status command
program
    .command('status')
    .description('Check browser session status')
    .action(async () => {
        try {
            const sessionInfo = await defaultSession.getDefaultSessionInfo();
            if (sessionInfo && await persistentSession.isSessionRunning(sessionInfo)) {
                console.log(chalk.green('✓ Browser session is active'));
                console.log(chalk.gray(`Session port: ${sessionInfo.port}`));
            } else {
                console.log(chalk.yellow('No active browser session'));
            }
            exitAfterCommand();
        } catch (error) {
            console.log(chalk.yellow('No active browser session'));
            exitAfterCommand();
        }
    });

// Close command
program
    .command('close')
    .description('Close the browser')
    .action(async () => {
        const spinner = ora('Closing browser...').start();
        try {
            const sessionInfo = await defaultSession.getDefaultSessionInfo();
            if (sessionInfo && await persistentSession.isSessionRunning(sessionInfo)) {
                await persistentSession.sendCommandToSession(sessionInfo, { action: 'close' });
                await persistentSession.deleteSessionInfo('__default__');
                spinner.succeed(chalk.green('Browser closed successfully'));
                exitAfterCommand();
            } else {
                spinner.succeed(chalk.yellow('No active browser session to close'));
                exitAfterCommand();
            }
        } catch (error) {
            spinner.fail(chalk.red(`Failed to close browser: ${error.message}`));
            process.exit(1);
        }
    });


// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
    program.outputHelp();
}