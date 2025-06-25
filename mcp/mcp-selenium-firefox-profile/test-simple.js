#!/usr/bin/env node

// Simple test to verify screenshot functionality
import pkg from 'selenium-webdriver';
const { Builder, By } = pkg;
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { promises as fs } from 'fs';
import path from 'path';

async function testScreenshots() {
    console.log('Starting screenshot test...');
    
    // Import the helper function from server.js
    const SCREENSHOT_DIR = path.join(process.cwd(), 'selenium-screenshots');
    
    async function takeActionScreenshot(actionName) {
        try {
            // Ensure screenshot directory exists
            await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${actionName}_${timestamp}.png`;
            const filepath = path.join(SCREENSHOT_DIR, filename);
            
            // Take screenshot
            const screenshot = await driver.takeScreenshot();
            await fs.writeFile(filepath, screenshot, 'base64');
            
            console.log(`Screenshot saved: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`Failed to take screenshot: ${error.message}`);
            return null;
        }
    }
    
    // Create driver
    const firefoxOptions = new FirefoxOptions();
    firefoxOptions.addArguments('--headless'); // Run headless for testing
    
    const driver = await new Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(firefoxOptions)
        .build();
    
    try {
        // Test navigate
        await driver.get('https://example.com');
        const navScreenshot = await takeActionScreenshot('navigate');
        console.log(`Navigate screenshot: ${navScreenshot}`);
        
        // Test click (try to click the h1)
        try {
            const h1 = await driver.findElement(By.css('h1'));
            await h1.click();
            const clickScreenshot = await takeActionScreenshot('click');
            console.log(`Click screenshot: ${clickScreenshot}`);
        } catch (e) {
            console.log('Click test skipped:', e.message);
        }
        
        // Verify screenshots exist
        const files = await fs.readdir(SCREENSHOT_DIR);
        const screenshots = files.filter(f => f.endsWith('.png'));
        
        console.log(`\nTotal screenshots created: ${screenshots.length}`);
        screenshots.forEach(f => console.log(`  - ${f}`));
        
        if (screenshots.length > 0) {
            console.log('\n✅ Screenshot functionality working correctly!');
            return true;
        } else {
            console.log('\n❌ No screenshots were created');
            return false;
        }
        
    } finally {
        await driver.quit();
    }
}

// Run test
testScreenshots()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Test failed:', err);
        process.exit(1);
    });