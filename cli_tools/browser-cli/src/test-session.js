#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, '..', 'browser-cli');

// Set test mode
process.env.SELENIUM_CLI_TEST = 'true';

// Test results tracking
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    return fn()
        .then(() => {
            console.log(chalk.green('✓ Pass'));
            passedTests++;
        })
        .catch((error) => {
            console.log(chalk.red('✗ Fail'));
            console.error(chalk.red(`  Error: ${error.message}`));
            failedTests++;
        });
}

// Helper to run CLI command
function runCommand(args, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const child = spawn(CLI_PATH, args);
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill();
            reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            clearTimeout(timer);
            if (!timedOut) {
                resolve({ code, stdout, stderr });
            }
        });
        
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

// Test 1: Create a session
async function testCreateSession() {
    const result = await runCommand(['session', 'create', 'test-session', '--headless']);
    if (result.code !== 0) {
        throw new Error(`Session creation failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Session \'test-session\' created')) {
        throw new Error('Session creation should report success');
    }
    if (!result.stdout.includes('Browser launched in session')) {
        throw new Error('Browser should be launched in session');
    }
}

// Test 2: List sessions
async function testListSessions() {
    const result = await runCommand(['session', 'list']);
    if (result.code !== 0) {
        throw new Error(`Session list failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('test-session')) {
        throw new Error('Should list the created session');
    }
    if (!result.stdout.includes('● Running')) {
        throw new Error('Session should be shown as running');
    }
}

// Test 3: Send commands to session
async function testSendCommands() {
    // Navigate
    const navResult = await runCommand(['session', 'send', 'test-session', 'navigate', 'https://example.com']);
    if (navResult.code !== 0) {
        throw new Error(`Navigate failed: ${navResult.stderr}`);
    }
    if (!navResult.stdout.includes('Command executed successfully')) {
        throw new Error('Navigate should succeed');
    }
    
    // Get text
    const textResult = await runCommand(['session', 'send', 'test-session', 'text', 'tag=h1']);
    if (textResult.code !== 0) {
        throw new Error(`Get text failed: ${textResult.stderr}`);
    }
    if (!textResult.stdout.includes('Example Domain')) {
        throw new Error('Should retrieve h1 text');
    }
    
    // Screenshot
    const screenshotResult = await runCommand(['session', 'send', 'test-session', 'screenshot']);
    if (screenshotResult.code !== 0) {
        throw new Error(`Screenshot failed: ${screenshotResult.stderr}`);
    }
    if (!screenshotResult.stdout.includes('Screenshot:')) {
        throw new Error('Should take screenshot');
    }
}

// Test 4: Create multiple sessions
async function testMultipleSessions() {
    // Create second session
    const createResult = await runCommand(['session', 'create', 'test-session-2', '--headless']);
    if (createResult.code !== 0) {
        throw new Error(`Second session creation failed: ${createResult.stderr}`);
    }
    
    // List should show both sessions
    const listResult = await runCommand(['session', 'list']);
    if (!listResult.stdout.includes('test-session') || !listResult.stdout.includes('test-session-2')) {
        throw new Error('Should list both sessions');
    }
    
    // Send commands to both sessions
    const nav1 = await runCommand(['session', 'send', 'test-session', 'navigate', 'https://google.com']);
    const nav2 = await runCommand(['session', 'send', 'test-session-2', 'navigate', 'https://github.com']);
    
    if (nav1.code !== 0 || nav2.code !== 0) {
        throw new Error('Both sessions should accept commands independently');
    }
}

// Test 5: Close sessions
async function testCloseSessions() {
    // Close first session
    const close1 = await runCommand(['session', 'close', 'test-session']);
    if (close1.code !== 0) {
        throw new Error(`Session close failed: ${close1.stderr}`);
    }
    
    // Close second session
    const close2 = await runCommand(['session', 'close', 'test-session-2']);
    if (close2.code !== 0) {
        throw new Error(`Second session close failed: ${close2.stderr}`);
    }
    
    // List should be empty
    const listResult = await runCommand(['session', 'list']);
    if (!listResult.stdout.includes('No sessions found')) {
        throw new Error('All sessions should be closed');
    }
}

// Run all tests
async function runAllTests() {
    console.log(chalk.blue('Running browser-cli session tests...\n'));
    
    await runTest('Create session', testCreateSession);
    await runTest('List sessions', testListSessions);
    await runTest('Send commands to session', testSendCommands);
    await runTest('Multiple sessions', testMultipleSessions);
    await runTest('Close sessions', testCloseSessions);
    
    console.log('\n' + chalk.blue('Session Test Summary:'));
    console.log(chalk.green(`✓ Passed: ${passedTests}`));
    if (failedTests > 0) {
        console.log(chalk.red(`✗ Failed: ${failedTests}`));
        process.exit(1);
    } else {
        console.log(chalk.green('\nAll session tests passed!'));
        process.exit(0);
    }
}

// Run tests
runAllTests().catch((error) => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
});