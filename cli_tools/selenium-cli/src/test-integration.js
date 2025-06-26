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

// Test 1: Basic CLI functionality
async function testBasicCLI() {
    // Help
    const helpResult = await runCommand(['--help']);
    if (!helpResult.stdout.includes('selenium-cli') || !helpResult.stdout.includes('Commands:')) {
        throw new Error('Help output missing expected content');
    }
    
    // Version
    const versionResult = await runCommand(['--version']);
    if (!versionResult.stdout.includes('1.0.0')) {
        throw new Error('Version output incorrect');
    }
}

// Test 2: Batch mode with real website
async function testBatchMode() {
    const batchFile = path.join(__dirname, '..', 'test-integration-batch.txt');
    const batchContent = `launch --headless
navigate https://www.google.com
screenshot
navigate https://github.com
screenshot
close`;
    
    await fs.writeFile(batchFile, batchContent);
    
    try {
        const result = await runCommand(['batch', batchFile], 60000);
        if (result.code !== 0) {
            throw new Error(`Batch execution failed: ${result.stderr}`);
        }
        if (!result.stdout.includes('Batch execution complete')) {
            throw new Error('Batch should complete successfully');
        }
        if (!result.stdout.includes('✓ Successful: 6')) {
            throw new Error('All 6 commands should succeed');
        }
    } finally {
        await fs.unlink(batchFile).catch(() => {});
    }
}

// Test 3: Multiple concurrent batches
async function testConcurrentBatches() {
    const batch1 = `launch --headless
navigate https://example.com
screenshot
close`;
    
    const batch2 = `launch --headless
navigate https://httpbin.org
screenshot
close`;
    
    const file1 = '/tmp/selenium-batch1.txt';
    const file2 = '/tmp/selenium-batch2.txt';
    
    await fs.writeFile(file1, batch1);
    await fs.writeFile(file2, batch2);
    
    try {
        // Run two batches concurrently
        const [result1, result2] = await Promise.all([
            runCommand(['batch', file1], 60000),
            runCommand(['batch', file2], 60000)
        ]);
        
        if (result1.code !== 0 || result2.code !== 0) {
            throw new Error('Both batches should succeed');
        }
    } finally {
        await fs.unlink(file1).catch(() => {});
        await fs.unlink(file2).catch(() => {});
    }
}

// Test 4: Firefox profile usage
async function testFirefoxProfile() {
    const batchFile = '/tmp/profile-test.txt';
    const batchContent = `launch --use-profile
navigate https://github.com
screenshot
close`;
    
    await fs.writeFile(batchFile, batchContent);
    
    try {
        const result = await runCommand(['batch', batchFile], 60000);
        if (result.code !== 0) {
            throw new Error(`Profile test failed: ${result.stderr}`);
        }
        if (!result.stdout.includes('Using Firefox profile:')) {
            throw new Error('Should detect and use Firefox profile');
        }
    } finally {
        await fs.unlink(batchFile).catch(() => {});
    }
}

// Test 5: Error handling
async function testErrorHandling() {
    // Invalid command
    const invalidResult = await runCommand(['invalid-command']);
    if (invalidResult.code === 0) {
        throw new Error('Invalid command should fail');
    }
    
    // Navigate without launch
    const batchFile = '/tmp/error-test.txt';
    await fs.writeFile(batchFile, 'navigate https://example.com');
    
    try {
        const result = await runCommand(['batch', batchFile]);
        if (!result.stdout.includes('No browser session')) {
            throw new Error('Should error when no browser is launched');
        }
    } finally {
        await fs.unlink(batchFile).catch(() => {});
    }
}

// Run all tests
async function runAllTests() {
    console.log(chalk.blue('Running selenium-cli integration tests...\n'));
    
    await runTest('Basic CLI functionality', testBasicCLI);
    await runTest('Batch mode with real websites', testBatchMode);
    await runTest('Concurrent batch execution', testConcurrentBatches);
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