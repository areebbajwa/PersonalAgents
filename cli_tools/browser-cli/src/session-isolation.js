import crypto from 'crypto';
import os from 'os';
import path from 'path';

// Generate unique session ID for this process
export function generateSessionId() {
    return `browser-cli-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
}

// Get isolated temp directory for this session
export function getSessionTempDir(sessionId) {
    return path.join(os.tmpdir(), sessionId);
}

// Get unique geckodriver port based on session
export function getGeckodriverPort(sessionId) {
    // Use a hash of session ID to generate a port in range 9515-9999
    const hash = crypto.createHash('md5').update(sessionId).digest();
    const portOffset = hash.readUInt16BE(0) % 485; // 485 = 9999 - 9515 + 1
    return 9515 + portOffset;
}

// Get unique Firefox profile directory for isolation
export function getIsolatedProfileDir(sessionId) {
    return path.join(os.tmpdir(), sessionId, 'firefox-profile');
}