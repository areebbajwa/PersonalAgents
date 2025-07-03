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

// Test 1: Basic CLI functionality
async function testBasicCLI() {
    // Help
    const helpResult = await runCommand(['--help']);
    if (!helpResult.stdout.includes('browser-cli') || !helpResult.stdout.includes('Commands:')) {
        throw new Error('Help output missing expected content');
    }
    
    // Version
    const versionResult = await runCommand(['--version']);
    if (!versionResult.stdout.includes('1.0.0')) {
        throw new Error('Version output incorrect');
    }
}

// Test 2: Single command execution
async function testSingleCommands() {
    // Test launch command
    let result = await runCommand(['launch', '--headless'], 30000);
    if (result.code !== 0) {
        throw new Error(`Launch failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Browser launched successfully')) {
        throw new Error('Launch should succeed');
    }
    
    // Test navigate command
    result = await runCommand(['navigate', 'https://example.com'], 30000);
    if (result.code !== 0) {
        throw new Error(`Navigate failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Navigation successful')) {
        throw new Error('Navigate should succeed');
    }
    
    // Test screenshot command
    result = await runCommand(['screenshot'], 30000);
    if (result.code !== 0) {
        throw new Error(`Screenshot failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Screenshot saved')) {
        throw new Error('Screenshot should succeed');
    }
    
    // Test close command
    result = await runCommand(['close'], 30000);
    if (result.code !== 0) {
        throw new Error(`Close failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Browser closed successfully')) {
        throw new Error('Close should succeed');
    }
}

// Test 3: Firefox profile usage
async function testFirefoxProfile() {
    // Launch with profile
    let result = await runCommand(['launch', '--headless'], 30000);
    if (result.code !== 0) {
        throw new Error(`Profile test failed: ${result.stderr}`);
    }
    if (!result.stdout.includes('Using Firefox profile:')) {
        throw new Error('Should detect and use Firefox profile');
    }
    
    // Clean up
    await runCommand(['close'], 30000);
}


// Test 5: Error handling
async function testErrorHandling() {
    // Invalid command
    const invalidResult = await runCommand(['invalid-command']);
    if (invalidResult.code === 0) {
        throw new Error('Invalid command should fail');
    }
    
    // Navigate without launch
    const result = await runCommand(['navigate', 'https://example.com']);
    if (result.code === 0) {
        throw new Error('Navigate without launch should fail');
    }
    if (!result.stderr.includes('No browser session')) {
        throw new Error('Should error when no browser is launched');
    }
}

// Run all tests
async function runAllTests() {
    console.log(chalk.blue('Running browser-cli integration tests...\n'));
    
    await runTest('Basic CLI functionality', testBasicCLI);
    await runTest('Single command execution', testSingleCommands);
    await runTest('Firefox profile usage', testFirefoxProfile);
    await runTest('Error handling', testErrorHandling);
    
    console.log('\n' + chalk.blue('Integration Test Summary:'));
    console.log(chalk.green(`✓ Passed: ${passedTests}`));
    if (failedTests > 0) {
        console.log(chalk.red(`✗ Failed: ${failedTests}`));
        process.exit(1);
    } else {
        console.log(chalk.green('\nAll integration tests passed!'));
        process.exit(0);
    }
}

// Run tests
runAllTests().catch((error) => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
});