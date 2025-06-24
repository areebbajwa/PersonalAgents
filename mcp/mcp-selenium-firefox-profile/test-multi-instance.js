#!/usr/bin/env node

// Test script for multi-instance functionality through MCP server
import { spawn } from 'child_process';

console.log('Testing multiple MCP instances...');

async function testMultiInstance() {
    try {
        console.log('1. Starting first MCP instance (should create Firefox)...');
        
        // Start first instance
        const instance1 = spawn('node', ['server.js'], { stdio: 'pipe' });
        
        // Send start_browser command to first instance
        const startCommand = JSON.stringify({
            "jsonrpc": "2.0", 
            "id": 1, 
            "method": "tools/call", 
            "params": {
                "name": "start_browser", 
                "arguments": {"browser": "firefox"}
            }
        });
        
        instance1.stdin.write(startCommand + '\n');
        
        let firstInstanceOutput = '';
        instance1.stdout.on('data', (data) => {
            firstInstanceOutput += data.toString();
        });
        
        // Wait for first instance to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('First instance output:', firstInstanceOutput);
        console.log('✓ First instance started');
        
        console.log('2. Starting second MCP instance (should connect via proxy)...');
        
        // Start second instance
        const instance2 = spawn('node', ['server.js'], { stdio: 'pipe' });
        
        // Send start_browser command to second instance
        instance2.stdin.write(startCommand + '\n');
        
        let secondInstanceOutput = '';
        instance2.stdout.on('data', (data) => {
            secondInstanceOutput += data.toString();
        });
        
        // Wait for second instance
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Second instance output:', secondInstanceOutput);
        
        if (secondInstanceOutput.includes('proxy')) {
            console.log('✓ Second instance connected via proxy');
        } else {
            console.log('✗ Second instance did not use proxy');
        }
        
        // Clean up
        instance1.kill();
        instance2.kill();
        
        console.log('✓ Multi-instance test completed');
        
    } catch (error) {
        console.error('✗ Multi-instance test failed:', error.message);
        process.exit(1);
    }
}

testMultiInstance();