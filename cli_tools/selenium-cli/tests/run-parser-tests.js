#!/usr/bin/env node

import { parseSelector } from '../src/playwright-selector-parser.js';

console.log('Running Playwright Selector Parser Tests...\n');

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
        console.log(`  Expected: ${error.expected}`);
        console.log(`  Actual: ${error.actual}`);
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

console.log('=== Backwards Compatibility ===');
test('preserves id= selector', () => {
    assertEqual(parseSelector('id=submit-button'), 'id=submit-button');
});
test('preserves css= selector', () => {
    assertEqual(parseSelector('css=.submit-button'), 'css=.submit-button');
});
test('preserves xpath= selector', () => {
    assertEqual(parseSelector('xpath=//button[@type="submit"]'), 'xpath=//button[@type="submit"]');
});
test('preserves name= selector', () => {
    assertEqual(parseSelector('name=email'), 'name=email');
});
test('preserves tag= selector', () => {
    assertEqual(parseSelector('tag=button'), 'tag=button');
});
test('preserves class= selector', () => {
    assertEqual(parseSelector('class=btn-primary'), 'class=btn-primary');
});
test('treats unknown format as CSS', () => {
    assertEqual(parseSelector('.my-class'), 'css=.my-class');
    assertEqual(parseSelector('#my-id'), 'css=#my-id');
});

console.log('\n=== Text Selectors ===');
test('text: exact match', () => {
    assertEqual(parseSelector('text:Login'), 'xpath=//*[text()=\'Login\']');
    assertEqual(parseSelector('text:Sign Up'), 'xpath=//*[text()=\'Sign Up\']');
});
test('text*: partial match', () => {
    assertEqual(parseSelector('text*:Add to'), 'xpath=//*[contains(text(),\'Add to\')]');
    assertEqual(parseSelector('text*:cart'), 'xpath=//*[contains(text(),\'cart\')]');
});
test('text with single quotes', () => {
    assertEqual(parseSelector('text:It\'s working'), 'xpath=//*[text()="It\'s working"]');
});
test('text with double quotes', () => {
    assertEqual(parseSelector('text:"Hello"'), 'xpath=//*[text()=\'"Hello"\']');
});
test('text with both quotes', () => {
    assertEqual(parseSelector('text:He said "Hi" and I\'m happy'), 
        'xpath=//*[text()=concat("He said ", "\"", "Hi", "\"", " and I", "\'", "m happy")]');
});

console.log('\n=== ARIA Selectors ===');
test('role: selector', () => {
    assertEqual(parseSelector('role:button'), 'xpath=//*[@role=\'button\']');
    assertEqual(parseSelector('role:navigation'), 'xpath=//*[@role=\'navigation\']');
});
test('aria: with name attribute', () => {
    assertEqual(parseSelector('aria:button[name="Submit"]'), 
        'xpath=//*[@role=\'button\' and @aria-label=\'Submit\']');
});
test('aria: without attributes', () => {
    assertEqual(parseSelector('aria:button'), 'xpath=//*[@role=\'button\']');
});

console.log('\n=== Attribute Selectors ===');
test('placeholder: selector', () => {
    assertEqual(parseSelector('placeholder:Enter email'), 'xpath=//*[@placeholder=\'Enter email\']');
});
test('alt: selector', () => {
    assertEqual(parseSelector('alt:Company Logo'), 'xpath=//*[@alt=\'Company Logo\']');
});
test('title: selector', () => {
    assertEqual(parseSelector('title:Help'), 'xpath=//*[@title=\'Help\']');
});
test('data-testid: selector', () => {
    assertEqual(parseSelector('data-testid:submit-form'), 'xpath=//*[@data-testid=\'submit-form\']');
});

console.log('\n=== Visibility Filters ===');
test(':visible filter', () => {
    assertEqual(parseSelector('text:Submit:visible'), 
        'xpath=//*[text()=\'Submit\' and not(@hidden) and not(@style="display: none;")]');
});
test(':enabled filter', () => {
    assertEqual(parseSelector('role:button:enabled'), 
        'xpath=//*[@role=\'button\' and not(@disabled)]');
});

console.log('\n=== Nth Selection ===');
test('nth=0 (first element)', () => {
    assertEqual(parseSelector('role:button >> nth=0'), 'xpath=(//*[@role=\'button\'])[1]');
});
test('nth=2 (third element)', () => {
    assertEqual(parseSelector('role:button >> nth=2'), 'xpath=(//*[@role=\'button\'])[3]');
});

console.log('\n=== Chained Selectors ===');
test('simple chain', () => {
    assertEqual(parseSelector('role:navigation >> text:Home'), 
        'chain:xpath=//*[@role=\'navigation\'] >> xpath=//*[text()=\'Home\']');
});
test('triple chain', () => {
    assertEqual(parseSelector('role:main >> role:form >> text:Submit'),
        'chain:xpath=//*[@role=\'main\'] >> xpath=//*[@role=\'form\'] >> xpath=//*[text()=\'Submit\']');
});

console.log('\n=== Edge Cases ===');
test('empty text selector', () => {
    assertEqual(parseSelector('text:'), 'xpath=//*[text()=\'\']');
});
test('special characters', () => {
    assertEqual(parseSelector('text:$19.99'), 'xpath=//*[text()=\'$19.99\']');
    assertEqual(parseSelector('placeholder:user@example.com'), 'xpath=//*[@placeholder=\'user@example.com\']');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);