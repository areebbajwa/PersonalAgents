/**
 * Playwright-style selector parser for selenium-cli
 * Translates Playwright selectors to Selenium-compatible XPath/CSS selectors
 */

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
        let inDoubleQuote = false;
        
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
 * Parses Playwright-style selectors and converts them to Selenium-compatible format
 * @param {string} selector - The selector to parse
 * @returns {string} - Converted selector with strategy prefix (xpath=, css=, etc.)
 */
export function parseSelector(selector) {
    // Handle chained selectors FIRST (before checking for = in selenium selectors)
    if (selector.includes(' >> ') && !selector.match(/>>\s*nth=\d+$/)) {
        return parseChainedSelector(selector);
    }

    // Check if it's already in Selenium format (strategy=value) - but not chained
    if (selector.includes('=') && !selector.includes(' >> ')) {
        const [strategy] = selector.split('=');
        const validStrategies = ['id', 'css', 'xpath', 'name', 'tag', 'class'];
        if (validStrategies.includes(strategy.toLowerCase())) {
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
    }


    // Parse Playwright selector types
    let xpath = '';

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
                }
            }
            xpath += ']';
        }
    }
    // placeholder: placeholder attribute
    else if (cleanSelector.startsWith('placeholder:')) {
        const placeholder = cleanSelector.substring(12);
        xpath = `//*[@placeholder=${escapeXPath(placeholder)}]`;
    }
    // alt: alt attribute
    else if (cleanSelector.startsWith('alt:')) {
        const alt = cleanSelector.substring(4);
        xpath = `//*[@alt=${escapeXPath(alt)}]`;
    }
    // title: title attribute
    else if (cleanSelector.startsWith('title:')) {
        const title = cleanSelector.substring(6);
        xpath = `//*[@title=${escapeXPath(title)}]`;
    }
    // data-testid: data-testid attribute
    else if (cleanSelector.startsWith('data-testid:')) {
        const testId = cleanSelector.substring(12);
        xpath = `//*[@data-testid=${escapeXPath(testId)}]`;
    }
    // Default: assume it's a CSS selector
    else {
        return 'css=' + selector;
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
 * Parses chained selectors (e.g., "role:form >> text:Submit")
 * Note: This returns a special format that needs to be handled by the CLI
 * @param {string} selector - The chained selector
 * @returns {string} - Returns the full chained selector for special handling
 */
function parseChainedSelector(selector) {
    // For now, we'll return a special format that indicates chaining
    // The CLI will need to handle this by finding the first element,
    // then searching within it for the second element
    const parts = selector.split(' >> ').map(part => parseSelector(part.trim()));
    return 'chain:' + parts.join(' >> ');
}

export default parseSelector;