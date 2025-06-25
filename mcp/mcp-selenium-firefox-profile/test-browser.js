#!/usr/bin/env node

import pkg from 'selenium-webdriver';
const { Builder } = pkg;
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';

async function testBrowser() {
    console.log('Testing Firefox browser startup...');
    
    try {
        const firefoxOptions = new FirefoxOptions();
        
        console.log('Building driver...');
        const driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(firefoxOptions)
            .build();
        
        console.log('Driver created successfully!');
        
        // Navigate to a test page
        console.log('Navigating to Google...');
        await driver.get('https://www.google.com');
        
        console.log('Navigation successful!');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Close the browser
        console.log('Closing browser...');
        await driver.quit();
        
        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Error during test:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testBrowser();