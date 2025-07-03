/**
 * Enhanced Playwright-style selector parser using popular libraries
 * Uses css-tree for robust CSS parsing and improved error handling
 */

import * as csstree from 'css-tree';

/**
 * Escapes special characters in XPath string literals
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for XPath
 */
function escapeXPath(str) {
    // If string contains both single and double quotes, we need to concat
    if (str.includes('"') && str.includes("'")) {
        // Build concat expression properly
        const parts = [];
        let current = '';
        
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            
            if (char === '"') {
                // End current part if any
                if (current) {
                    parts.push(`"${current}"`);
                    current = '';
                }
                // Add escaped double quote
                parts.push('"\""');
            } else if (char === "'") {
                // End current part if any
                if (current) {
                    parts.push(`"${current}"`);
                    current = '';
                }
                // Add escaped single quote
                parts.push('"\'"');
            } else {
                current += char;
            }
        }
        
        // Add any remaining text
        if (current) {
            parts.push(`"${current}"`);
        }
        
        return 'concat(' + parts.join(', ') + ')';
    }
    // If only single quotes, use double quotes
    if (str.includes("'")) {
        return `"${str}"`;
    }
    // Otherwise use single quotes
    return `'${str}'`;
}

/**
 * Validates CSS selector using css-tree
 * @param {string} cssSelector - The CSS selector to validate
 * @returns {boolean} - True if valid CSS selector
 */
function isValidCSSSelector(cssSelector) {
    try {
        // Parse as a selector list
        csstree.parse(cssSelector, { context: 'selectorList' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Enhanced selector parser with library support and better error handling
 * @param {string} selector - The selector to parse
 * @returns {string} - Converted selector with strategy prefix (xpath=, css=, etc.)
 * @throws {Error} - Detailed error for invalid selectors
 */
export function parseSelector(selector) {
    if (!selector || typeof selector !== 'string') {
        throw new Error('Selector must be a non-empty string');
    }

    // Handle chained selectors FIRST (before checking for = in selenium selectors)
    if (selector.includes(' >> ') && !selector.match(/>>\s*nth=\d+$/)) {
        return parseChainedSelector(selector);
    }

    // Check if it's already in Selenium format (strategy=value) - but not chained
    if (selector.includes('=') && !selector.includes(' >> ')) {
        const [strategy] = selector.split('=');
        const validStrategies = ['id', 'css', 'xpath', 'name', 'tag', 'class'];
        if (validStrategies.includes(strategy.toLowerCase())) {
            // Validate CSS selectors using css-tree
            if (strategy.toLowerCase() === 'css') {
                const [, ...valueParts] = selector.split('=');
                const cssValue = valueParts.join('=');
                if (!isValidCSSSelector(cssValue)) {
                    throw new Error(`Invalid CSS selector: "${cssValue}". Please check syntax.`);
                }
            }
            return selector;
        }
    }

    // Check for visibility/state filters at the end
    let visibilityFilter = '';
    let cleanSelector = selector;
    
    if (selector.endsWith(':visible')) {
        visibilityFilter = 'not(@hidden) and not(@style="display: none;")';
        cleanSelector = selector.slice(0, -8); // Remove ':visible'
    } else if (selector.endsWith(':enabled')) {
        visibilityFilter = 'not(@disabled)';
        cleanSelector = selector.slice(0, -8); // Remove ':enabled'
    }

    // Check for nth selector BEFORE checking for chained selectors
    let nthIndex = null;
    const nthMatch = cleanSelector.match(/(.+?)\s*>>\s*nth=(\d+)$/);
    if (nthMatch) {
        cleanSelector = nthMatch[1];
        nthIndex = parseInt(nthMatch[2]) + 1; // Convert to 1-based index for XPath
        
        if (nthIndex < 1) {
            throw new Error('nth index must be >= 0');
        }
    }

    // Parse Playwright selector types with enhanced error handling
    let xpath = '';

    try {
        // text: exact text match
        if (cleanSelector.startsWith('text:')) {
            const text = cleanSelector.substring(5);
            xpath = `//*[text()=${escapeXPath(text)}]`;
        }
        // text*: partial text match
        else if (cleanSelector.startsWith('text*:')) {
            const text = cleanSelector.substring(6);
            xpath = `//*[contains(text(),${escapeXPath(text)})]`;
        }
        // role: ARIA role
        else if (cleanSelector.startsWith('role:')) {
            const role = cleanSelector.substring(5);
            if (!role) {
                throw new Error('role: selector requires a role value (e.g., role:button)');
            }
            xpath = `//*[@role=${escapeXPath(role)}]`;
        }
        // aria: ARIA role with attributes
        else if (cleanSelector.startsWith('aria:')) {
            const ariaSelector = cleanSelector.substring(5);
            const match = ariaSelector.match(/^(\w+)(?:\[(.+)\])?$/);
            if (match) {
                const [, role, attributes] = match;
                xpath = `//*[@role=${escapeXPath(role)}`;
                
                if (attributes) {
                    // Parse attributes like name="Submit"
                    const attrMatch = attributes.match(/(\w+)="([^"]+)"/);
                    if (attrMatch) {
                        const [, attr, value] = attrMatch;
                        const ariaAttr = attr === 'name' ? 'aria-label' : `aria-${attr}`;
                        xpath += ` and @${ariaAttr}=${escapeXPath(value)}`;
                    } else {
                        throw new Error(`Invalid aria attribute format: "${attributes}". Use name="value" format.`);
                    }
                }
                xpath += ']';
            } else {
                throw new Error(`Invalid aria selector format: "${ariaSelector}". Use aria:role or aria:role[name="value"]`);
            }
        }
        // placeholder: placeholder attribute
        else if (cleanSelector.startsWith('placeholder:')) {
            const placeholder = cleanSelector.substring(12);
            if (!placeholder) {
                throw new Error('placeholder: selector requires a placeholder value');
            }
            xpath = `//*[@placeholder=${escapeXPath(placeholder)}]`;
        }
        // alt: alt attribute
        else if (cleanSelector.startsWith('alt:')) {
            const alt = cleanSelector.substring(4);
            if (!alt) {
                throw new Error('alt: selector requires an alt text value');
            }
            xpath = `//*[@alt=${escapeXPath(alt)}]`;
        }
        // title: title attribute
        else if (cleanSelector.startsWith('title:')) {
            const title = cleanSelector.substring(6);
            if (!title) {
                throw new Error('title: selector requires a title value');
            }
            xpath = `//*[@title=${escapeXPath(title)}]`;
        }
        // data-testid: data-testid attribute
        else if (cleanSelector.startsWith('data-testid:')) {
            const testId = cleanSelector.substring(12);
            if (!testId) {
                throw new Error('data-testid: selector requires a test ID value');
            }
            xpath = `//*[@data-testid=${escapeXPath(testId)}]`;
        }
        // Default: assume it's a CSS selector and validate it
        else {
            if (!isValidCSSSelector(cleanSelector)) {
                throw new Error(`Invalid selector: "${cleanSelector}". Please use valid CSS selector or Playwright-style selector (text:, role:, etc.)`);
            }
            return 'css=' + selector;
        }
    } catch (error) {
        if (error.message.includes('Invalid selector')) {
            throw error; // Re-throw our custom errors
        }
        throw new Error(`Error parsing selector "${cleanSelector}": ${error.message}`);
    }

    // Apply visibility filter if present
    if (visibilityFilter) {
        // Need to insert before the closing bracket, handling proper syntax
        const lastBracket = xpath.lastIndexOf(']');
        xpath = xpath.substring(0, lastBracket) + ' and ' + visibilityFilter + xpath.substring(lastBracket);
    }

    // Apply nth index if present
    if (nthIndex !== null) {
        xpath = `(${xpath})[${nthIndex}]`;
    }

    return 'xpath=' + xpath;
}

/**
 * Parses chained selectors with enhanced error handling
 * @param {string} selector - The chained selector
 * @returns {string} - Returns the full chained selector for special handling
 */
function parseChainedSelector(selector) {
    try {
        // For now, we'll return a special format that indicates chaining
        // The CLI will need to handle this by finding the first element,
        // then searching within it for the second element
        const parts = selector.split(' >> ').map(part => {
            const trimmed = part.trim();
            if (!trimmed) {
                throw new Error('Empty part in chained selector');
            }
            return parseSelector(trimmed);
        });
        return 'chain:' + parts.join(' >> ');
    } catch (error) {
        throw new Error(`Error in chained selector "${selector}": ${error.message}`);
    }
}

/**
 * Get helpful error suggestions for common mistakes
 * @param {string} selector - The original selector that failed
 * @returns {string} - Helpful suggestion
 */
export function getSelectorSuggestion(selector) {
    if (!selector) {
        return 'Try using a valid selector like text:Login, role:button, or css=.button';
    }
    
    if (selector.includes('text=')) {
        return 'Did you mean text: instead of text=? Use text:Login for exact text match';
    }
    
    if (selector.includes('role=')) {
        return 'Did you mean role: instead of role=? Use role:button for ARIA roles';
    }
    
    if (selector.startsWith('.') || selector.startsWith('#') || selector.includes('[')) {
        return 'CSS selectors should use css= prefix, e.g., css=' + selector;
    }
    
    if (selector.startsWith('//')) {
        return 'XPath selectors should use xpath= prefix, e.g., xpath=' + selector;
    }
    
    return 'Try text:, role:, placeholder:, alt:, title:, data-testid:, or use css=/xpath= prefixes';
}

export default parseSelector;