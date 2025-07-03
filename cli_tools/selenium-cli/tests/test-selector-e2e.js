#!/usr/bin/env node

/**
 * End-to-end test for Playwright selectors
 * This test verifies that selectors are properly converted and work with Selenium
 */

import { parseSelector } from '../src/playwright-selector-parser-v2.js';
import * as browserManager from '../src/browser-manager.js';

console.log('Running Selector E2E Tests...\n');

let passed = 0;
let failed = 0;

async function test(description, testFn) {
    try {
        await testFn();
        console.log(`✓ ${description}`);
        passed++;
    } catch (error) {
        console.log(`✗ ${description}`);
        console.log(`  ${error.message}`);
        failed++;
    }
}

async function runTests() {
    console.log('=== Testing Selector Conversion & Browser Integration ===\n');
    
    // Test that selectors are properly converted
    await test('Playwright selectors convert to valid Selenium format', async () => {
        const tests = [
            { input: 'text:Login', expected: 'xpath=//*[text()=\'Login\']' },
            { input: 'role:button', expected: 'xpath=//*[@role=\'button\']' },
            { input: 'placeholder:Email', expected: 'xpath=//*[@placeholder=\'Email\']' },
            { input: 'id=button', expected: 'id=button' }, // backwards compat
        ];
        
        for (const { input, expected } of tests) {
            const result = parseSelector(input);
            if (result !== expected) {
                throw new Error(`Expected ${input} to convert to ${expected}, got ${result}`);
            }
        }
    });
    
    // Test browser manager can parse the converted selectors
    await test('Converted selectors are valid for browser manager', async () => {
        const testCases = [
            'text:Submit',
            'role:button',
            'placeholder:Search',
            'data-testid:login-btn'
        ];
        
        for (const selector of testCases) {
            const converted = parseSelector(selector);
            const [strategy, ...valueParts] = converted.split('=');
            const value = valueParts.join('=');
            
            if (!strategy || !value) {
                throw new Error(`Invalid conversion for ${selector}: ${converted}`);
            }
            
            // Verify strategy is valid
            const validStrategies = ['id', 'css', 'xpath', 'name', 'tag', 'class'];
            if (!validStrategies.includes(strategy)) {
                throw new Error(`Invalid strategy ${strategy} for selector ${selector}`);
            }
        }
    });
    
    // Test chained selector handling
    await test('Chained selectors are properly marked', async () => {
        const chained = parseSelector('role:form >> text:Submit');
        if (!chained.startsWith('chain:')) {
            throw new Error('Chained selector should be marked with chain: prefix');
        }
    });
    
    // Test visibility filters
    await test('Visibility filters are properly applied', async () => {
        const visible = parseSelector('text:Submit:visible');
        if (!visible.includes('not(@hidden)')) {
            throw new Error('Visible filter not properly applied');
        }
        
        const enabled = parseSelector('role:button:enabled');
        if (!enabled.includes('not(@disabled)')) {
            throw new Error('Enabled filter not properly applied');
        }
    });
    
    // Test nth selection
    await test('Nth selection is properly applied', async () => {
        const nth = parseSelector('role:button >> nth=2');
        if (!nth.includes('[3]')) {  // 0-based to 1-based conversion
            throw new Error('Nth index not properly converted');
        }
    });
    
    console.log('\n=== Full Browser Test (Manual Verification) ===');
    console.log('To test with a real browser, run these commands:');
    console.log('');
    console.log('  # Navigate to a test page');
    console.log('  selenium-cli navigate https://example.com');
    console.log('');
    console.log('  # Test Playwright selectors');
    console.log('  selenium-cli click "text:More information..."');
    console.log('  selenium-cli screenshot');
    console.log('');
    
    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log(`========================================\n`);
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);