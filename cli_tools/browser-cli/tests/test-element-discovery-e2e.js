#!/usr/bin/env node

import * as defaultSession from '../src/default-session.js';
import * as persistentSession from '../src/persistent-session.js';
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
    <title>E2E Test Page</title>
</head>
<body>
    <h1>E2E Test Page</h1>
    
    <form id="test-form">
        <input type="text" id="username" name="username" placeholder="Username">
        <input type="password" id="password" name="password" placeholder="Password">
        <button type="submit" id="submit-btn">Submit</button>
    </form>
    
    <div id="result" style="display: none;">
        <p>Form submitted!</p>
        <a href="#reset" id="reset-link">Reset Form</a>
    </div>
    
    <script>
        document.getElementById('test-form').addEventListener('submit', function(e) {
            e.preventDefault();
            document.getElementById('test-form').style.display = 'none';
            document.getElementById('result').style.display = 'block';
        });
        
        document.getElementById('reset-link').addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('test-form').style.display = 'block';
            document.getElementById('result').style.display = 'none';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        });
    </script>
</body>
</html>`;
    
    const testFilePath = path.join(__dirname, 'e2e-test-page.html');
    await fs.writeFile(testFilePath, testHtml);
    return `file://${testFilePath}`;
}

// Run E2E tests
async function runTests() {
    console.log('Starting E2E element discovery tests...');
    
    let testFilePath = null;
    
    try {
        // Create and navigate to test page
        const testPageUrl = await createTestPage();
        testFilePath = path.join(__dirname, 'e2e-test-page.html');
        
        console.log('Navigating to test page...');
        const navResult = await defaultSession.sendToDefaultSession({
            action: 'navigate',
            url: testPageUrl
        });
        
        // Check navigate response includes elements
        if (!navResult.elements) {
            throw new Error('Navigate response missing elements field');
        }
        
        console.log(`\nNavigate found ${navResult.elements.count} elements`);
        
        // Verify expected elements in initial page
        const initialElements = navResult.elements.items;
        const usernameInput = initialElements.find(el => el.id === 'username');
        const passwordInput = initialElements.find(el => el.id === 'password');
        const submitButton = initialElements.find(el => el.id === 'submit-btn');
        
        if (!usernameInput) throw new Error('Username input not found in elements');
        if (!passwordInput) throw new Error('Password input not found in elements');
        if (!submitButton) throw new Error('Submit button not found in elements');
        
        console.log('✓ Initial elements found correctly');
        
        // Type in username field
        console.log('\nTyping in username field...');
        const typeResult = await defaultSession.sendToDefaultSession({
            action: 'type',
            by: 'id',
            value: 'username',
            text: 'testuser'
        });
        
        if (!typeResult.elements) {
            throw new Error('Type response missing elements field');
        }
        
        console.log(`Type action found ${typeResult.elements.count} elements`);
        
        // Click submit button
        console.log('\nClicking submit button...');
        const clickResult = await defaultSession.sendToDefaultSession({
            action: 'click',
            by: 'id',
            value: 'submit-btn'
        });
        
        if (!clickResult.elements) {
            throw new Error('Click response missing elements field');
        }
        
        // Check that elements changed after click
        const afterClickElements = clickResult.elements.items;
        const resetLink = afterClickElements.find(el => el.id === 'reset-link');
        const usernameAfterClick = afterClickElements.find(el => el.id === 'username');
        
        if (!resetLink) {
            throw new Error('Reset link not found after form submission');
        }
        
        if (usernameAfterClick) {
            // Username should be hidden after form submission
            throw new Error('Username input should not be visible after form submission');
        }
        
        console.log('✓ Elements updated correctly after form submission');
        
        // Check HTML diff
        if (clickResult.htmlDiff) {
            console.log('\nHTML Diff after click:');
            console.log(`- Size difference: ${clickResult.htmlDiff.htmlSizeDiff} bytes`);
            console.log(`- Text added: ${clickResult.htmlDiff.textAdded} chars`);
            console.log(`- Text removed: ${clickResult.htmlDiff.textRemoved} chars`);
            console.log(`- Total changes: ${clickResult.htmlDiff.totalChanges}`);
        }
        
        console.log('\n✅ All E2E tests passed!');
        
    } catch (error) {
        console.error('❌ E2E test failed:', error.message);
        process.exit(1);
    } finally {
        // Clean up
        try {
            await defaultSession.sendToDefaultSession({ action: 'close' });
            await persistentSession.deleteSessionInfo('__default__');
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