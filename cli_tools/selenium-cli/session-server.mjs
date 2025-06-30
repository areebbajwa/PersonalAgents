import { Builder, By, until } from 'selenium-webdriver';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import express from 'express';
import { diffLines } from 'diff';
import * as cheerio from 'cheerio';

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

// Calculate HTML diff
function calculateHtmlDiff(currentHtml) {
    if (!previousHtml) {
        return { 
            hasDiff: false, 
            summary: "First page load - no previous HTML to compare",
            addedElements: [],
            removedElements: [],
            changedElements: []
        };
    }
    
    // Parse both HTML strings
    const currentDoc = cheerio.load(currentHtml);
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
    
    // Look for new buttons or interactive elements
    const currentButtons = [];
    currentDoc('button, input[type="button"], input[type="submit"], [role="button"]').each((i, el) => {
        const text = currentDoc(el).text().trim();
        const classes = currentDoc(el).attr('class') || '';
        const id = currentDoc(el).attr('id') || '';
        if (text || classes || id) {
            currentButtons.push({ text, classes, id, tagName: el.tagName });
        }
    });
    
    const previousButtons = [];
    previousDoc('button, input[type="button"], input[type="submit"], [role="button"]').each((i, el) => {
        const text = previousDoc(el).text().trim();
        const classes = previousDoc(el).attr('class') || '';
        const id = previousDoc(el).attr('id') || '';
        if (text || classes || id) {
            previousButtons.push({ text, classes, id, tagName: el.tagName });
        }
    });
    
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

// Parse CSS selector
function parseSelector(locator) {
    if (locator.startsWith('css=')) {
        return By.css(locator.substring(4));
    }
    if (locator.startsWith('id=')) {
        return By.id(locator.substring(3));
    }
    if (locator.startsWith('xpath=')) {
        return By.xpath(locator.substring(6));
    }
    if (locator.startsWith('name=')) {
        return By.name(locator.substring(5));
    }
    if (locator.startsWith('class=')) {
        return By.className(locator.substring(6));
    }
    if (locator.startsWith('tag=')) {
        return By.tagName(locator.substring(4));
    }
    
    // Default to CSS selector
    return By.css(locator);
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
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/click', async (req, res) => {
    try {
        const { selector } = req.body;
        const by = parseSelector(selector);
        await driver.wait(until.elementLocated(by), 10000);
        const element = await driver.findElement(by);
        await element.click();
        
        // Get current HTML for diff calculation
        const currentHtml = await driver.getPageSource();
        const htmlDiff = calculateHtmlDiff(currentHtml);
        
        const screenshot = await takeScreenshot();
        const html = await exportHtml();
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/type', async (req, res) => {
    try {
        const { selector, text } = req.body;
        const by = parseSelector(selector);
        await driver.wait(until.elementLocated(by), 10000);
        const element = await driver.findElement(by);
        
        await element.clear();
        await element.sendKeys(text);
        
        // Get current HTML for diff calculation
        const currentHtml = await driver.getPageSource();
        const htmlDiff = calculateHtmlDiff(currentHtml);
        
        const screenshot = await takeScreenshot();
        const html = await exportHtml();
        
        // Update previous HTML for next comparison
        previousHtml = currentHtml;
        
        res.json({ 
            success: true, 
            screenshot, 
            html,
            htmlDiff,
            url: await driver.getCurrentUrl(),
            title: await driver.getTitle()
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/screenshot', async (req, res) => {
    try {
        const screenshot = await takeScreenshot();
        res.json({ success: true, screenshot });
    } catch (e) {
        res.json({ success: false, error: e.message });
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
        res.json({ success: false, error: e.message });
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