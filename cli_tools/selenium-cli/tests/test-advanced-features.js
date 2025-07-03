#!/usr/bin/env node

import { parseSelector } from '../src/playwright-selector-parser.js';

console.log('Running Advanced Features Tests...\n');

let passed = 0;
let failed = 0;

function test(description, testFn) {
    try {
        testFn();
        console.log(`✓ ${description}`);
        passed++;
    } catch (error) {
        console.log(`✗ ${description}`);
        console.log(`  ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        const error = new Error(message || `Expected ${expected} but got ${actual}`);
        error.expected = expected;
        error.actual = actual;
        throw error;
    }
}

console.log('=== Chained Selector Tests ===');

test('simple chained selector', () => {
    const result = parseSelector('role:form >> text:Submit');
    assertEqual(result, 'chain:xpath=//*[@role=\'form\'] >> xpath=//*[text()=\'Submit\']');
});

test('triple chained selector', () => {
    const result = parseSelector('role:main >> role:form >> text:Submit');
    assertEqual(result, 'chain:xpath=//*[@role=\'main\'] >> xpath=//*[@role=\'form\'] >> xpath=//*[text()=\'Submit\']');
});

test('chained with different selector types', () => {
    const result = parseSelector('id=form >> text:Submit');
    assertEqual(result, 'chain:id=form >> xpath=//*[text()=\'Submit\']');
});

test('chained with placeholder and text', () => {
    const result = parseSelector('placeholder:Email >> text:@');
    assertEqual(result, 'chain:xpath=//*[@placeholder=\'Email\'] >> xpath=//*[text()=\'@\']');
});

console.log('\n=== Nth Selection Tests ===');

test('nth=0 for first element', () => {
    const result = parseSelector('role:button >> nth=0');
    assertEqual(result, 'xpath=(//*[@role=\'button\'])[1]');
});

test('nth=2 for third element', () => {
    const result = parseSelector('role:button >> nth=2');
    assertEqual(result, 'xpath=(//*[@role=\'button\'])[3]');
});

test('nth with text selector', () => {
    const result = parseSelector('text:Click me >> nth=1');
    assertEqual(result, 'xpath=(//*[text()=\'Click me\'])[2]');
});

test('nth with placeholder selector', () => {
    const result = parseSelector('placeholder:Search >> nth=0');
    assertEqual(result, 'xpath=(//*[@placeholder=\'Search\'])[1]');
});

console.log('\n=== Visibility Filter Tests ===');

test(':visible filter with text selector', () => {
    const result = parseSelector('text:Submit:visible');
    assertEqual(result, 'xpath=//*[text()=\'Submit\' and not(@hidden) and not(@style="display: none;")]');
});

test(':visible filter with role selector', () => {
    const result = parseSelector('role:button:visible');
    assertEqual(result, 'xpath=//*[@role=\'button\' and not(@hidden) and not(@style="display: none;")]');
});

test(':enabled filter with text selector', () => {
    const result = parseSelector('text:Submit:enabled');
    assertEqual(result, 'xpath=//*[text()=\'Submit\' and not(@disabled)]');
});

test(':enabled filter with role selector', () => {
    const result = parseSelector('role:button:enabled');
    assertEqual(result, 'xpath=//*[@role=\'button\' and not(@disabled)]');
});

test(':visible filter with placeholder selector', () => {
    const result = parseSelector('placeholder:Email:visible');
    assertEqual(result, 'xpath=//*[@placeholder=\'Email\' and not(@hidden) and not(@style="display: none;")]');
});

console.log('\n=== Complex Combination Tests ===');

test('chained selector with nth at end', () => {
    const result = parseSelector('role:form >> role:textbox >> nth=1');
    assertEqual(result, 'chain:xpath=//*[@role=\'form\'] >> xpath=(//*[@role=\'textbox\'])[2]');
});

test('text with quotes and visibility', () => {
    const result = parseSelector('text:"Save & Continue":visible');
    assertEqual(result, 'xpath=//*[text()=\'"Save & Continue"\' and not(@hidden) and not(@style="display: none;")]');
});

test('alt selector with special characters', () => {
    const result = parseSelector('alt:User\'s Profile Picture');
    assertEqual(result, 'xpath=//*[@alt="User\'s Profile Picture"]');
});

test('data-testid with numbers and dashes', () => {
    const result = parseSelector('data-testid:form-submit-btn-123');
    assertEqual(result, 'xpath=//*[@data-testid=\'form-submit-btn-123\']');
});

console.log('\n=== Edge Cases ===');

test('empty text in chain', () => {
    const result = parseSelector('role:form >> text:');
    assertEqual(result, 'chain:xpath=//*[@role=\'form\'] >> xpath=//*[text()=\'\']');
});

test('selector with multiple equals signs', () => {
    const result = parseSelector('xpath=//input[@value="a=b"]');
    assertEqual(result, 'xpath=//input[@value="a=b"]');
});

test('chained selector with xpath containing >>', () => {
    const result = parseSelector('xpath=//div[contains(text(),"a >> b")] >> text:Submit');
    assertEqual(result, 'chain:xpath=//div[contains(text(),"a >> b")] >> xpath=//*[text()=\'Submit\']');
});

console.log('\n=== Browser Manager Integration Tests ===');

console.log('Note: These tests verify the chain parsing for browser-manager.js');

test('chain value parsing for browser manager', () => {
    const chainSelector = parseSelector('role:form >> text:Submit');
    const [strategy, value] = chainSelector.split(':');
    assertEqual(strategy, 'chain');
    
    // Verify the chain value can be split properly
    const parts = value.split(' >> ');
    assertEqual(parts.length, 2);
    assertEqual(parts[0], 'xpath=//*[@role=\'form\']');
    assertEqual(parts[1], 'xpath=//*[text()=\'Submit\']');
});

test('complex chain parsing', () => {
    const chainSelector = parseSelector('id=main >> role:form >> text:Submit');
    const [strategy, value] = chainSelector.split(':', 2);
    assertEqual(strategy, 'chain');
    
    const parts = value.split(' >> ');
    assertEqual(parts.length, 3);
    assertEqual(parts[0], 'id=main');
    assertEqual(parts[1], 'xpath=//*[@role=\'form\']');
    assertEqual(parts[2], 'xpath=//*[text()=\'Submit\']');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);