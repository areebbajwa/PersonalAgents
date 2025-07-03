import { parseSelector } from '../src/playwright-selector-parser-v2.js';
import assert from 'assert';

describe('Playwright Selector Parser', () => {
    describe('Backwards Compatibility', () => {
        it('should preserve existing Selenium selectors', () => {
            assert.strictEqual(parseSelector('id=submit-button'), 'id=submit-button');
            assert.strictEqual(parseSelector('css=.submit-button'), 'css=.submit-button');
            assert.strictEqual(parseSelector('xpath=//button[@type="submit"]'), 'xpath=//button[@type="submit"]');
            assert.strictEqual(parseSelector('name=email'), 'name=email');
            assert.strictEqual(parseSelector('tag=button'), 'tag=button');
            assert.strictEqual(parseSelector('class=btn-primary'), 'class=btn-primary');
        });

        it('should treat unknown formats as CSS selectors', () => {
            assert.strictEqual(parseSelector('.my-class'), 'css=.my-class');
            assert.strictEqual(parseSelector('#my-id'), 'css=#my-id');
            assert.strictEqual(parseSelector('button.submit'), 'css=button.submit');
        });
    });

    describe('Text Selectors', () => {
        it('should convert text: selector to exact text XPath', () => {
            assert.strictEqual(parseSelector('text:Login'), 'xpath=//*[text()=\'Login\']');
            assert.strictEqual(parseSelector('text:Sign Up'), 'xpath=//*[text()=\'Sign Up\']');
            assert.strictEqual(parseSelector('text:Hello World'), 'xpath=//*[text()=\'Hello World\']');
        });

        it('should convert text*: selector to partial text XPath', () => {
            assert.strictEqual(parseSelector('text*:Add to'), 'xpath=//*[contains(text(),\'Add to\')]');
            assert.strictEqual(parseSelector('text*:cart'), 'xpath=//*[contains(text(),\'cart\')]');
            assert.strictEqual(parseSelector('text*:Submit'), 'xpath=//*[contains(text(),\'Submit\')]');
        });

        it('should handle text with quotes properly', () => {
            assert.strictEqual(parseSelector('text:It\'s working'), 'xpath=//*[text()="It\'s working"]');
            assert.strictEqual(parseSelector('text:"Hello"'), 'xpath=//*[text()=\'"Hello"\']');
            assert.strictEqual(parseSelector('text:He said "Hi" and I\'m happy'), 
                'xpath=//*[text()=concat("He said ", "\"", "Hi", "\"", " and I", "\'", "m happy")]');
        });
    });

    describe('ARIA Selectors', () => {
        it('should convert role: selector to XPath', () => {
            assert.strictEqual(parseSelector('role:button'), 'xpath=//*[@role=\'button\']');
            assert.strictEqual(parseSelector('role:navigation'), 'xpath=//*[@role=\'navigation\']');
            assert.strictEqual(parseSelector('role:textbox'), 'xpath=//*[@role=\'textbox\']');
        });

        it('should convert aria: selector with attributes', () => {
            assert.strictEqual(parseSelector('aria:button[name="Submit"]'), 
                'xpath=//*[@role=\'button\' and @aria-label=\'Submit\']');
            assert.strictEqual(parseSelector('aria:textbox[name="Email"]'), 
                'xpath=//*[@role=\'textbox\' and @aria-label=\'Email\']');
        });

        it('should handle aria: selector without attributes', () => {
            assert.strictEqual(parseSelector('aria:button'), 'xpath=//*[@role=\'button\']');
        });
    });

    describe('Attribute Selectors', () => {
        it('should convert placeholder: selector', () => {
            assert.strictEqual(parseSelector('placeholder:Enter email'), 
                'xpath=//*[@placeholder=\'Enter email\']');
            assert.strictEqual(parseSelector('placeholder:Search...'), 
                'xpath=//*[@placeholder=\'Search...\']');
        });

        it('should convert alt: selector', () => {
            assert.strictEqual(parseSelector('alt:Company Logo'), 
                'xpath=//*[@alt=\'Company Logo\']');
            assert.strictEqual(parseSelector('alt:Profile Picture'), 
                'xpath=//*[@alt=\'Profile Picture\']');
        });

        it('should convert title: selector', () => {
            assert.strictEqual(parseSelector('title:Help'), 
                'xpath=//*[@title=\'Help\']');
            assert.strictEqual(parseSelector('title:Close Window'), 
                'xpath=//*[@title=\'Close Window\']');
        });

        it('should convert data-testid: selector', () => {
            assert.strictEqual(parseSelector('data-testid:submit-form'), 
                'xpath=//*[@data-testid=\'submit-form\']');
            assert.strictEqual(parseSelector('data-testid:user-profile'), 
                'xpath=//*[@data-testid=\'user-profile\']');
        });
    });

    describe('Visibility Filters', () => {
        it('should handle :visible filter', () => {
            assert.strictEqual(parseSelector('text:Submit:visible'), 
                'xpath=//*[text()=\'Submit\' and not(@hidden) and not(@style="display: none;")]');
            assert.strictEqual(parseSelector('role:button:visible'), 
                'xpath=//*[@role=\'button\' and not(@hidden) and not(@style="display: none;")]');
        });

        it('should handle :enabled filter', () => {
            assert.strictEqual(parseSelector('text:Submit:enabled'), 
                'xpath=//*[text()=\'Submit\' and not(@disabled)]');
            assert.strictEqual(parseSelector('role:button:enabled'), 
                'xpath=//*[@role=\'button\' and not(@disabled)]');
        });
    });

    describe('Nth Selection', () => {
        it('should handle nth= selector', () => {
            assert.strictEqual(parseSelector('role:button >> nth=0'), 
                'xpath=(//*[@role=\'button\'])[1]');
            assert.strictEqual(parseSelector('role:button >> nth=2'), 
                'xpath=(//*[@role=\'button\'])[3]');
            assert.strictEqual(parseSelector('text:Click me >> nth=1'), 
                'xpath=(//*[text()=\'Click me\'])[2]');
        });
    });

    describe('Chained Selectors', () => {
        it('should return special format for chained selectors', () => {
            assert.strictEqual(parseSelector('role:navigation >> text:Home'), 
                'chain:xpath=//*[@role=\'navigation\'] >> xpath=//*[text()=\'Home\']');
            assert.strictEqual(parseSelector('role:form >> role:textbox >> nth=1'), 
                'chain:xpath=//*[@role=\'form\'] >> xpath=(//*[@role=\'textbox\'])[2]');
        });

        it('should handle multiple chains', () => {
            const result = parseSelector('role:main >> role:form >> text:Submit');
            assert.strictEqual(result, 
                'chain:xpath=//*[@role=\'main\'] >> xpath=//*[@role=\'form\'] >> xpath=//*[text()=\'Submit\']');
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle special characters in text', () => {
            assert.strictEqual(parseSelector('text:$19.99'), 'xpath=//*[text()=\'$19.99\']');
            assert.strictEqual(parseSelector('text*:©2024'), 'xpath=//*[contains(text(),\'©2024\')]');
            assert.strictEqual(parseSelector('placeholder:user@example.com'), 
                'xpath=//*[@placeholder=\'user@example.com\']');
        });

        it('should handle empty values gracefully', () => {
            assert.strictEqual(parseSelector('text:'), 'xpath=//*[text()=\'\']');
            assert.strictEqual(parseSelector('placeholder:'), 'xpath=//*[@placeholder=\'\']');
        });
    });
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running Playwright Selector Parser Tests...\n');
    
    let passed = 0;
    let failed = 0;
    
    const suites = Object.getOwnPropertyNames(describe);
    
    for (const suite of Object.keys(global)) {
        if (suite.startsWith('describe:')) {
            const tests = global[suite];
            console.log(`\n${suite.replace('describe:', '')}:`);
            
            for (const [testName, testFn] of Object.entries(tests)) {
                try {
                    testFn();
                    console.log(`  ✓ ${testName}`);
                    passed++;
                } catch (error) {
                    console.log(`  ✗ ${testName}`);
                    console.log(`    ${error.message}`);
                    failed++;
                }
            }
        }
    }
    
    console.log(`\n\nTest Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    process.exit(failed > 0 ? 1 : 0);
}