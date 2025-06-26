#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, '..', 'selenium-cli');

// Set test mode environment variable
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
function runCommand(args, timeout = 5000) {
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

// Test 1: Help flag
async function testHelpFlag() {
    const result = await runCommand(['--help']);
    if (result.code !== 0) {
        throw new Error(`Expected exit code 0, got ${result.code}`);
    }
    if (!result.stdout.includes('selenium-cli')) {
        throw new Error('Help output should include tool name');
    }
    if (!result.stdout.includes('Commands:')) {
        throw new Error('Help output should include Commands section');
    }
}

// Test 2: No arguments shows help
async function testNoArgsShowsHelp() {
    const result = await runCommand([]);
    // No arguments should show help (exit code might be 0 or 1 depending on implementation)
    if (!result.stdout.includes('selenium-cli') && !result.stderr.includes('selenium-cli')) {
        throw new Error('Should show help when no arguments provided');
    }
}

// Test 3: Version flag
async function testVersionFlag() {
    const result = await runCommand(['--version']);
    if (result.code !== 0) {
        throw new Error(`Expected exit code 0, got ${result.code}`);
    }
    if (!result.stdout.includes('1.0.0')) {
        throw new Error('Version output should include version number');
    }
}

// Test 4: Status command without browser
async function testStatusWithoutBrowser() {
    const result = await runCommand(['status']);
    if (result.code !== 0) {
        throw new Error(`Expected exit code 0, got ${result.code}`);
    }
    if (!result.stdout.includes('No active browser session')) {
        throw new Error('Status should indicate no active session');
    }
}

// Test 5: Invalid command
async function testInvalidCommand() {
    const result = await runCommand(['invalid-command']);
    if (result.code === 0) {
        throw new Error('Expected non-zero exit code for invalid command');
    }
}

// Run all tests
async function runAllTests() {
    console.log(chalk.blue('Running selenium-cli tests...\n'));
    
    await runTest('Help flag', testHelpFlag);
    await runTest('No arguments shows help', testNoArgsShowsHelp);
    await runTest('Version flag', testVersionFlag);
    await runTest('Status command without browser', testStatusWithoutBrowser);
    await runTest('Invalid command returns error', testInvalidCommand);
    
    console.log('\n' + chalk.blue('Test Summary:'));
    console.log(chalk.green(`✓ Passed: ${passedTests}`));
    if (failedTests > 0) {
        console.log(chalk.red(`✗ Failed: ${failedTests}`));
        process.exit(1);
    } else {
        console.log(chalk.green('\nAll tests passed!'));
        process.exit(0);
    }
}

// Run tests
runAllTests().catch((error) => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
});