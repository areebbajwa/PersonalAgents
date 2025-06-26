#!/usr/bin/env node

import http from 'http';
import * as browserManager from './browser-manager.js';
import * as screenshotManager from './screenshot-manager.js';
import { promises as fs } from 'fs';

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

// Initialize screenshot manager
await screenshotManager.ensureScreenshotDir();

// Track if browser is launched
let browserLaunched = false;

// Create HTTP server
const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/status') {
        const status = browserManager.getSessionStatus();
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
                        result = await browserManager.navigate(command.url);
                        // Take screenshot
                        const navScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('navigate')
                        );
                        await browserManager.takeScreenshot(navScreenshot);
                        result.screenshot = navScreenshot;
                        break;
                        
                    case 'click':
                        result = await browserManager.clickElement(command.by, command.value, command.timeout);
                        // Take screenshot
                        const clickScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('click')
                        );
                        await browserManager.takeScreenshot(clickScreenshot);
                        result.screenshot = clickScreenshot;
                        break;
                        
                    case 'type':
                        result = await browserManager.sendKeys(
                            command.by, 
                            command.value, 
                            command.text, 
                            command.options || {}
                        );
                        // Take screenshot
                        const typeScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('type')
                        );
                        await browserManager.takeScreenshot(typeScreenshot);
                        result.screenshot = typeScreenshot;
                        break;
                        
                    case 'text':
                        result = await browserManager.getElementText(command.by, command.value, command.timeout);
                        break;
                        
                    case 'screenshot':
                        const path = command.path || screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('manual')
                        );
                        result = await browserManager.takeScreenshot(path);
                        break;
                        
                    case 'key':
                        result = await browserManager.pressKey(command.key);
                        break;
                        
                    case 'hover':
                        result = await browserManager.hoverElement(command.by, command.value, command.timeout);
                        // Take screenshot
                        const hoverScreenshot = screenshotManager.getScreenshotPath(
                            screenshotManager.generateScreenshotFilename('hover')
                        );
                        await browserManager.takeScreenshot(hoverScreenshot);
                        result.screenshot = hoverScreenshot;
                        break;
                        
                    case 'double-click':
                        result = await browserManager.doubleClickElement(command.by, command.value, command.timeout);
                        break;
                        
                    case 'right-click':
                        result = await browserManager.rightClickElement(command.by, command.value, command.timeout);
                        break;
                        
                    case 'upload':
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
                        result = browserManager.getSessionStatus();
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
                res.writeHead(200);
                res.end(JSON.stringify({ success: false, error: error.message }));
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
    // Send ready signal to parent process
    if (process.send) {
        process.send({ type: 'ready', port });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    try {
        const status = browserManager.getSessionStatus();
        if (status.hasSession) {
            await browserManager.closeBrowser();
        }
    } catch (error) {
        // Ignore errors during cleanup
    }
    server.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    try {
        const status = browserManager.getSessionStatus();
        if (status.hasSession) {
            await browserManager.closeBrowser();
        }
    } catch (error) {
        // Ignore errors during cleanup
    }
    server.close();
    process.exit(0);
});