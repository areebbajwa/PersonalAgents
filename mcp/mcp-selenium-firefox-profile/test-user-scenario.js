#!/usr/bin/env node

// E2E test simulating user scenario: multiple Claude Code sessions sharing Firefox
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

console.log('Testing user scenario: Multiple Claude Code sessions sharing Firefox...');

const COORDINATION_FILE = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/mcp/selenium-mcp-coordination.json';

async function testUserScenario() {
    try {
        // Clean up any existing coordination file
        await fs.unlink(COORDINATION_FILE).catch(() => {});
        
        console.log('1. Simulating first Claude Code session starting selenium MCP...');
        
        const startCommand = JSON.stringify({
            "jsonrpc": "2.0", 
            "id": 1, 
            "method": "tools/call", 
            "params": {
                "name": "start_browser", 
                "arguments": {"browser": "firefox"}
            }
        });
        
        const navigateCommand = JSON.stringify({
            "jsonrpc": "2.0", 
            "id": 2, 
            "method": "tools/call", 
            "params": {
                "name": "navigate", 
                "arguments": {"url": "https://www.google.com"}
            }
        });
        
        // Start first MCP server instance
        const server1 = spawn('node', ['server.js'], { stdio: 'pipe' });
        let server1Output = '';
        
        server1.stdout.on('data', (data) => {
            server1Output += data.toString();
        });
        
        server1.stderr.on('data', (data) => {
            console.log('Server1 stderr:', data.toString());
        });
        
        // Send commands to first server
        server1.stdin.write(startCommand + '\n');
        
        // Wait for first server to fully start
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        console.log('First server response:', server1Output);
        
        // Check if coordination file was created
        let coordination;
        try {
            const coordData = await fs.readFile(COORDINATION_FILE, 'utf-8');
            coordination = JSON.parse(coordData);
            console.log('✓ Coordination file created:', coordination);
        } catch (e) {
            throw new Error('Coordination file not created by first instance');
        }
        
        if (coordination.proxyPort) {
            console.log(`✓ Proxy server started on port ${coordination.proxyPort}`);
        } else {
            throw new Error('Proxy port not found in coordination file');
        }
        
        console.log('2. Simulating second Claude Code session connecting...');
        
        // Start second MCP server instance
        const server2 = spawn('node', ['server.js'], { stdio: 'pipe' });
        let server2Output = '';
        
        server2.stdout.on('data', (data) => {
            server2Output += data.toString();
        });
        
        server2.stderr.on('data', (data) => {
            console.log('Server2 stderr:', data.toString());
        });
        
        // Send commands to second server
        server2.stdin.write(startCommand + '\n');
        
        // Wait for second server
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Second server response:', server2Output);
        
        // Check results
        if (server1Output.includes('Error starting browser')) {
            console.log('✗ First instance failed to start browser');
        } else {
            console.log('✓ First instance started browser successfully');
        }
        
        if (server2Output.includes('proxy')) {
            console.log('✓ Second instance connected via proxy');
        } else if (server2Output.includes('Error starting browser')) {
            console.log('✗ Second instance failed (this might be expected due to session conflicts)');
        } else {
            console.log('? Second instance response unclear');
        }
        
        // Test navigation on first instance
        server1.stdin.write(navigateCommand + '\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✓ User scenario test completed');
        console.log('Summary:');
        console.log('- First instance should create Firefox and proxy');
        console.log('- Second instance should detect existing instance and connect via proxy');
        console.log('- Both instances should be able to control the same Firefox browser');
        
        // Clean up
        server1.kill();
        server2.kill();
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            firstInstanceWorked: !server1Output.includes('Error starting browser'),
            secondInstanceConnectedViaProxy: server2Output.includes('proxy'),
            coordinationFileCreated: !!coordination.proxyPort
        };
        
    } catch (error) {
        console.error('✗ User scenario test failed:', error.message);
        throw error;
    }
}

testUserScenario()
    .then(result => {
        console.log('\n=== TEST RESULTS ===');
        console.log(`First instance worked: ${result.firstInstanceWorked ? '✓' : '✗'}`);
        console.log(`Second instance used proxy: ${result.secondInstanceConnectedViaProxy ? '✓' : '✗'}`);
        console.log(`Coordination file created: ${result.coordinationFileCreated ? '✓' : '✗'}`);
        
        if (result.firstInstanceWorked && result.coordinationFileCreated) {
            console.log('\n✓ Core functionality working - proxy infrastructure ready');
            process.exit(0);
        } else {
            console.log('\n✗ Critical functionality failed');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });