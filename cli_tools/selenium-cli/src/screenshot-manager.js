import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory - project root relative
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '..', 'selenium-screenshots');

// Ensure screenshot directory exists
export async function ensureScreenshotDir() {
    try {
        await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating screenshot directory:', error);
    }
}

// Clean up old screenshots (older than 24 hours)
export async function cleanupOldScreenshots() {
    try {
        const files = await fs.readdir(SCREENSHOT_DIR);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        for (const file of files) {
            if (file.endsWith('.png')) {
                const filePath = path.join(SCREENSHOT_DIR, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > twentyFourHours) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old screenshot: ${file}`);
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up screenshots:', error);
    }
}

// Generate screenshot filename
export function generateScreenshotFilename(action) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${action}-${timestamp}.png`;
}

// Get screenshot path
export function getScreenshotPath(filename) {
    return path.join(SCREENSHOT_DIR, filename);
}

// Schedule periodic cleanup
let cleanupInterval = null;

export function startPeriodicCleanup() {
    // Run cleanup immediately
    cleanupOldScreenshots();
    
    // Then run every hour
    cleanupInterval = setInterval(() => {
        cleanupOldScreenshots();
    }, 60 * 60 * 1000); // 1 hour
}

export function stopPeriodicCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}