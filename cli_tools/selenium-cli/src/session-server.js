#!/usr/bin/env node

import http from 'http';
import * as browserManager from './browser-manager.js';
import * as screenshotManager from './screenshot-manager.js';
import * as htmlManager from './html-manager.js';
import { promises as fs } from 'fs';
import * as Diff from 'diff';
import * as cheerio from 'cheerio';

// Parse command line arguments
const sessionName = process.argv[2];
const port = parseInt(process.argv[3]);

if (!sessionName || !port) {
    console.error('Usage: session-server <session-name> <port>');
    process.exit(1);
}

// Set test mode if parent process has it
if (process.env.SELENIUM_CLI_TEST) {
    process.env.SELENIUM_CLI_TEST = 'true';
}

// Initialize screenshot and HTML managers
await screenshotManager.ensureScreenshotDir();
await htmlManager.ensureHtmlDir();

// Schedule periodic cleanup of old files
const cleanupInterval = setInterval(async () => {
    await screenshotManager.cleanupOldScreenshots();
    await htmlManager.cleanupOldHtmlFiles();
}, 60 * 60 * 1000); // Run every hour

// Schedule periodic health checks
const healthCheckInterval = setInterval(async () => {
    if (browserLaunched) {
        try {
            const status = await browserManager.getSessionStatus();
            if (!status.hasSession) {
                console.error('Browser session lost during health check - will restart on next command');
                browserLaunched = false;
                // Don't exit - just mark browser as not launched
            }
        } catch (error) {
            console.error('Health check failed:', error.message);
            // Don't exit - browser might just be busy
        }
    }
}, 30000); // Check every 30 seconds (less aggressive)

// Track if browser is launched
let browserLaunched = false;

// Track previous HTML for diff
let previousHtml = null;

// Track if we're in startup phase (IPC channel is available)
let isStartupPhase = true;

// Helper to ensure browser is launched
async function ensureBrowserLaunched(options = {}) {
    if (!browserLaunched) {
        // Default to using Firefox profile unless explicitly disabled
        const launchOptions = {
            useProfile: true,
            ...options
        };
        await browserManager.launchBrowser(launchOptions);
        browserLaunched = true;
    }
}

// Helper to extract text content from HTML for better diff
function extractTextContent(html) {
    try {
        const $ = cheerio.load(html);
        // Remove script and style tags
        $('script, style').remove();
        // Get text content
        return $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error) {
        return html; // Fallback to raw HTML if parsing fails
    }
}

// Helper to save rendered HTML after an action and calculate diff
async function saveActionHtml(action) {
    try {
        const htmlFilename = htmlManager.generateHtmlFilename(action);
        const htmlPath = htmlManager.getHtmlPath(htmlFilename);
        const htmlResult = await browserManager.exportHtml(htmlPath);
        
        // Get current HTML for diff
        const currentHtml = await browserManager.exportHtml(null);
        let htmlDiff = null;
        
        
        if (previousHtml && currentHtml.data) {
            // Extract text content for meaningful diff
            const prevText = extractTextContent(previousHtml);
            const currText = extractTextContent(currentHtml.data);
            
            // Calculate text diff
            const textChanges = Diff.diffWords(prevText, currText);
            
            // Count added/removed text
            let addedChars = 0;
            let removedChars = 0;
            let changedSections = [];
            
            textChanges.forEach(change => {
                if (change.added) {
                    addedChars += change.value.length;
                    if (change.value.trim().length > 0) {
                        changedSections.push(`+"${change.value.trim().substring(0, 50)}${change.value.trim().length > 50 ? '...' : ''}"`);
                    }
                } else if (change.removed) {
                    removedChars += change.value.length;
                    if (change.value.trim().length > 0) {
                        changedSections.push(`-"${change.value.trim().substring(0, 50)}${change.value.trim().length > 50 ? '...' : ''}"`);
                    }
                }
            });
            
            // Calculate HTML structure diff
            const prevLength = previousHtml.length;
            const currLength = currentHtml.data.length;
            
            htmlDiff = {
                htmlSizeDiff: currLength - prevLength,
                textAdded: addedChars,
                textRemoved: removedChars,
                changedSections: changedSections.slice(0, 3), // Show first 3 changes
                totalChanges: changedSections.length
            };
            
        }
        
        // Update previous HTML
        previousHtml = currentHtml.data;
        
        // Get interactive elements
        let elements = null;
        try {
            const elementsResult = await browserManager.getInteractiveElements();
            elements = {
                count: elementsResult.count,
                // Limit to first 50 elements to avoid huge responses
                items: elementsResult.elements.slice(0, 50)
            };
        } catch (elemError) {
            console.error(`Error getting interactive elements for ${action}:`, elemError);
        }
        
        return { path: htmlPath, diff: htmlDiff, elements: elements };
    } catch (error) {
        console.error(`Error saving HTML for ${action}:`, error);
        return null;
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/status') {
        const status = await browserManager.getSessionStatus();
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            sessionName,
            ...status 
        }));
        return;
    }
    
    if (req.url === '/command' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const command = JSON.parse(body);
                let result;
                
                switch (command.action) {
                    case 'launch':
                        if (browserLaunched) {
                            throw new Error('Browser already launched in this session');
                        }
                        result = await browserManager.launchBrowser(command.options || {});
                        browserLaunched = true;
                        break;
                        
                    case 'navigate':
                        await ensureBrowserLaunched(command.options || {})
                        result = await browserManager.navigate(command.url);
                        // Take screenshot
                        const navScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('navigate')
                        );
                        await browserManager.takeScreenshot(navScreenshot);
                        result.screenshot = navScreenshot;
                        // Save HTML
                        const navHtmlResult = await saveActionHtml('navigate');
                        if (navHtmlResult) {
                            result.html = navHtmlResult.path;
                            result.htmlDiff = navHtmlResult.diff;
                            result.elements = navHtmlResult.elements;
                        }
                        break;
                        
                    case 'click':
                        await ensureBrowserLaunched();
                        result = await browserManager.clickElement(command.by, command.value, command.timeout);
                        // Take screenshot
                        const clickScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('click')
                        );
                        await browserManager.takeScreenshot(clickScreenshot);
                        result.screenshot = clickScreenshot;
                        // Save HTML
                        const clickHtmlResult = await saveActionHtml('click');
                        if (clickHtmlResult) {
                            result.html = clickHtmlResult.path;
                            result.htmlDiff = clickHtmlResult.diff;
                            result.elements = clickHtmlResult.elements;
                        }
                        break;
                        
                    case 'type':
                        await ensureBrowserLaunched();
                        result = await browserManager.sendKeys(
                            command.by, 
                            command.value, 
                            command.text, 
                            {
                                timeout: command.timeout,
                                clear: command.clear,
                                pressEnter: command.pressEnter
                            }
                        );
                        // Take screenshot
                        const typeScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('type')
                        );
                        await browserManager.takeScreenshot(typeScreenshot);
                        result.screenshot = typeScreenshot;
                        // Save HTML
                        const typeHtmlResult = await saveActionHtml('type');
                        if (typeHtmlResult) {
                            result.html = typeHtmlResult.path;
                            result.htmlDiff = typeHtmlResult.diff;
                            result.elements = typeHtmlResult.elements;
                        }
                        break;
                        
                    case 'text':
                        await ensureBrowserLaunched();
                        result = await browserManager.getElementText(command.by, command.value, command.timeout);
                        break;
                        
                    case 'screenshot':
                        await ensureBrowserLaunched();
                        const path = command.path || screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('manual')
                        );
                        result = await browserManager.takeScreenshot(path);
                        break;
                        
                    case 'export-html':
                        await ensureBrowserLaunched();
                        result = await browserManager.exportHtml(command.path);
                        break;
                        
                    case 'key':
                        await ensureBrowserLaunched();
                        result = await browserManager.pressKey(command.key);
                        // Take screenshot
                        const keyScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('key')
                        );
                        await browserManager.takeScreenshot(keyScreenshot);
                        result.screenshot = keyScreenshot;
                        // Save HTML after key press
                        const keyHtmlResult = await saveActionHtml('key');
                        if (keyHtmlResult) {
                            result.html = keyHtmlResult.path;
                            result.htmlDiff = keyHtmlResult.diff;
                        }
                        break;
                        
                    case 'hover':
                        await ensureBrowserLaunched();
                        result = await browserManager.hoverElement(command.by, command.value, command.timeout);
                        // Take screenshot
                        const hoverScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('hover')
                        );
                        await browserManager.takeScreenshot(hoverScreenshot);
                        result.screenshot = hoverScreenshot;
                        // Save HTML
                        const hoverHtmlResult = await saveActionHtml('hover');
                        if (hoverHtmlResult) {
                            result.html = hoverHtmlResult.path;
                            result.htmlDiff = hoverHtmlResult.diff;
                        }
                        break;
                        
                    case 'double-click':
                        await ensureBrowserLaunched();
                        result = await browserManager.doubleClickElement(command.by, command.value, command.timeout);
                        break;
                        
                    case 'right-click':
                        await ensureBrowserLaunched();
                        result = await browserManager.rightClickElement(command.by, command.value, command.timeout);
                        break;
                        
                    case 'upload':
                        await ensureBrowserLaunched();
                        result = await browserManager.uploadFile(command.by, command.value, command.filePath, command.timeout);
                        break;
                        
                    case 'drag-drop':
                        result = await browserManager.dragAndDrop(
                            command.sourceBy, command.sourceValue,
                            command.targetBy, command.targetValue,
                            command.timeout
                        );
                        break;
                        
                    case 'status':
                        result = await browserManager.getSessionStatus();
                        break;
                        
                    case 'close':
                        result = await browserManager.closeBrowser();
                        browserLaunched = false;
                        // Exit server after closing browser
                        setTimeout(() => {
                            server.close();
                            process.exit(0);
                        }, 100);
                        break;
                        
                    default:
                        throw new Error(`Unknown action: ${command.action}`);
                }
                
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, result }));
            } catch (error) {
                // Try to save error state HTML and screenshot
                let errorData = { success: false, error: error.message };
                
                // Only save error artifacts for actions that interact with the page
                const interactionActions = ['navigate', 'click', 'type', 'hover', 'double-click', 'right-click', 'upload', 'drag-drop', 'key'];
                if (browserLaunched && interactionActions.includes(command.action)) {
                    try {
                        // Save error screenshot
                        const errorScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename(`error-${command.action}`)
                        );
                        await browserManager.takeScreenshot(errorScreenshot);
                        errorData.screenshot = errorScreenshot;
                        
                        // Save error HTML
                        const errorHtmlResult = await saveActionHtml(`error-${command.action}`);
                        if (errorHtmlResult) {
                            errorData.html = errorHtmlResult.path;
                            errorData.htmlDiff = errorHtmlResult.diff;
                        }
                    } catch (captureError) {
                        console.error('Error capturing error state:', captureError);
                    }
                }
                
                res.writeHead(200);
                res.end(JSON.stringify(errorData));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// Start server
server.listen(port, () => {
    console.log(`Session server '${sessionName}' listening on port ${port}`);
    // Send ready signal to parent process only during startup
    if (process.send && process.connected && isStartupPhase) {
        process.send({ type: 'ready', port }, (error) => {
            if (error) {
                // IPC channel might be closed, this is normal
                console.log('IPC channel not available, continuing without it');
            }
        });
    }
    // After initial startup, we no longer have IPC
    setTimeout(() => {
        isStartupPhase = false;
    }, 1000);
});

// Cleanup on exit
const cleanup = async () => {
    clearInterval(cleanupInterval);
    clearInterval(healthCheckInterval);
    try {
        const status = await browserManager.getSessionStatus();
        if (status.hasSession) {
            await browserManager.closeBrowser();
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
    process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', () => {
    clearInterval(cleanupInterval);
    clearInterval(healthCheckInterval);
});