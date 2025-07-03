import { Builder, By, until } from 'selenium-webdriver';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import express from 'express';
import { diffLines } from 'diff';
import * as cheerio from 'cheerio';
import { parseSelector } from './src/playwright-selector-parser-v2.js';

const app = express();
app.use(express.json());

let driver = null;
let previousHtml = null;

// Find Firefox profile
async function findFirefoxProfile() {
    const homeDir = os.homedir();
    let firefoxPath;
    
    if (process.platform === 'darwin') {
        firefoxPath = path.join(homeDir, 'Library', 'Application Support', 'Firefox');
    } else if (process.platform === 'win32') {
        firefoxPath = path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox');
    } else {
        firefoxPath = path.join(homeDir, '.mozilla', 'firefox');
    }
    
    try {
        const profilesIniPath = path.join(firefoxPath, 'profiles.ini');
        const profilesIni = await fs.readFile(profilesIniPath, 'utf-8');
        
        // Find default-release profile
        const defaultMatch = profilesIni.match(/Path=.*\.default-release/);
        if (defaultMatch) {
            const profileName = defaultMatch[0].split('=')[1];
            return path.join(firefoxPath, profileName);
        }
    } catch (e) {
        console.error('Could not find Firefox profile');
    }
    return null;
}

// Initialize browser
async function initBrowser() {
    if (driver) {
        try {
            await driver.getTitle();
            return driver;
        } catch (e) {
            driver = null;
        }
    }
    
    const options = new FirefoxOptions();
    
    // Use existing Firefox profile for logged-in sessions
    const profilePath = await findFirefoxProfile();
    if (profilePath) {
        // Copy essential profile files to temp directory
        const tempProfile = path.join(os.tmpdir(), `fixed-selenium-${Date.now()}`);
        await fs.mkdir(tempProfile, { recursive: true });
        
        const essentialFiles = [
            'cookies.sqlite',
            'key4.db', 
            'logins.json',
            'prefs.js',
            'permissions.sqlite'
        ];
        
        for (const file of essentialFiles) {
            try {
                await fs.copyFile(
                    path.join(profilePath, file), 
                    path.join(tempProfile, file)
                );
            } catch (e) {
                // File might not exist, continue
            }
        }
        
        // Create prefs.js with critical settings to prevent multiple instances
        const prefsContent = `
// Prevent multiple Firefox instances and focus issues
user_pref("focusmanager.testmode", true);
user_pref("browser.tabs.remote.autostart", false);
user_pref("browser.tabs.remote.autostart.2", false);
user_pref("browser.sessionstore.max_resumed_crashes", 0);
user_pref("browser.sessionstore.restore_on_demand", false);
user_pref("browser.link.open_newwindow", 1);
user_pref("browser.link.open_newwindow.restriction", 0);
`;
        await fs.writeFile(path.join(tempProfile, 'prefs.js'), prefsContent, 'utf8');
        
        options.setProfile(tempProfile);
    }
    
    driver = await new Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(options)
        .build();
    
    return driver;
}

// Take screenshot
async function takeScreenshot() {
    const screenshotDir = './screenshots';
    await fs.mkdir(screenshotDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    const screenshot = await driver.takeScreenshot();
    await fs.writeFile(filepath, screenshot, 'base64');
    
    return filepath;
}

// Export HTML
async function exportHtml() {
    const htmlDir = './html-exports';
    await fs.mkdir(htmlDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `html-${timestamp}.html`;
    const filepath = path.join(htmlDir, filename);
    
    const html = await driver.getPageSource();
    await fs.writeFile(filepath, html, 'utf8');
    
    return filepath;
}

// Generate selectors for an element following best practices
function generateSelectors(el, $, displayText, classes, id, href, name) {
    const selectors = [];
    
    // 1. ID selector (highest priority - unique and fastest)
    if (id) {
        selectors.push(`id=${id}`);
    }
    
    // 2. Name attribute selector
    if (name) {
        selectors.push(`name=${name}`);
    }
    
    // 3. CSS selectors (various strategies)
    
    // 3a. Class selector (simple and specific)
    if (classes) {
        const classList = classes.split(' ').filter(c => c);
        if (classList.length === 1) {
            selectors.push(`css=.${classList[0]}`);
        } else if (classList.length > 1) {
            // Use the most specific class or combine for uniqueness
            selectors.push(`css=.${classList.join('.')}`);
        }
    }
    
    // 3b. Attribute selectors for specific element types
    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'button') {
        const type = $(el).attr('type');
        if (type) {
            selectors.push(`css=${el.tagName.toLowerCase()}[type="${type}"]`);
        }
    }
    
    // 3c. Href attribute for links (partial matching for flexibility)
    if (href && el.tagName.toLowerCase() === 'a') {
        // Use partial match for dynamic URLs
        const hrefPath = href.split('?')[0]; // Remove query params
        if (hrefPath.length < 50) {
            selectors.push(`css=a[href="${hrefPath}"]`);
        } else {
            // Use starts-with for long URLs
            selectors.push(`css=a[href^="${hrefPath.substring(0, 30)}"]`);
        }
    }
    
    // 3d. Text-based selector using xpath (as last resort)
    if (displayText && displayText !== `[${$(el).attr('type') || 'text'} input]`) {
        const cleanText = displayText.replace(/"/g, '\\"').substring(0, 30);
        // Note: contains() is XPath, not CSS - using xpath for text content
        selectors.push(`xpath=//${el.tagName.toLowerCase()}[contains(text(), "${cleanText}")]`);
    }
    
    return selectors.slice(0, 3); // Limit to 3 most specific selectors
}

// Extract interactive elements from HTML
function extractInteractiveElements($) {
    const interactiveSelector = 'button, input[type="button"], input[type="submit"], input[type="reset"], ' +
                               '[role="button"], a[href], input[type="text"], input[type="password"], ' +
                               'input[type="email"], input[type="search"], input[type="tel"], ' +
                               'input[type="url"], input[type="number"], input[type="checkbox"], ' +
                               'input[type="radio"], select, textarea, [onclick], [tabindex]:not([tabindex="-1"])';
    
    const elements = [];
    $(interactiveSelector).each((i, el) => {
        const text = $(el).text().trim() || $(el).val() || '';
        const classes = $(el).attr('class') || '';
        const id = $(el).attr('id') || '';
        const href = $(el).attr('href') || '';
        const placeholder = $(el).attr('placeholder') || '';
        const name = $(el).attr('name') || '';
        
        // Create a display text that includes relevant info
        let displayText = text;
        if (!displayText && placeholder) displayText = `[${placeholder}]`;
        if (!displayText && name) displayText = `[${name}]`;
        if (!displayText && el.tagName.toLowerCase() === 'input') {
            displayText = `[${$(el).attr('type') || 'text'} input]`;
        }
        
        if (displayText || classes || id || href) {
            elements.push({ 
                text: displayText, 
                classes, 
                id, 
                tagName: el.tagName.toLowerCase(),
                href: href ? href.substring(0, 50) + (href.length > 50 ? '...' : '') : undefined,
                selectors: generateSelectors(el, $, displayText, classes, id, href, name)
            });
        }
    });
    
    return elements;
}

// Extract page text
async function extractPageText() {
    try {
        // Use Selenium's native getText() method which preserves line breaks
        const bodyElement = await driver.findElement(By.tagName('body'));
        let text = await bodyElement.getText();
        
        // Clean up excessive whitespace while preserving line breaks
        text = text.replace(/[ \t]+/g, ' ')  // Replace multiple spaces/tabs with single space
                   .replace(/\n\s*\n\s*\n+/g, '\n\n')  // Replace multiple newlines with double newline
                   .trim();
        
        return text;
    } catch (error) {
        // Fallback to executeScript method if getText fails
        try {
            const bodyElement = await driver.findElement(By.tagName('body'));
            return await driver.executeScript('return arguments[0].innerText;', bodyElement);
        } catch (fallbackError) {
            // Final fallback to cheerio parsing
            const html = await driver.getPageSource();
            const $ = cheerio.load(html);
            $('script').remove();
            $('style').remove();
            return $('body').text().replace(/\s+/g, ' ').trim();
        }
    }
}

// Calculate HTML diff
function calculateHtmlDiff(currentHtml) {
    const currentDoc = cheerio.load(currentHtml);
    
    if (!previousHtml) {
        // First page load - still find interactive elements
        const currentButtons = extractInteractiveElements(currentDoc);
        
        return { 
            hasDiff: false, 
            summary: `First page load - ${currentButtons.length} interactive elements found`,
            addedElements: [],
            removedElements: [],
            changedElements: [],
            newButtons: currentButtons,
            totalCurrentElements: currentDoc('*').length,
            totalPreviousElements: 0
        };
    }
    
    // Parse both HTML strings (already loaded currentDoc above)
    const previousDoc = cheerio.load(previousHtml);
    
    // Get text differences
    const textDiff = diffLines(previousHtml, currentHtml);
    
    let addedLines = [];
    let removedLines = [];
    let changedLines = [];
    
    textDiff.forEach(part => {
        if (part.added) {
            addedLines.push(...part.value.split('\n').filter(line => line.trim()));
        } else if (part.removed) {
            removedLines.push(...part.value.split('\n').filter(line => line.trim()));
        }
    });
    
    // Simple element counting for summary
    const currentElements = currentDoc('*').length;
    const previousElements = previousDoc('*').length;
    const elementDiff = currentElements - previousElements;
    
    // Look for new interactive elements
    const currentButtons = extractInteractiveElements(currentDoc);
    const previousButtons = extractInteractiveElements(previousDoc);
    
    // Find new buttons
    const newButtons = currentButtons.filter(current => 
        !previousButtons.some(prev => 
            prev.text === current.text && 
            prev.classes === current.classes && 
            prev.id === current.id
        )
    );
    
    const hasDiff = addedLines.length > 0 || removedLines.length > 0 || elementDiff !== 0;
    
    let summary = "";
    if (!hasDiff) {
        summary = "No significant changes detected";
    } else {
        const parts = [];
        if (elementDiff > 0) parts.push(`+${elementDiff} elements`);
        if (elementDiff < 0) parts.push(`${elementDiff} elements`);
        if (addedLines.length > 0) parts.push(`+${addedLines.length} lines`);
        if (removedLines.length > 0) parts.push(`-${removedLines.length} lines`);
        if (newButtons.length > 0) parts.push(`+${newButtons.length} new buttons`);
        summary = parts.join(', ');
    }
    
    return {
        hasDiff,
        summary,
        elementDiff,
        addedLines: addedLines.slice(0, 5), // Limit for readability
        removedLines: removedLines.slice(0, 5),
        newButtons,
        totalCurrentElements: currentElements,
        totalPreviousElements: previousElements
    };
}

// Parse selector with Playwright support
function parseSelectorToBy(locator) {
    try {
        // First apply Playwright selector parsing
        const parsedSelector = parseSelector(locator);
        
        // Then convert to Selenium By object
        const [strategy, ...valueParts] = parsedSelector.split('=');
        const value = valueParts.join('=');
        
        switch (strategy) {
            case 'css':
                return By.css(value);
            case 'id':
                return By.id(value);
            case 'xpath':
                return By.xpath(value);
            case 'name':
                return By.name(value);
            case 'class':
                return By.className(value);
            case 'tag':
                return By.tagName(value);
            default:
                throw new Error(`Unknown locator strategy: ${strategy}`);
        }
    } catch (error) {
        // Re-throw with enhanced error message
        throw new Error(`Invalid selector "${locator}": ${error.message}. Try Playwright selectors like text:Login, role:button, or css=.selector`);
    }
}

// API Routes
app.get('/status', async (req, res) => {
    try {
        if (driver) {
            const title = await driver.getTitle();
            const url = await driver.getCurrentUrl();
            res.json({ 
                status: 'active', 
                title, 
                url
            });
        } else {
            res.json({ status: 'inactive' });
        }
    } catch (e) {
        res.json({ status: 'error', error: e.message });
    }
});

app.get('/elements', async (req, res) => {
    try {
        if (!driver) {
            res.json({ success: false, error: 'No browser session active' });
            return;
        }
        
        const html = await driver.getPageSource();
        const $ = cheerio.load(html);
        const elements = extractInteractiveElements($);
        
        res.json({ 
            success: true, 
            elements: elements,
            count: elements.length,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/navigate', async (req, res) => {
    try {
        await initBrowser();
        const { url } = req.body;
        await driver.get(url);
        
        // Get current HTML for diff calculation
        const currentHtml = await driver.getPageSource();
        const htmlDiff = calculateHtmlDiff(currentHtml);
        
        const screenshot = await takeScreenshot();
        const html = await exportHtml();
        const text = await extractPageText();
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            text,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        // Even on error, try to capture current page state for debugging
        try {
            const currentHtml = await driver.getPageSource();
            const htmlDiff = calculateHtmlDiff(currentHtml);
            const screenshot = await takeScreenshot();
            const html = await exportHtml();
            const text = await extractPageText();
            
            res.json({ 
                success: false, 
                error: e.message,
                screenshot, 
                html,
                text,
                htmlDiff,
                url: await driver.getCurrentUrl(),
                title: await driver.getTitle()
            });
        } catch (pageStateError) {
            // If we can't get page state, just return the original error
            res.json({ success: false, error: e.message });
        }
    }
});

app.post('/click', async (req, res) => {
    try {
        const { selector } = req.body;
        const by = parseSelectorToBy(selector);
        await driver.wait(until.elementLocated(by), 10000);
        const element = await driver.findElement(by);
        await element.click();
        
        // Get current HTML for diff calculation
        const currentHtml = await driver.getPageSource();
        const htmlDiff = calculateHtmlDiff(currentHtml);
        
        const screenshot = await takeScreenshot();
        const html = await exportHtml();
        const text = await extractPageText();
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            text,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        // Even on error, try to capture current page state for debugging
        try {
            const currentHtml = await driver.getPageSource();
            const htmlDiff = calculateHtmlDiff(currentHtml);
            const screenshot = await takeScreenshot();
            const html = await exportHtml();
            const text = await extractPageText();
            
            res.json({ 
                success: false, 
                error: e.message,
                screenshot, 
                html,
                text,
                htmlDiff,
                url: await driver.getCurrentUrl(),
                title: await driver.getTitle()
            });
        } catch (pageStateError) {
            // If we can't get page state, just return the original error
            res.json({ success: false, error: e.message });
        }
    }
});

app.post('/type', async (req, res) => {
    try {
        const { selector, text } = req.body;
        const by = parseSelectorToBy(selector);
        await driver.wait(until.elementLocated(by), 10000);
        const element = await driver.findElement(by);
        
        await element.clear();
        await element.sendKeys(text);
        
        // Get current HTML for diff calculation
        const currentHtml = await driver.getPageSource();
        const htmlDiff = calculateHtmlDiff(currentHtml);
        
        const screenshot = await takeScreenshot();
        const html = await exportHtml();
        const pageText = await extractPageText();
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            text: pageText,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        // Even on error, try to capture current page state for debugging
        try {
            const currentHtml = await driver.getPageSource();
            const htmlDiff = calculateHtmlDiff(currentHtml);
            const screenshot = await takeScreenshot();
            const html = await exportHtml();
            const text = await extractPageText();
            
            res.json({ 
                success: false, 
                error: e.message,
                screenshot, 
                html,
                text,
                htmlDiff,
                url: await driver.getCurrentUrl(),
                title: await driver.getTitle()
            });
        } catch (pageStateError) {
            // If we can't get page state, just return the original error
            res.json({ success: false, error: e.message });
        }
    }
});

app.post('/screenshot', async (req, res) => {
    try {
        const screenshot = await takeScreenshot();
        res.json({ success: true, screenshot });
    } catch (e) {
        // Even on error, try to capture current page state for debugging
        try {
            const currentHtml = await driver.getPageSource();
            const htmlDiff = calculateHtmlDiff(currentHtml);
            const screenshot = await takeScreenshot();
            const html = await exportHtml();
            const text = await extractPageText();
            
            res.json({ 
                success: false, 
                error: e.message,
                screenshot, 
                html,
                text,
                htmlDiff,
                url: await driver.getCurrentUrl(),
                title: await driver.getTitle()
            });
        } catch (pageStateError) {
            // If we can't get page state, just return the original error
            res.json({ success: false, error: e.message });
        }
    }
});

app.post('/close', async (req, res) => {
    try {
        if (driver) {
            await driver.quit();
            driver = null;
        }
        res.json({ success: true });
    } catch (e) {
        // Even on error, try to capture current page state for debugging
        try {
            const currentHtml = await driver.getPageSource();
            const htmlDiff = calculateHtmlDiff(currentHtml);
            const screenshot = await takeScreenshot();
            const html = await exportHtml();
            const text = await extractPageText();
            
            res.json({ 
                success: false, 
                error: e.message,
                screenshot, 
                html,
                text,
                htmlDiff,
                url: await driver.getCurrentUrl(),
                title: await driver.getTitle()
            });
        } catch (pageStateError) {
            // If we can't get page state, just return the original error
            res.json({ success: false, error: e.message });
        }
    }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`Session server running on port ${PORT}`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
    if (driver) {
        try {
            await driver.quit();
        } catch (e) {}
    }
    server.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (driver) {
        try {
            await driver.quit();
        } catch (e) {}
    }
    server.close();
    process.exit(0);
});