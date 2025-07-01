#!/usr/bin/env node

import * as browserManager from '../src/browser-manager.js';
import * as screenshotManager from '../src/screenshot-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create test HTML page
async function createTestPage() {
    const testHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Interactive Elements Test Page</title>
</head>
<body>
    <h1>Test Page for Interactive Elements</h1>
    
    <!-- Links -->
    <a href="https://example.com" id="test-link">Test Link</a>
    <a href="#section">Anchor Link</a>
    
    <!-- Buttons -->
    <button id="test-button">Click Me</button>
    <button disabled>Disabled Button</button>
    <button style="display: none;">Hidden Button</button>
    
    <!-- Form Inputs -->
    <input type="text" id="text-input" name="username" placeholder="Enter username">
    <input type="password" name="password" placeholder="Enter password">
    <input type="email" name="email" class="form-input email-input">
    <input type="hidden" name="csrf" value="token123">
    
    <!-- Select -->
    <select name="country" id="country-select">
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
    </select>
    
    <!-- Textarea -->
    <textarea name="comments" placeholder="Enter comments"></textarea>
    
    <!-- ARIA elements -->
    <div role="button" tabindex="0" aria-label="Custom Button">Custom Button</div>
    <span role="link" tabindex="0">Custom Link</span>
    
    <!-- Onclick element -->
    <div onclick="alert('clicked')" class="clickable-div">Clickable Div</div>
    
    <!-- Tabindex element -->
    <div tabindex="1" class="focusable">Focusable Element</div>
    <div tabindex="-1">Not Focusable</div>
</body>
</html>`;
    
    const testFilePath = path.join(__dirname, 'test-page.html');
    await fs.writeFile(testFilePath, testHtml);
    return `file://${testFilePath}`;
}

// Run tests
async function runTests() {
    console.log('Starting interactive elements tests...');
    
    let testFilePath = null;
    
    try {
        // Create test page
        const testPageUrl = await createTestPage();
        testFilePath = path.join(__dirname, 'test-page.html');
        
        // Launch browser
        console.log('Launching browser...');
        await browserManager.launchBrowser({ headless: true });
        
        // Navigate to test page
        console.log('Navigating to test page...');
        await browserManager.navigate(testPageUrl);
        
        // Wait a moment for page to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get interactive elements
        console.log('Getting interactive elements...');
        const result = await browserManager.getInteractiveElements();
        
        console.log(`\nFound ${result.count} interactive elements`);
        
        // Verify expected elements
        const expectedElements = [
            { tag: 'a', id: 'test-link', text: 'Test Link' },
            { tag: 'a', text: 'Anchor Link' },
            { tag: 'button', id: 'test-button', text: 'Click Me' },
            { tag: 'input', id: 'text-input', name: 'username' },
            { tag: 'input', name: 'password', type: 'password' },
            { tag: 'input', name: 'email', class: 'form-input email-input' },
            { tag: 'select', id: 'country-select', name: 'country' },
            { tag: 'textarea', name: 'comments' },
            { tag: 'div', role: 'button', ariaLabel: 'Custom Button' },
            { tag: 'span', role: 'link' },
            { tag: 'div', class: 'clickable-div' },
            { tag: 'div', class: 'focusable' }
        ];
        
        // Check that we found the expected number of elements
        if (result.count < expectedElements.length) {
            throw new Error(`Expected at least ${expectedElements.length} elements, but found ${result.count}`);
        }
        
        // Verify some key elements exist
        const foundIds = result.elements.map(el => el.id).filter(id => id);
        const expectedIds = ['test-link', 'test-button', 'text-input', 'country-select'];
        
        for (const expectedId of expectedIds) {
            if (!foundIds.includes(expectedId)) {
                throw new Error(`Expected element with id="${expectedId}" not found`);
            }
        }
        
        // Check that hidden and disabled elements were filtered out
        const hiddenButton = result.elements.find(el => el.text === 'Hidden Button');
        const disabledButton = result.elements.find(el => el.text === 'Disabled Button');
        const hiddenInput = result.elements.find(el => el.type === 'hidden');
        
        if (hiddenButton) {
            throw new Error('Hidden button should not be included');
        }
        if (disabledButton) {
            throw new Error('Disabled button should not be included');
        }
        if (hiddenInput) {
            throw new Error('Hidden input should not be included');
        }
        
        // Print some sample elements
        console.log('\nSample elements found:');
        result.elements.slice(0, 5).forEach(el => {
            console.log(`- ${el.tag}${el.id ? '#' + el.id : ''}${el.class ? '.' + el.class.split(' ')[0] : ''}: "${el.text || el.placeholder || el.ariaLabel || '(no text)'}" [${el.cssSelector}]`);
        });
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        // Clean up
        try {
            await browserManager.closeBrowser();
        } catch (e) {
            // Ignore cleanup errors
        }
        
        if (testFilePath) {
            try {
                await fs.unlink(testFilePath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}

// Run tests
runTests().catch(console.error);