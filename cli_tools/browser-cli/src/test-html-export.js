#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { spawn } from 'child_process';

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

async function testHtmlExport() {
    console.log(chalk.blue('Testing HTML export functionality...\n'));
    
    let allPassed = true;
    const testHtmlPath = '/tmp/test-export.html';
    
    try {
        // Clean up any existing test file
        await fs.unlink(testHtmlPath).catch(() => {});
        
        // Test 1: Launch browser
        console.log('1. Launching browser...');
        const launchResult = await runCommand(['launch', '--headless']);
        if (launchResult.code !== 0) {
            console.log(chalk.red('  ✗ Failed to launch browser'));
            console.log(chalk.red(`    Error: ${launchResult.stderr}`));
            allPassed = false;
            return;
        }
        console.log(chalk.green('  ✓ Browser launched'));
        
        // Wait for browser to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 2: Navigate to a page
        console.log('\n2. Navigating to example.com...');
        const navResult = await runCommand(['navigate', 'https://example.com']);
        if (navResult.code !== 0) {
            console.log(chalk.red('  ✗ Failed to navigate'));
            allPassed = false;
        } else {
            console.log(chalk.green('  ✓ Navigation successful'));
        }
        
        // Test 3: Export HTML without specifying path
        console.log('\n3. Testing auto-path HTML export...');
        const autoExportResult = await runCommand(['export-html']);
        if (autoExportResult.code !== 0) {
            console.log(chalk.red('  ✗ Auto-path HTML export failed'));
            console.log(chalk.red(`    Error: ${autoExportResult.stderr}`));
            allPassed = false;
        } else {
            console.log(chalk.green('  ✓ Auto-path HTML export successful'));
            
            // Check if file was created and contains HTML
            const outputMatch = autoExportResult.stderr.match(/Path: (.+\.html)/);
            if (outputMatch) {
                const autoPath = outputMatch[1];
                try {
                    const htmlContent = await fs.readFile(autoPath, 'utf-8');
                    if (htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE')) {
                        console.log(chalk.green('  ✓ HTML file contains valid HTML'));
                        console.log(chalk.gray(`    Size: ${htmlContent.length} characters`));
                    } else {
                        console.log(chalk.red('  ✗ HTML file does not contain valid HTML'));
                        allPassed = false;
                    }
                } catch (error) {
                    console.log(chalk.red('  ✗ Could not read auto-generated HTML file'));
                    allPassed = false;
                }
            } else {
                console.log(chalk.red('  ✗ No path found in output'));
                allPassed = false;
            }
        }
        
        // Test 4: Export HTML with specific path
        console.log('\n4. Testing custom-path HTML export...');
        const customExportResult = await runCommand(['export-html', testHtmlPath]);
        if (customExportResult.code !== 0) {
            console.log(chalk.red('  ✗ Custom-path HTML export failed'));
            console.log(chalk.red(`    Error: ${customExportResult.stderr}`));
            allPassed = false;
        } else {
            console.log(chalk.green('  ✓ Custom-path HTML export successful'));
            
            // Check if file was created at specified path
            try {
                const htmlContent = await fs.readFile(testHtmlPath, 'utf-8');
                if (htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE')) {
                    console.log(chalk.green('  ✓ Custom HTML file contains valid HTML'));
                    console.log(chalk.gray(`    Size: ${htmlContent.length} characters`));
                    
                    // Check for example.com content
                    if (htmlContent.toLowerCase().includes('example domain')) {
                        console.log(chalk.green('  ✓ HTML contains expected page content'));
                    } else {
                        console.log(chalk.yellow('  ? HTML might not contain expected content'));
                    }
                } else {
                    console.log(chalk.red('  ✗ Custom HTML file does not contain valid HTML'));
                    allPassed = false;
                }
            } catch (error) {
                console.log(chalk.red('  ✗ Could not read custom HTML file'));
                allPassed = false;
            }
        }
        
        // Test 5: Test help command includes export-html
        console.log('\n5. Testing help text includes export-html...');
        const helpResult = await runCommand(['--help']);
        if (helpResult.stdout.includes('export-html') || helpResult.stderr.includes('export-html')) {
            console.log(chalk.green('  ✓ Help text includes export-html command'));
        } else {
            console.log(chalk.red('  ✗ Help text missing export-html command'));
            allPassed = false;
        }
        
    } catch (error) {
        console.log(chalk.red(`Test error: ${error.message}`));
        allPassed = false;
    } finally {
        // Clean up
        try {
            await fs.unlink(testHtmlPath).catch(() => {});
            await runCommand(['close']).catch(() => {});
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    
    // Summary
    console.log('\n' + chalk.blue('Test Summary:'));
    if (allPassed) {
        console.log(chalk.green('✓ All tests passed - HTML export working correctly!'));
        process.exit(0);
    } else {
        console.log(chalk.red('✗ Some tests failed - HTML export issues detected'));
        process.exit(1);
    }
}

// Run the test
testHtmlExport().catch(error => {
    console.error(chalk.red('Test error:'), error);
    process.exit(1);
});