#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { WebDriver, Builder, By } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, 'index.js');

// Helper to run CLI command
function runCommand(args, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [CLI_PATH, ...args], {
            env: { ...process.env, SELENIUM_CLI_TEST: '1' }
        });
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

async function testBrowserPersistence() {
    console.log(chalk.blue('Testing browser persistence after CLI exit...\n'));
    
    let allPassed = true;
    let driver = null;
    
    try {
        // Test 1: Launch browser
        console.log('1. Launching browser...');
        const launchResult = await runCommand(['launch', '--headless']);
        if (launchResult.code !== 0) {
            console.log(chalk.red('  ✗ Failed to launch browser'));
            console.log(chalk.red(`    Error: ${launchResult.stderr}`));
            allPassed = false;
            return;
        }
        if (!launchResult.stderr.includes('Browser launched successfully')) {
            console.log(chalk.red('  ✗ Launch message not found'));
            console.log(chalk.gray(`    stdout: ${launchResult.stdout}`));
            console.log(chalk.gray(`    stderr: ${launchResult.stderr}`));
            allPassed = false;
            return;
        }
        console.log(chalk.green('  ✓ Browser launched successfully'));
        
        // Wait a moment for browser to fully start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 2: Navigate to a page (separate command)
        console.log('\n2. Navigating to example.com...');
        const navResult = await runCommand(['navigate', 'https://example.com']);
        if (navResult.code !== 0) {
            console.log(chalk.red('  ✗ Failed to navigate'));
            allPassed = false;
        } else {
            console.log(chalk.green('  ✓ Navigation successful'));
        }
        
        // Test 3: Check if browser is still running after CLI exits
        console.log('\n3. Checking if browser persists after CLI commands...');
        
        // Wait a moment to ensure CLI has fully exited
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to connect to the existing browser session
        // We'll check if Firefox is still running by looking for the geckodriver port
        try {
            // Try to create a new driver instance on the default port
            // If the browser was closed, this would fail
            const options = new firefox.Options();
            options.addArguments('--headless');
            
            // Check if we can still interact with the browser
            const statusResult = await runCommand(['status']);
            if (statusResult.stdout.includes('Browser session is active')) {
                console.log(chalk.green('  ✓ Browser is still running'));
                
                // Verify we can still send commands
                const screenshotResult = await runCommand(['screenshot']);
                if (screenshotResult.code === 0) {
                    console.log(chalk.green('  ✓ Can still interact with browser'));
                } else {
                    console.log(chalk.red('  ✗ Cannot interact with browser'));
                    allPassed = false;
                }
            } else {
                console.log(chalk.red('  ✗ Browser session not found'));
                allPassed = false;
            }
        } catch (error) {
            console.log(chalk.red('  ✗ Browser appears to have closed'));
            allPassed = false;
        }
        
        // Test 4: Explicit close command should work
        console.log('\n4. Testing explicit close command...');
        const closeResult = await runCommand(['close']);
        if (closeResult.code === 0 && closeResult.stdout.includes('Browser closed successfully')) {
            console.log(chalk.green('  ✓ Explicit close command works'));
        } else {
            console.log(chalk.red('  ✗ Close command failed'));
            allPassed = false;
        }
        
        // Test 5: Verify browser is actually closed
        console.log('\n5. Verifying browser is closed...');
        const statusAfterClose = await runCommand(['status']);
        if (statusAfterClose.stdout.includes('No active browser session')) {
            console.log(chalk.green('  ✓ Browser properly closed'));
        } else {
            console.log(chalk.red('  ✗ Browser still active after close'));
            allPassed = false;
        }
        
    } catch (error) {
        console.log(chalk.red(`Test error: ${error.message}`));
        allPassed = false;
    } finally {
        // Clean up - ensure browser is closed
        try {
            await runCommand(['close']);
        } catch (e) {
            // Ignore errors if already closed
        }
    }
    
    // Summary
    console.log('\n' + chalk.blue('Test Summary:'));
    if (allPassed) {
        console.log(chalk.green('✓ All tests passed - browser persistence working correctly!'));
        process.exit(0);
    } else {
        console.log(chalk.red('✗ Some tests failed - browser persistence issues detected'));
        process.exit(1);
    }
}

// Run the test
testBrowserPersistence().catch(error => {
    console.error(chalk.red('Test error:'), error);
    process.exit(1);
});