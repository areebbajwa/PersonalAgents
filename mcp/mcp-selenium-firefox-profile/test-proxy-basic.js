#!/usr/bin/env node

// Test script for basic proxy functionality
import pkg from 'selenium-webdriver';
const { Builder } = pkg;

console.log('Testing basic proxy functionality...');

async function testBasicProxy() {
    try {
        // First, start Firefox normally to get marionette running
        console.log('1. Starting Firefox with marionette...');
        const firefoxDriver = new Builder()
            .forBrowser('firefox')
            .build();
        
        await firefoxDriver.get('https://www.google.com');
        console.log('✓ Firefox started and navigated to Google');
        
        // Wait a moment for marionette to stabilize
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to connect via proxy (port 9515)
        console.log('2. Testing proxy connection...');
        try {
            const proxyDriver = new Builder()
                .forBrowser('firefox')
                .usingServer('http://localhost:9515/wd/hub')
                .build();
            
            await proxyDriver.switchTo().newWindow('tab');
            await proxyDriver.get('https://www.github.com');
            console.log('✓ Proxy connection successful - opened new tab');
            
            await proxyDriver.quit();
        } catch (proxyError) {
            console.log('✗ Proxy connection failed:', proxyError.message);
        }
        
        // Clean up
        await firefoxDriver.quit();
        console.log('✓ Test completed');
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        process.exit(1);
    }
}

testBasicProxy();