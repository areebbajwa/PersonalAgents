#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, 'index.js');

async function testBatchModeRemoved() {
    console.log(chalk.blue('Testing that batch mode has been removed...\n'));
    
    let allPassed = true;
    
    // Test 1: Check that batch command doesn't exist in help
    console.log('1. Checking help text...');
    try {
        const helpOutput = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
        if (helpOutput.includes('batch') || helpOutput.includes('Batch')) {
            console.log(chalk.red('  ✗ Help still contains batch references'));
            allPassed = false;
        } else {
            console.log(chalk.green('  ✓ No batch references in help'));
        }
    } catch (error) {
        console.log(chalk.red('  ✗ Failed to get help text'));
        allPassed = false;
    }
    
    // Test 2: Check that batch command is not recognized
    console.log('\n2. Testing batch command...');
    try {
        execSync(`node ${CLI_PATH} batch test.txt`, { encoding: 'utf8' });
        console.log(chalk.red('  ✗ Batch command still exists (should have failed)'));
        allPassed = false;
    } catch (error) {
        if (error.stderr && error.stderr.includes('Unknown command')) {
            console.log(chalk.green('  ✓ Batch command not recognized'));
        } else {
            console.log(chalk.green('  ✓ Batch command failed as expected'));
        }
    }
    
    // Test 3: Check that run command is not recognized
    console.log('\n3. Testing run command...');
    try {
        execSync(`node ${CLI_PATH} run`, { encoding: 'utf8' });
        console.log(chalk.red('  ✗ Run command still exists (should have failed)'));
        allPassed = false;
    } catch (error) {
        if (error.stderr && error.stderr.includes('Unknown command')) {
            console.log(chalk.green('  ✓ Run command not recognized'));
        } else {
            console.log(chalk.green('  ✓ Run command failed as expected'));
        }
    }
    
    // Test 4: Check source code for batch references
    console.log('\n4. Checking source code...');
    const srcFiles = await fs.readdir(__dirname);
    let batchReferencesFound = false;
    
    for (const file of srcFiles) {
        if (file.endsWith('.js') && !file.includes('test-batch-removed')) {
            const filePath = path.join(__dirname, file);
            const content = await fs.readFile(filePath, 'utf8');
            
            // Look for batch-related imports or references
            if (content.includes('batch-mode') || 
                content.includes('batchMode') || 
                content.includes("command('batch")  ||
                content.includes("command('run")) {
                console.log(chalk.red(`  ✗ Found batch references in ${file}`));
                batchReferencesFound = true;
                allPassed = false;
            }
        }
    }
    
    if (!batchReferencesFound) {
        console.log(chalk.green('  ✓ No batch references in source code'));
    }
    
    // Summary
    console.log('\n' + chalk.blue('Test Summary:'));
    if (allPassed) {
        console.log(chalk.green('✓ All tests passed - batch mode successfully removed!'));
        process.exit(0);
    } else {
        console.log(chalk.red('✗ Some tests failed - batch mode not fully removed'));
        process.exit(1);
    }
}

// Run the test
testBatchModeRemoved().catch(error => {
    console.error(chalk.red('Test error:'), error);
    process.exit(1);
});