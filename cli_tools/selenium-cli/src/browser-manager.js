import pkg from 'selenium-webdriver';
const { Builder, By, Key, until, Actions } = pkg;
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { ServiceBuilder } from 'selenium-webdriver/firefox.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as sessionIsolation from './session-isolation.js';

// State management
let driver = null;
let sessionId = null;
let processSessionId = null;

// Helper function to parse INI file
function parseIniFile(content) {
    const lines = content.split('\n');
    const sections = {};
    let currentSection = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith(';')) continue;
        
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            currentSection = trimmed.slice(1, -1);
            sections[currentSection] = {};
        } else if (currentSection && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            sections[currentSection][key.trim()] = valueParts.join('=').trim();
        }
    }
    
    return sections;
}

// Helper function to find Firefox default profile
export async function findFirefoxDefaultProfile() {
    const platform = os.platform();
    let firefoxPath;
    
    // Determine Firefox directory based on platform
    if (platform === 'darwin') {
        firefoxPath = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox');
    } else if (platform === 'win32') {
        firefoxPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox');
    } else {
        firefoxPath = path.join(os.homedir(), '.mozilla', 'firefox');
    }
    
    const profilesPath = path.join(firefoxPath, 'Profiles');
    
    try {
        // Read the profiles.ini file to find the default profile
        const profilesIniPath = path.join(firefoxPath, 'profiles.ini');
        const profilesIni = await fs.readFile(profilesIniPath, 'utf-8');
        const sections = parseIniFile(profilesIni);
        
        // First check Install sections for the default
        for (const [section, data] of Object.entries(sections)) {
            if (section.startsWith('Install') && data.Default) {
                const profilePath = path.join(firefoxPath, data.Default);
                try {
                    await fs.access(profilePath);
                    return profilePath;
                } catch (e) {
                    // Profile doesn't exist, continue searching
                }
            }
        }
        
        // Then check profile sections for Default=1
        for (const [section, data] of Object.entries(sections)) {
            if (section.startsWith('Profile') && data.Default === '1') {
                const profilePath = data.IsRelative === '1' 
                    ? path.join(firefoxPath, data.Path)
                    : data.Path;
                try {
                    await fs.access(profilePath);
                    return profilePath;
                } catch (e) {
                    // Profile doesn't exist, continue searching
                }
            }
        }
        
        // If no default profile found, try to find any .default-release profile
        const dirs = await fs.readdir(profilesPath);
        const defaultRelease = dirs.find(dir => dir.endsWith('.default-release'));
        if (defaultRelease) {
            const profilePath = path.join(profilesPath, defaultRelease);
            return profilePath;
        }
        
    } catch (error) {
        console.error(`Error finding Firefox profile: ${error.message}`);
    }
    
    return null;
}

// Launch browser
export async function launchBrowser(options = {}) {
    if (driver) {
        throw new Error('Browser is already running. Use "close" command first.');
    }
    
    // Generate unique session ID for this process
    processSessionId = sessionIsolation.generateSessionId();
    
    const firefoxOptions = new FirefoxOptions();
    
    // Use existing Firefox profile by default (like MCP server)
    // Can be disabled with options.useProfile === false
    if (options.useProfile !== false) {
        const profilePath = process.env.FIREFOX_PROFILE_PATH || await findFirefoxDefaultProfile();
        if (profilePath) {
            // Create a temporary copy of the profile
            const tempProfilePath = path.join(os.tmpdir(), `selenium-profile-${Date.now()}`);
            try {
                await fs.mkdir(tempProfilePath, { recursive: true });
                
                // Copy only essential profile files for logged-in sessions
                const essentialFiles = [
                    'cookies.sqlite',
                    'cookies.sqlite-wal',
                    'places.sqlite',
                    'formhistory.sqlite',
                    'key4.db',
                    'logins.json',
                    'prefs.js',
                    'permissions.sqlite',
                    'content-prefs.sqlite',
                    'sessionstore.jsonlz4'
                ];
                
                // Copy essential files only
                for (const file of essentialFiles) {
                    const srcPath = path.join(profilePath, file);
                    const destPath = path.join(tempProfilePath, file);
                    try {
                        await fs.copyFile(srcPath, destPath);
                    } catch (e) {
                        // File might not exist, that's ok
                    }
                }
                
                // Copy storage directory for localStorage/sessionStorage
                try {
                    const storageSrc = path.join(profilePath, 'storage');
                    const storageDest = path.join(tempProfilePath, 'storage');
                    await fs.cp(storageSrc, storageDest, { recursive: true });
                } catch (e) {
                    // Storage might not exist, that's ok
                }
                
                firefoxOptions.setProfile(tempProfilePath);
            } catch (error) {
                console.error(`Failed to copy Firefox profile: ${error.message}`);
                // Fall back to no profile
            }
        }
    }
    
    // Headless mode
    if (options.headless) {
        firefoxOptions.addArguments('--headless');
    }
    
    // Additional arguments
    if (options.arguments) {
        options.arguments.forEach(arg => firefoxOptions.addArguments(arg));
    }
    
    // Set unique port for geckodriver to avoid conflicts
    const geckodriverPort = sessionIsolation.getGeckodriverPort(processSessionId);
    const service = new ServiceBuilder().setPort(geckodriverPort);
    
    try {
        driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(firefoxOptions)
            .setFirefoxService(service)
            .build();
        
        sessionId = Math.random().toString(36).substring(7);
        
        return {
            sessionId,
            processSessionId,
            geckodriverPort,
            status: 'Browser launched successfully'
        };
    } catch (error) {
        // If port is in use, try with a random port
        if (error.message.includes('Address already in use')) {
            const randomPort = 9515 + Math.floor(Math.random() * 485);
            const retryService = new ServiceBuilder().setPort(randomPort);
            
            driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(firefoxOptions)
                .setFirefoxService(retryService)
                .build();
            
            sessionId = Math.random().toString(36).substring(7);
            
            return {
                sessionId,
                processSessionId,
                geckodriverPort: randomPort,
                status: 'Browser launched successfully'
            };
        }
        throw error;
    }
}

// Navigate to URL
export async function navigate(url) {
    if (!driver) {
        throw new Error('No browser session. Use "launch" command first.');
    }
    
    await driver.get(url);
    return {
        url,
        status: 'Navigation successful'
    };
}

// Find element helper
async function findElement(by, value, timeout = 10000) {
    if (!driver) {
        throw new Error('No browser session. Use "launch" command first.');
    }
    
    let locator;
    switch (by) {
        case 'id':
            locator = By.id(value);
            break;
        case 'css':
            locator = By.css(value);
            break;
        case 'xpath':
            locator = By.xpath(value);
            break;
        case 'name':
            locator = By.name(value);
            break;
        case 'tag':
            locator = By.tagName(value);
            break;
        case 'class':
            locator = By.className(value);
            break;
        default:
            throw new Error(`Unknown locator type: ${by}`);
    }
    
    await driver.wait(until.elementLocated(locator), timeout);
    return await driver.findElement(locator);
}

// Click element
export async function clickElement(by, value, timeout) {
    const element = await findElement(by, value, timeout);
    await element.click();
    return {
        element: `${by}=${value}`,
        status: 'Click successful'
    };
}

// Send keys to element
export async function sendKeys(by, value, text, options = {}) {
    const element = await findElement(by, value, options.timeout);
    
    if (options.clear !== false) {
        await element.clear();
    }
    
    await element.sendKeys(text);
    
    if (options.pressEnter) {
        await element.sendKeys(Key.RETURN);
    }
    
    return {
        element: `${by}=${value}`,
        text,
        status: 'Text entered successfully'
    };
}

// Get element text
export async function getElementText(by, value, timeout) {
    const element = await findElement(by, value, timeout);
    const text = await element.getText();
    return {
        element: `${by}=${value}`,
        text
    };
}

// Take screenshot
export async function takeScreenshot(outputPath) {
    if (!driver) {
        throw new Error('No browser session. Use "launch" command first.');
    }
    
    const screenshot = await driver.takeScreenshot();
    
    if (outputPath) {
        await fs.writeFile(outputPath, screenshot, 'base64');
        return {
            path: outputPath,
            status: 'Screenshot saved'
        };
    } else {
        return {
            data: screenshot,
            status: 'Screenshot captured'
        };
    }
}

// Close browser
export async function closeBrowser() {
    if (!driver) {
        throw new Error('No browser session to close.');
    }
    
    await driver.quit();
    driver = null;
    sessionId = null;
    
    return {
        status: 'Browser closed successfully'
    };
}

// Get current session status
export async function getSessionStatus() {
    if (!driver) {
        return {
            hasSession: false,
            sessionId: null
        };
    }
    
    // Try to validate the session is actually alive
    try {
        await driver.getTitle();
        return {
            hasSession: true,
            sessionId: sessionId
        };
    } catch (error) {
        // Session is dead
        driver = null;
        sessionId = null;
        return {
            hasSession: false,
            sessionId: null
        };
    }
}

// Key mapping for press_key functionality
const KEY_MAP = {
    'enter': Key.RETURN,
    'return': Key.RETURN,
    'tab': Key.TAB,
    'escape': Key.ESCAPE,
    'esc': Key.ESCAPE,
    'space': Key.SPACE,
    'backspace': Key.BACK_SPACE,
    'delete': Key.DELETE,
    'del': Key.DELETE,
    'arrowup': Key.ARROW_UP,
    'arrowdown': Key.ARROW_DOWN,
    'arrowleft': Key.ARROW_LEFT,
    'arrowright': Key.ARROW_RIGHT,
    'up': Key.ARROW_UP,
    'down': Key.ARROW_DOWN,
    'left': Key.ARROW_LEFT,
    'right': Key.ARROW_RIGHT,
    'home': Key.HOME,
    'end': Key.END,
    'pageup': Key.PAGE_UP,
    'pagedown': Key.PAGE_DOWN,
    'f1': Key.F1,
    'f2': Key.F2,
    'f3': Key.F3,
    'f4': Key.F4,
    'f5': Key.F5,
    'f6': Key.F6,
    'f7': Key.F7,
    'f8': Key.F8,
    'f9': Key.F9,
    'f10': Key.F10,
    'f11': Key.F11,
    'f12': Key.F12,
    'shift': Key.SHIFT,
    'control': Key.CONTROL,
    'ctrl': Key.CONTROL,
    'alt': Key.ALT,
    'meta': Key.META,
    'command': Key.META,
    'cmd': Key.META
};

// Press key
export async function pressKey(key) {
    if (!driver) {
        throw new Error('No browser session. Use "launch" command first.');
    }
    
    const normalizedKey = key.toLowerCase();
    const seleniumKey = KEY_MAP[normalizedKey] || key;
    
    const actions = driver.actions({ async: true });
    await actions.sendKeys(seleniumKey).perform();
    
    return {
        key,
        status: 'Key pressed successfully'
    };
}

// Hover over element
export async function hoverElement(by, value, timeout) {
    const element = await findElement(by, value, timeout);
    const actions = driver.actions({ async: true });
    await actions.move({ origin: element }).perform();
    
    return {
        element: `${by}=${value}`,
        status: 'Hover successful'
    };
}

// Double click element
export async function doubleClickElement(by, value, timeout) {
    const element = await findElement(by, value, timeout);
    const actions = driver.actions({ async: true });
    await actions.doubleClick(element).perform();
    
    return {
        element: `${by}=${value}`,
        status: 'Double click successful'
    };
}

// Right click element
export async function rightClickElement(by, value, timeout) {
    const element = await findElement(by, value, timeout);
    const actions = driver.actions({ async: true });
    await actions.contextClick(element).perform();
    
    return {
        element: `${by}=${value}`,
        status: 'Right click successful'
    };
}

// Drag and drop
export async function dragAndDrop(sourceBy, sourceValue, targetBy, targetValue, timeout) {
    const sourceElement = await findElement(sourceBy, sourceValue, timeout);
    const targetElement = await findElement(targetBy, targetValue, timeout);
    
    const actions = driver.actions({ async: true });
    await actions.dragAndDrop(sourceElement, targetElement).perform();
    
    return {
        source: `${sourceBy}=${sourceValue}`,
        target: `${targetBy}=${targetValue}`,
        status: 'Drag and drop successful'
    };
}

// Upload file
export async function uploadFile(by, value, filePath, timeout) {
    const element = await findElement(by, value, timeout);
    await element.sendKeys(filePath);
    
    return {
        element: `${by}=${value}`,
        filePath,
        status: 'File uploaded successfully'
    };
}

// Export HTML source
export async function exportHtml(filePath) {
    if (!driver) {
        throw new Error('No browser session active. Launch browser first.');
    }
    
    const html = await driver.getPageSource();
    
    if (filePath) {
        await fs.writeFile(filePath, html, 'utf-8');
        return {
            path: filePath,
            size: html.length,
            status: 'HTML exported successfully'
        };
    } else {
        return {
            html: html,
            size: html.length,
            status: 'HTML retrieved successfully'
        };
    }
}