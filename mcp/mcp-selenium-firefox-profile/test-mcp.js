#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Testing MCP server startup...');

const serverProcess = spawn('/Users/areeb2/.nvm/versions/node/v22.15.1/bin/node', [
    '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/mcp/mcp-selenium-firefox-profile/server.js'
], {
    stdio: ['pipe', 'pipe', 'pipe']
});

serverProcess.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
});

serverProcess.stderr.on('data', (data) => {
    console.error('STDERR:', data.toString());
});

serverProcess.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});

serverProcess.on('error', (err) => {
    console.error('Process error:', err);
});

// Send MCP initialization
setTimeout(() => {
    const initMessage = JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
                name: "test-client",
                version: "1.0.0"
            }
        },
        id: 1
    }) + '\n';
    
    console.log('Sending init message:', initMessage);
    serverProcess.stdin.write(initMessage);
}, 1000);

// Keep process alive
setTimeout(() => {
    console.log('Test complete, exiting...');
    serverProcess.kill();
    process.exit(0);
}, 10000);