import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn } from 'child_process';

const SESSION_DIR = path.join(os.homedir(), '.browser-cli-sessions');

// Ensure session directory exists
export async function ensureSessionDir() {
    await fs.mkdir(SESSION_DIR, { recursive: true });
}

// Get session file path
export function getSessionFile(sessionName) {
    return path.join(SESSION_DIR, `${sessionName}.json`);
}

// Save session info
export async function saveSessionInfo(sessionName, info) {
    await ensureSessionDir();
    await fs.writeFile(getSessionFile(sessionName), JSON.stringify(info, null, 2));
}

// Load session info
export async function loadSessionInfo(sessionName) {
    try {
        const data = await fs.readFile(getSessionFile(sessionName), 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

// Delete session info
export async function deleteSessionInfo(sessionName) {
    try {
        await fs.unlink(getSessionFile(sessionName));
    } catch (error) {
        // File might not exist
    }
}

// List all sessions
export async function listSessions() {
    await ensureSessionDir();
    const files = await fs.readdir(SESSION_DIR);
    const sessions = [];
    
    for (const file of files) {
        if (file.endsWith('.json')) {
            const sessionName = file.slice(0, -5);
            const info = await loadSessionInfo(sessionName);
            if (info) {
                sessions.push({ name: sessionName, ...info });
            }
        }
    }
    
    return sessions;
}

// Check if session server is running
export async function isSessionRunning(sessionInfo) {
    if (!sessionInfo || !sessionInfo.port) return false;
    
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${sessionInfo.port}/status`, (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Send command to session server
export async function sendCommandToSession(sessionInfo, command) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(command);
        
        const options = {
            hostname: 'localhost',
            port: sessionInfo.port,
            path: '/command',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.success) {
                        resolve(response.result);
                    } else {
                        // Create error with additional properties
                        const error = new Error(response.error);
                        if (response.screenshot) error.screenshot = response.screenshot;
                        if (response.html) error.html = response.html;
                        reject(error);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        // Add timeout handling
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout: Session server not responding'));
        });
        
        req.on('error', (error) => {
            // Better error messages for common socket issues
            if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
                reject(new Error('Browser session lost. Please restart with: browser-cli close && browser-cli launch'));
            } else if (error.code === 'ECONNREFUSED') {
                reject(new Error('Session server not running. Please restart with: browser-cli launch'));
            } else {
                reject(error);
            }
        });
        
        req.write(data);
        req.end();
    });
}