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

// Create batch files for testing
async function createBatchFiles() {
    const batch1 = `launch --headless
navigate https://example.com
text tag=h1
screenshot
close`;

    const batch2 = `launch --headless
navigate https://google.com
screenshot
close`;

    const batch3 = `launch --headless
navigate https://github.com
screenshot
close`;

    await fs.writeFile('/tmp/batch1.txt', batch1);
    await fs.writeFile('/tmp/batch2.txt', batch2);
    await fs.writeFile('/tmp/batch3.txt', batch3);
}

// Run batch command in background
function runBatchInBackground(batchFile, id) {
    return new Promise((resolve, reject) => {
        const child = spawn(CLI_PATH, ['batch', batchFile], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        let startTime = Date.now();
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({
                id,
                code,
                stdout,
                stderr,
                duration,
                success: code === 0 && stdout.includes('Batch execution complete')
            });
        });
        
        child.on('error', (error) => {
            reject({ id, error });
        });
        
        // Don't wait for child - let it run in background
        child.unref();
    });
}

// Main test
async function testMultipleInstances() {
    console.log(chalk.blue('Testing multiple selenium-cli instances...\n'));
    
    // Create batch files
    await createBatchFiles();
    
    // Start 3 instances simultaneously
    console.log(chalk.yellow('Starting 3 selenium-cli instances simultaneously...'));
    
    const promises = [
        runBatchInBackground('/tmp/batch1.txt', 'Instance1'),
        runBatchInBackground('/tmp/batch2.txt', 'Instance2'),
        runBatchInBackground('/tmp/batch3.txt', 'Instance3')
    ];
    
    // Wait for all to complete
    const results = await Promise.allSettled(promises);
    
    // Analyze results
    console.log('\n' + chalk.blue('Results:'));
    
    let allSuccess = true;
    
    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { id, success, duration, stdout, stderr } = result.value;
            
            if (success) {
                console.log(chalk.green(`✓ ${id}: Success (${duration}ms)`));
                
                // Check which site was visited
                if (stdout.includes('Example Domain')) {
                    console.log(chalk.gray(`  - Visited example.com`));
                } else if (stdout.includes('google.com')) {
                    console.log(chalk.gray(`  - Visited google.com`));
                } else if (stdout.includes('github.com')) {
                    console.log(chalk.gray(`  - Visited github.com`));
                }
            } else {
                console.log(chalk.red(`✗ ${id}: Failed`));
                if (stderr) console.log(chalk.red(`  Error: ${stderr}`));
                allSuccess = false;
            }
        } else {
            console.log(chalk.red(`✗ ${result.reason.id}: Error - ${result.reason.error.message}`));
            allSuccess = false;
        }
    }
    
    // Cleanup
    await fs.unlink('/tmp/batch1.txt').catch(() => {});
    await fs.unlink('/tmp/batch2.txt').catch(() => {});
    await fs.unlink('/tmp/batch3.txt').catch(() => {});
    
    // Summary
    console.log('\n' + chalk.blue('Test Summary:'));
    if (allSuccess) {
        console.log(chalk.green('✓ All instances ran successfully without interference!'));
        process.exit(0);
    } else {
        console.log(chalk.red('✗ Some instances failed - they may have interfered with each other'));
        process.exit(1);
    }
}

// Run test
testMultipleInstances().catch((error) => {
    console.error(chalk.red('Test error:'), error);
    process.exit(1);
});