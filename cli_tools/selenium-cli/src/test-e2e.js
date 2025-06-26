#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, '..', 'selenium-cli');

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

// Test 1: Launch browser and check status
async function testBrowserLaunch() {
    // Launch browser
    const launchResult = await runCommand(['launch', '--headless']);
    if (launchResult.code !== 0) {
        throw new Error(`Browser launch failed: ${launchResult.stderr}`);
    }
    if (!launchResult.stdout.includes('Browser launched successfully')) {
        throw new Error('Launch should report success');
    }
    
    // Check status
    const statusResult = await runCommand(['status']);
    if (statusResult.code !== 0) {
        throw new Error(`Status check failed: ${statusResult.stderr}`);
    }
    if (!statusResult.stdout.includes('Browser session is active')) {
        throw new Error('Status should show active session');
    }
}

// Test 2: Navigate to a URL
async function testNavigation() {
    const result = await runCommand(['navigate', 'https://example.com']);
    if (result.code !== 0) {
        throw new Error(`Navigation failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Navigation successful')) {
        throw new Error('Navigation should report success');
    }
    if (!result.stdout.includes('Screenshot:')) {
        throw new Error('Navigation should take a screenshot');
    }
}

// Test 3: Find and interact with elements
async function testElementInteraction() {
    // Get text from h1 element
    const textResult = await runCommand(['text', 'tag=h1']);
    if (textResult.code !== 0) {
        throw new Error(`Get text failed: ${textResult.stderr}`);
    }
    if (!textResult.stdout.includes('Example Domain')) {
        throw new Error('Should find "Example Domain" in h1');
    }
    
    // Take a screenshot
    const screenshotPath = path.join(__dirname, '..', 'test-screenshot.png');
    const screenshotResult = await runCommand(['screenshot', screenshotPath]);
    if (screenshotResult.code !== 0) {
        throw new Error(`Screenshot failed: ${screenshotResult.stderr}`);
    }
    
    // Verify screenshot was created
    try {
        await fs.access(screenshotPath);
        // Clean up
        await fs.unlink(screenshotPath);
    } catch (error) {
        throw new Error('Screenshot file was not created');
    }
}

// Test 4: Close browser
async function testBrowserClose() {
    const result = await runCommand(['close']);
    if (result.code !== 0) {
        throw new Error(`Browser close failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Browser closed successfully')) {
        throw new Error('Close should report success');
    }
    
    // Verify browser is closed
    const statusResult = await runCommand(['status']);
    if (!statusResult.stdout.includes('No active browser session')) {
        throw new Error('Status should show no active session after close');
    }
}

// Run all E2E tests
async function runAllTests() {
    console.log(chalk.blue('Running selenium-cli E2E tests...\n'));
    
    await runTest('Browser launch and status', testBrowserLaunch);
    await runTest('Navigation', testNavigation);
    await runTest('Element interaction', testElementInteraction);
    await runTest('Browser close', testBrowserClose);
    
    console.log('\n' + chalk.blue('E2E Test Summary:'));
    console.log(chalk.green(`✓ Passed: ${passedTests}`));
    if (failedTests > 0) {
        console.log(chalk.red(`✗ Failed: ${failedTests}`));
        process.exit(1);
    } else {
        console.log(chalk.green('\nAll E2E tests passed!'));
        process.exit(0);
    }
}

// Run tests
runAllTests().catch((error) => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
});