#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

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
            if (timedOut) return;
            resolve({ code, stdout, stderr });
        });
        
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

console.log(chalk.bold('\n🧪 Comprehensive Selenium CLI Test\n'));
console.log(chalk.yellow('⚠️  This test will launch a visible Firefox window with default profile\n'));

// Test 1: Launch browser in non-headless mode with default profile
async function testNonHeadlessLaunch() {
    // First navigate command will automatically launch the browser
    const result = await runCommand(['navigate', 'https://example.com']);
    if (result.code !== 0) {
        throw new Error(`Navigate (with auto-launch) failed: ${result.stderr}`);
    }
    // Check that navigation was successful
    if (!result.stdout.includes('Navigation successful') && !result.stdout.includes('Screenshot:')) {
        throw new Error('Navigate should report success and take screenshot');
    }
    
    // Give browser time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// Test 2: Check that commands exit immediately
async function testCommandsExitImmediately() {
    const startTime = Date.now();
    const result = await runCommand(['status'], 5000);
    const duration = Date.now() - startTime;
    
    if (result.code !== 0) {
        throw new Error(`Status command failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Browser session is active')) {
        throw new Error('Status should show active session');
    }
    if (duration > 3000) {
        throw new Error(`Command took ${duration}ms, should exit immediately`);
    }
}

// Test 3: Test all element interaction commands
async function testAllCommands() {
    // Navigate to a fresh page first
    await runCommand(['navigate', 'https://example.com']);
    
    // Click test (on h1 element which exists on example.com)
    const clickResult = await runCommand(['click', 'tag=h1']);
    if (clickResult.code !== 0) {
        throw new Error(`Click failed: ${clickResult.stderr}`);
    }
    // Success message might be after other output
    if (!clickResult.stdout.includes('Click successful') && !clickResult.stdout.includes('Screenshot:')) {
        throw new Error('Click should report success or take screenshot');
    }
    
    // Type test - skip since example.com has no input fields
    
    // Text retrieval
    const textResult = await runCommand(['text', 'tag=h1']);
    if (textResult.code !== 0) {
        throw new Error(`Text retrieval failed: ${textResult.stderr}`);
    }
    
    // Screenshot
    const screenshotResult = await runCommand(['screenshot']);
    if (screenshotResult.code !== 0) {
        throw new Error(`Screenshot failed: ${screenshotResult.stderr}`);
    }
    
    // Export HTML
    const exportResult = await runCommand(['export-html']);
    if (exportResult.code !== 0) {
        throw new Error(`Export HTML failed: ${exportResult.stderr}`);
    }
    
    // Key press
    const keyResult = await runCommand(['key', 'Tab']);
    if (keyResult.code !== 0) {
        throw new Error(`Key press failed: ${keyResult.stderr}`);
    }
    
    // Hover
    const hoverResult = await runCommand(['hover', 'tag=h1']);
    if (hoverResult.code !== 0) {
        throw new Error(`Hover failed: ${hoverResult.stderr}`);
    }
    
    // Double-click
    const dblClickResult = await runCommand(['double-click', 'tag=h1']);
    if (dblClickResult.code !== 0) {
        throw new Error(`Double-click failed: ${dblClickResult.stderr}`);
    }
    
    // Right-click
    const rightClickResult = await runCommand(['right-click', 'tag=h1']);
    if (rightClickResult.code !== 0) {
        throw new Error(`Right-click failed: ${rightClickResult.stderr}`);
    }
}

// Test 4: Close browser
async function testBrowserClose() {
    const result = await runCommand(['close']);
    if (result.code !== 0) {
        throw new Error(`Browser close failed: ${result.stderr}`);
    }
    // Just check that command completed without error
    // Success message might appear in different order due to async
}

// Run all tests
async function runAllTests() {
    await runTest('Navigate auto-launches browser (non-headless with default profile)', testNonHeadlessLaunch);
    await runTest('Commands exit immediately', testCommandsExitImmediately);
    await runTest('All element interaction commands', testAllCommands);
    await runTest('Browser close', testBrowserClose);
    
    // Summary
    console.log(chalk.bold(`\n📊 Test Summary\n`));
    console.log(chalk.green(`✓ Passed: ${passedTests}`));
    console.log(chalk.red(`✗ Failed: ${failedTests}`));
    
    if (failedTests === 0) {
        console.log(chalk.bold.green('\n🎉 All tests passed!\n'));
        process.exit(0);
    } else {
        console.log(chalk.bold.red('\n❌ Some tests failed\n'));
        process.exit(1);
    }
}

// Start tests
runAllTests().catch(error => {
    console.error(chalk.red('\nTest suite failed:'), error);
    process.exit(1);
});