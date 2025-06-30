// Default session management for single commands
// Automatically creates and manages a default persistent session

import * as persistentSession from './persistent-session.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SESSION_NAME = '__default__';

// Ensure default session exists
export async function ensureDefaultSession(options = {}) {
    const sessionInfo = await persistentSession.loadSessionInfo(DEFAULT_SESSION_NAME);
    
    // Check if session exists and is running
    if (sessionInfo && await persistentSession.isSessionRunning(sessionInfo)) {
        return sessionInfo;
    }
    
    // Create new default session
    console.log('Starting default browser session...');
    
    // Find available port
    const port = options.port || (9600 + Math.floor(Math.random() * 400));
    
    // Start session server
    const serverPath = path.join(__dirname, 'session-server.js');
    const serverProcess = spawn('node', [serverPath, DEFAULT_SESSION_NAME, port.toString()], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: { ...process.env }
    });
    
    // Capture stdout/stderr for debugging
    let stdout = '';
    let stderr = '';
    
    serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });
    
    return new Promise((resolve, reject) => {
        let messageReceived = false;
        
        serverProcess.on('message', async (msg) => {
            messageReceived = true;
            if (msg.type === 'ready') {
                // Save session info
                await persistentSession.saveSessionInfo(DEFAULT_SESSION_NAME, {
                    port: msg.port,
                    pid: serverProcess.pid,
                    created: new Date().toISOString(),
                    isDefault: true
                });
                
                serverProcess.unref();
                
                resolve({ port: msg.port });
            }
        });
        
        serverProcess.on('error', reject);
        
        setTimeout(() => {
            if (!messageReceived) {
                console.error('Session server stdout:', stdout);
                console.error('Session server stderr:', stderr);
                reject(new Error('Default session server failed to start'));
            }
        }, 30000); // Increased timeout to 30 seconds for profile copying
    });
}

// Send command to default session
export async function sendToDefaultSession(command, options = {}) {
    const sessionInfo = await ensureDefaultSession(options);
    return await persistentSession.sendCommandToSession(sessionInfo, command);
}

// Check if using default session
export function isDefaultSession(sessionName) {
    return sessionName === DEFAULT_SESSION_NAME;
}

// Get default session info
export async function getDefaultSessionInfo() {
    return await persistentSession.loadSessionInfo(DEFAULT_SESSION_NAME);
}