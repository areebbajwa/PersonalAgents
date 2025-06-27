import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTML directory - within CLI directory
const HTML_DIR = path.join(__dirname, '..', 'html-exports');

// Ensure HTML directory exists
export async function ensureHtmlDir() {
    try {
        await fs.mkdir(HTML_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating HTML directory:', error);
    }
}

// Clean up old HTML files (older than 24 hours)
export async function cleanupOldHtmlFiles() {
    try {
        const files = await fs.readdir(HTML_DIR);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        for (const file of files) {
            if (file.endsWith('.html')) {
                const filePath = path.join(HTML_DIR, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > twentyFourHours) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old HTML file: ${file}`);
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up HTML files:', error);
    }
}

// Generate HTML filename
export function generateHtmlFilename(action) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${action}-${timestamp}.html`;
}

// Get HTML path
export function getHtmlPath(filename) {
    return path.join(HTML_DIR, filename);
}