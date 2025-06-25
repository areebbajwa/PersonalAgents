#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Test script to verify screenshot functionality
async function runTest() {
    console.log('Starting screenshot functionality test...');
    
    // Start the MCP server
    const server = spawn('node', ['server.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Send test commands via stdin
    const testCommands = [
        {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "start_browser",
                arguments: {}
            },
            id: 1
        },
        {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "navigate",
                arguments: {
                    url: "https://example.com"
                }
            },
            id: 2
        },
        {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "click_element",
                arguments: {
                    by: "css",
                    value: "h1"
                }
            },
            id: 3
        },
        {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "close_session",
                arguments: {}
            },
            id: 4
        }
    ];
    
    let responses = [];
    let responseCount = 0;
    
    // Handle server output
    server.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.result) {
                        responses.push(parsed);
                        responseCount++;
                        console.log(`Response ${responseCount}:`, JSON.stringify(parsed.result, null, 2));
                    }
                } catch (e) {
                    // Not JSON, skip
                }
            }
        }
    });
    
    server.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
    });
    
    // Send commands with delay
    for (let i = 0; i < testCommands.length; i++) {
        server.stdin.write(JSON.stringify(testCommands[i]) + '\n');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between commands
    }
    
    // Wait for all responses
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check screenshots directory
    const screenshotDir = path.join(process.cwd(), 'selenium-screenshots');
    try {
        const files = await fs.readdir(screenshotDir);
        console.log('\nScreenshots created:');
        for (const file of files) {
            if (file.endsWith('.png')) {
                console.log(`  - ${file}`);
            }
        }
        
        // Verify expected screenshots
        const expectedActions = ['navigate', 'click'];
        let foundScreenshots = 0;
        for (const action of expectedActions) {
            const found = files.some(f => f.startsWith(action + '_'));
            if (found) {
                foundScreenshots++;
                console.log(`✓ Found screenshot for ${action} action`);
            } else {
                console.log(`✗ Missing screenshot for ${action} action`);
            }
        }
        
        if (foundScreenshots === expectedActions.length) {
            console.log('\n✅ All expected screenshots were created successfully!');
        } else {
            console.log(`\n❌ Only ${foundScreenshots}/${expectedActions.length} expected screenshots were created`);
            process.exit(1);
        }
        
    } catch (e) {
        console.error('Error checking screenshots:', e.message);
        process.exit(1);
    }
    
    // Kill the server
    server.kill();
    console.log('\nTest completed successfully!');
}

// Run the test
runTest().catch(console.error);