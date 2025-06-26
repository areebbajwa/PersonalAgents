#!/usr/bin/env node

import * as browserManager from './browser-manager.js';
import * as screenshotManager from './screenshot-manager.js';
import chalk from 'chalk';
import { promises as fs } from 'fs';

// Execute a batch of commands
export async function executeBatch(commands) {
    const results = [];
    
    try {
        for (const cmd of commands) {
            console.log(chalk.gray(`Executing: ${cmd.action} ${cmd.args ? cmd.args.join(' ') : ''}`));
            
            let result;
            switch (cmd.action) {
                case 'launch':
                    result = await browserManager.launchBrowser(cmd.options || {});
                    break;
                    
                case 'navigate':
                    result = await browserManager.navigate(cmd.url);
                    // Take screenshot
                    const navScreenshot = screenshotManager.getScreenshotPath(
                        screenshotManager.generateScreenshotFilename('navigate')
                    );
                    await browserManager.takeScreenshot(navScreenshot);
                    result.screenshot = navScreenshot;
                    break;
                    
                case 'click':
                    result = await browserManager.clickElement(cmd.by, cmd.value, cmd.timeout);
                    // Take screenshot
                    const clickScreenshot = screenshotManager.getScreenshotPath(
                        screenshotManager.generateScreenshotFilename('click')
                    );
                    await browserManager.takeScreenshot(clickScreenshot);
                    result.screenshot = clickScreenshot;
                    break;
                    
                case 'type':
                    result = await browserManager.sendKeys(cmd.by, cmd.value, cmd.text, cmd.options || {});
                    // Take screenshot
                    const typeScreenshot = screenshotManager.getScreenshotPath(
                        screenshotManager.generateScreenshotFilename('type')
                    );
                    await browserManager.takeScreenshot(typeScreenshot);
                    result.screenshot = typeScreenshot;
                    break;
                    
                case 'text':
                    result = await browserManager.getElementText(cmd.by, cmd.value, cmd.timeout);
                    break;
                    
                case 'screenshot':
                    const path = cmd.path || screenshotManager.getScreenshotPath(
                        screenshotManager.generateScreenshotFilename('manual')
                    );
                    result = await browserManager.takeScreenshot(path);
                    break;
                    
                case 'key':
                    result = await browserManager.pressKey(cmd.key);
                    break;
                    
                case 'hover':
                    result = await browserManager.hoverElement(cmd.by, cmd.value, cmd.timeout);
                    break;
                    
                case 'status':
                    result = browserManager.getSessionStatus();
                    break;
                    
                case 'close':
                    result = await browserManager.closeBrowser();
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${cmd.action}`);
            }
            
            results.push({ success: true, command: cmd, result });
            console.log(chalk.green('✓ Success'));
            if (result.screenshot) {
                console.log(chalk.gray(`  Screenshot: ${result.screenshot}`));
            }
            if (result.text !== undefined) {
                console.log(chalk.blue(`  Text: ${result.text}`));
            }
        }
    } catch (error) {
        results.push({ success: false, error: error.message });
        console.log(chalk.red(`✗ Failed: ${error.message}`));
    }
    
    return results;
}

// Parse batch file
export async function parseBatchFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    
    const commands = [];
    for (const line of lines) {
        const parts = line.split(/\s+/);
        const action = parts[0];
        
        switch (action) {
            case 'launch':
                const launchOpts = {};
                if (parts.includes('--headless')) launchOpts.headless = true;
                if (parts.includes('--no-profile')) launchOpts.useProfile = false;
                commands.push({ action, options: launchOpts });
                break;
                
            case 'navigate':
                commands.push({ action, url: parts[1] });
                break;
                
            case 'click':
            case 'text':
            case 'hover':
                const [by, value] = parts[1].split('=');
                commands.push({ action, by, value });
                break;
                
            case 'type':
                const [typeBy, typeValue] = parts[1].split('=');
                const text = parts.slice(2).join(' ');
                commands.push({ action, by: typeBy, value: typeValue, text });
                break;
                
            case 'screenshot':
                commands.push({ action, path: parts[1] });
                break;
                
            case 'key':
                commands.push({ action, key: parts[1] });
                break;
                
            case 'status':
            case 'close':
                commands.push({ action });
                break;
                
            default:
                console.warn(chalk.yellow(`Unknown command: ${action}`));
        }
    }
    
    return commands;
}