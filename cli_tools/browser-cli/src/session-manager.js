import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Session file for maintaining state between CLI calls
const SESSION_FILE = path.join(os.tmpdir(), 'selenium-cli-session.json');

export async function saveSession(sessionData) {
    try {
        await fs.writeFile(SESSION_FILE, JSON.stringify(sessionData, null, 2));
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

export async function loadSession() {
    try {
        const data = await fs.readFile(SESSION_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Session file doesn't exist or is invalid
        return null;
    }
}

export async function clearSession() {
    try {
        await fs.unlink(SESSION_FILE);
    } catch (error) {
        // File might not exist, that's ok
    }
}

export async function updateSession(updates) {
    const current = await loadSession() || {};
    const updated = { ...current, ...updates, lastActivity: Date.now() };
    await saveSession(updated);
    return updated;
}