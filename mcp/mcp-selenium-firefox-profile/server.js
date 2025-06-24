#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pkg from 'selenium-webdriver';
const { Builder, By, Key, until, Actions } = pkg;
import { Options as ChromeOptions } from 'selenium-webdriver/chrome.js';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import http from 'http';
import { request as httpRequest } from 'http';

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
async function findFirefoxDefaultProfile() {
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
                    console.error(`Found default Firefox profile: ${profilePath}`);
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
                    console.error(`Found default Firefox profile: ${profilePath}`);
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
            console.error(`Found Firefox profile by pattern: ${profilePath}`);
            return profilePath;
        }
        
    } catch (error) {
        console.error(`Error finding Firefox profile: ${error.message}`);
    }
    
    return null;
}

// Create an MCP server
const server = new McpServer({
    name: "MCP Selenium with Firefox Profile",
    version: "1.0.0"
});

// File-based coordination for multiple MCP processes
const COORDINATION_FILE = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/mcp/selenium-mcp-coordination.json';

// WebDriver Proxy Server
let proxyServer = null;
const PROXY_PORT = 9515; // Default WebDriver port + 1

function createWebDriverProxy(geckodriverPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            // Forward all requests to geckodriver (which translates to marionette)
            const options = {
                hostname: 'localhost',
                port: geckodriverPort,
                path: req.url,
                method: req.method,
                headers: req.headers
            };

            const proxyReq = httpRequest(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy request error:', err);
                res.writeHead(500);
                res.end('Proxy error');
            });

            req.pipe(proxyReq);
        });

        server.listen(PROXY_PORT, (err) => {
            if (err) {
                reject(err);
            } else {
                console.error(`WebDriver proxy started on port ${PROXY_PORT}, forwarding to geckodriver on ${geckodriverPort}`);
                resolve(server);
            }
        });

        server.on('error', reject);
    });
}

// Function to detect geckodriver HTTP port
async function detectGeckodriverPort() {
    try {
        return new Promise((resolve) => {
            const ps = spawn('ps', ['aux']);
            let output = '';
            
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            ps.on('close', () => {
                const lines = output.split('\n');
                for (const line of lines) {
                    // Look for geckodriver process with --port= argument
                    if (line.includes('geckodriver') && line.includes('--port=')) {
                        const match = line.match(/--port=(\d+)/);
                        if (match) {
                            const port = parseInt(match[1]);
                            console.error(`Detected geckodriver HTTP port from process: ${port}`);
                            resolve(port);
                            return;
                        }
                    }
                }
                
                // Fallback: use lsof to find listening ports
                const lsof = spawn('lsof', ['-i', '-P']);
                let lsofOutput = '';
                
                lsof.stdout.on('data', (data) => {
                    lsofOutput += data.toString();
                });
                
                lsof.on('close', () => {
                    const lsofLines = lsofOutput.split('\n');
                    for (const line of lsofLines) {
                        if (line.includes('geckodriver') && line.includes('LISTEN')) {
                            const match = line.match(/:(\d+) \(LISTEN\)/);
                            if (match) {
                                const port = parseInt(match[1]);
                                console.error(`Detected geckodriver HTTP port via lsof: ${port}`);
                                resolve(port);
                                return;
                            }
                        }
                    }
                    resolve(null);
                });
            });
        });
    } catch (e) {
        console.error('Error detecting geckodriver port:', e.message);
        return null;
    }
}

// Server state - this process only
const state = {
    driver: null,
    currentSession: null,
    lastActivity: Date.now()
};

// Check if there's already a Firefox with marionette running
async function checkExistingFirefox() {
    try {
        const coordination = JSON.parse(await fs.readFile(COORDINATION_FILE, 'utf-8'));
        const timeSinceLastActivity = Date.now() - coordination.lastActivity;
        
        // If last activity was more than 5 minutes ago, consider it stale
        if (timeSinceLastActivity > 5 * 60 * 1000) {
            await fs.unlink(COORDINATION_FILE).catch(() => {});
            return null;
        }
        
        return coordination;
    } catch (e) {
        return null;
    }
}

// Update coordination file
async function updateCoordination(data) {
    try {
        await fs.writeFile(COORDINATION_FILE, JSON.stringify({
            ...data,
            lastActivity: Date.now()
        }, null, 2));
    } catch (e) {
        console.error('Error updating coordination file:', e.message);
    }
}

// Start proxy server if needed
async function startProxyIfNeeded(geckodriverPort) {
    if (!proxyServer && geckodriverPort) {
        try {
            proxyServer = await createWebDriverProxy(geckodriverPort);
            return PROXY_PORT;
        } catch (e) {
            console.error('Failed to start proxy server:', e.message);
            return null;
        }
    }
    return proxyServer ? PROXY_PORT : null;
}

// Connect to existing Firefox via marionette port
async function connectToExistingFirefox(port) {
    try {
        // Try to connect to existing Firefox on detected marionette port
        const builder = new Builder()
            .forBrowser('firefox')
            .usingServer(`http://localhost:${port}/wd/hub`);
        
        const driver = await builder.build();
        console.error(`Connected to existing Firefox instance on port ${port}`);
        return driver;
    } catch (e) {
        console.error(`Failed to connect to existing Firefox on port ${port}:`, e.message);
        return null;
    }
}

// Helper functions
const getDriver = () => {
    if (!state.driver) {
        throw new Error('No active browser session');
    }
    return state.driver;
};

// Simplified - just use the current driver directly

const getLocator = (by, value) => {
    switch (by.toLowerCase()) {
        case 'id': return By.id(value);
        case 'css': return By.css(value);
        case 'xpath': return By.xpath(value);
        case 'name': return By.name(value);
        case 'tag': return By.css(value);
        case 'class': return By.className(value);
        default: throw new Error(`Unsupported locator strategy: ${by}`);
    }
};

// Common schemas
const browserOptionsSchema = z.object({
    headless: z.boolean().optional().describe("Run browser in headless mode"),
    arguments: z.array(z.string()).optional().describe("Additional browser arguments"),
    useProfile: z.boolean().optional().describe("Use existing Firefox profile")
}).optional();

const locatorSchema = {
    by: z.enum(["id", "css", "xpath", "name", "tag", "class"]).describe("Locator strategy to find element"),
    value: z.string().describe("Value for the locator strategy"),
    timeout: z.number().optional().describe("Maximum time to wait for element in milliseconds")
};

// Browser Management Tools
server.tool(
    "start_browser",
    "launches browser",
    {
        browser: z.enum(["chrome", "firefox"]).optional().default("firefox").describe("Browser to launch (defaults to firefox)"),
        options: browserOptionsSchema
    },
    async ({ browser = "firefox", options = {} }) => {
        try {
            state.lastActivity = Date.now();
            
            // Check if we already have a driver in this process
            if (state.driver) {
                try {
                    // Create a new tab in existing driver
                    await state.driver.switchTo().newWindow('tab');
                    const sessionId = `${browser}_tab_${Date.now()}`;
                    state.currentSession = sessionId;
                    
                    // Port will be updated after detection
                    
                    console.error(`New tab created with session_id: ${sessionId}`);
                    return {
                        content: [{ type: 'text', text: `New tab created with session_id: ${sessionId}` }]
                    };
                } catch (tabError) {
                    console.error('Error creating new tab:', tabError.message);
                    // Fall through to create/connect to browser
                }
            }
            
            // Check if another MCP process already has Firefox running
            const existingCoordination = await checkExistingFirefox();
            if (existingCoordination && existingCoordination.hasBrowser) {
                console.error('Attempting to connect via proxy...');
                
                // Try to connect via proxy first
                if (existingCoordination.proxyPort) {
                    try {
                        // Don't create a new WebDriver session, just use HTTP calls to the proxy
                        console.error('Using existing Firefox instance via proxy - no new WebDriver session needed');
                        const sessionId = `${browser}_proxy_${Date.now()}`;
                        state.currentSession = sessionId;
                        
                        // Mark that we're connected but don't store a driver instance
                        // The proxy will handle all WebDriver commands
                        state.driver = 'proxy'; // Special marker to indicate proxy mode
                        
                        console.error(`Connected via proxy with session_id: ${sessionId}`);
                        return {
                            content: [{ type: 'text', text: `Connected via proxy with session_id: ${sessionId}` }]
                        };
                    } catch (proxyError) {
                        console.error('Proxy connection failed:', proxyError.message);
                    }
                }
                
                console.error('Proxy connection unavailable, creating new browser instance');
            }
            
            // Create new browser instance
            console.error('Creating new Firefox instance...');
            const firefoxOptions = new FirefoxOptions();
            
            if (options.headless) {
                firefoxOptions.addArguments('--headless');
            }
            
            // Let Firefox choose marionette port (we'll detect it later)
            
            // Default to using the Firefox profile unless explicitly disabled
            if (options.useProfile !== false) {
                let profilePath = process.env.FIREFOX_PROFILE_PATH;
                
                // If no profile path specified, try to auto-discover it
                if (!profilePath) {
                    profilePath = await findFirefoxDefaultProfile();
                }
                
                if (profilePath) {
                    firefoxOptions.addArguments('-profile', profilePath);
                    console.error(`Using Firefox profile: ${profilePath}`);
                } else {
                    console.error('Warning: Could not find Firefox profile, starting with fresh profile');
                }
            }
            
            if (options.arguments) {
                options.arguments.forEach(arg => firefoxOptions.addArguments(arg));
            }
            
            const driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(firefoxOptions)
                .build();

            state.driver = driver;
            const sessionId = `${browser}_${Date.now()}`;
            state.currentSession = sessionId;
            
            // Detect and save the geckodriver port, then start proxy
            console.error('Setting up port detection timeout...');
            setTimeout(async () => {
                console.error('Port detection timeout triggered, detecting port...');
                const detectedPort = await detectGeckodriverPort();
                console.error(`Port detection result: ${detectedPort}`);
                if (detectedPort) {
                    // Start proxy server
                    const proxyPort = await startProxyIfNeeded(detectedPort);
                    await updateCoordination({ 
                        hasBrowser: true, 
                        port: detectedPort,
                        proxyPort: proxyPort
                    });
                    console.error(`Saved geckodriver port ${detectedPort} and proxy port ${proxyPort} to coordination file`);
                } else {
                    console.error('No geckodriver port detected during timeout callback');
                }
            }, 2000); // Wait 2 seconds for Firefox to fully start

            console.error(`Browser started with session_id: ${sessionId}`);
            return {
                content: [{ type: 'text', text: `Browser started with session_id: ${sessionId}` }]
            };
        } catch (e) {
            console.error('Error in start_browser:', e);
            return {
                content: [{ type: 'text', text: `Error starting browser: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "navigate",
    "navigates to a URL",
    {
        url: z.string().describe("URL to navigate to")
        
    },
    async ({ url }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            await driver.get(url);
            return {
                content: [{ type: 'text', text: `Navigated to ${url}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error navigating: ${e.message}` }]
            };
        }
    }
);

// Element Interaction Tools
server.tool(
    "find_element",
    "finds an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            await driver.wait(until.elementLocated(locator), timeout);
            return {
                content: [{ type: 'text', text: 'Element found' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error finding element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "click_element",
    "clicks an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            await element.click();
            return {
                content: [{ type: 'text', text: 'Element clicked' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error clicking element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "send_keys",
    "sends keys to an element, aka typing",
    {
        ...locatorSchema,
        text: z.string().describe("Text to enter into the element"),
        clear: z.boolean().optional().describe("Clear the element before typing (default: true)"),
        pressEnter: z.boolean().optional().describe("Press Enter after typing text")
    },
    async ({ by, value, text, clear = true, pressEnter = false, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            
            if (clear) {
                await element.clear();
            }
            
            await element.sendKeys(text);
            
            if (pressEnter) {
                await element.sendKeys(Key.ENTER);
            }
            
            return {
                content: [{ type: 'text', text: `Text "${text}" entered into element${pressEnter ? ' and Enter pressed' : ''}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error entering text: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "get_element_text",
    "gets the text() of an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const text = await element.getText();
            return {
                content: [{ type: 'text', text }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting element text: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "hover",
    "moves the mouse to hover over an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.move({ origin: element }).perform();
            return {
                content: [{ type: 'text', text: 'Hovered over element' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error hovering over element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "drag_and_drop",
    "drags an element and drops it onto another element",
    {
        ...locatorSchema,
        targetBy: z.enum(["id", "css", "xpath", "name", "tag", "class"]).describe("Locator strategy to find target element"),
        targetValue: z.string().describe("Value for the target locator strategy")
    },
    async ({ by, value, targetBy, targetValue, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const sourceLocator = getLocator(by, value);
            const targetLocator = getLocator(targetBy, targetValue);
            
            const sourceElement = await driver.wait(until.elementLocated(sourceLocator), timeout);
            const targetElement = await driver.wait(until.elementLocated(targetLocator), timeout);
            
            const actions = driver.actions({ bridge: true });
            await actions.dragAndDrop(sourceElement, targetElement).perform();
            
            return {
                content: [{ type: 'text', text: 'Drag and drop completed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing drag and drop: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "double_click",
    "performs a double click on an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.doubleClick(element).perform();
            return {
                content: [{ type: 'text', text: 'Double click performed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing double click: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "right_click",
    "performs a right click (context click) on an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.contextClick(element).perform();
            return {
                content: [{ type: 'text', text: 'Right click performed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing right click: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "press_key",
    "simulates pressing a keyboard key",
    {
        key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown', 'a', etc.)")
    },
    async ({ key }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const actions = driver.actions({ bridge: true });
            
            // Map common key names to Selenium Key constants
            const keyMap = {
                'Enter': Key.ENTER,
                'Return': Key.ENTER,
                'Tab': Key.TAB,
                'Escape': Key.ESCAPE,
                'Esc': Key.ESCAPE,
                'Space': Key.SPACE,
                'Backspace': Key.BACK_SPACE,
                'Delete': Key.DELETE,
                'ArrowUp': Key.ARROW_UP,
                'ArrowDown': Key.ARROW_DOWN,
                'ArrowLeft': Key.ARROW_LEFT,
                'ArrowRight': Key.ARROW_RIGHT,
                'Home': Key.HOME,
                'End': Key.END,
                'PageUp': Key.PAGE_UP,
                'PageDown': Key.PAGE_DOWN,
                'Shift': Key.SHIFT,
                'Control': Key.CONTROL,
                'Alt': Key.ALT,
                'Meta': Key.META,
                'Command': Key.META
            };
            
            const actualKey = keyMap[key] || key;
            await actions.sendKeys(actualKey).perform();
            
            return {
                content: [{ type: 'text', text: `Key '${key}' pressed` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error pressing key: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "upload_file",
    "uploads a file using a file input element",
    {
        ...locatorSchema,
        filePath: z.string().describe("Absolute path to the file to upload")
    },
    async ({ by, value, filePath, timeout = 10000 }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            await element.sendKeys(filePath);
            return {
                content: [{ type: 'text', text: 'File upload initiated' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error uploading file: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "take_screenshot",
    "captures a screenshot of the current page",
    {
        outputPath: z.string().optional().describe("Optional path where to save the screenshot. If not provided, returns base64 data.")
    },
    async ({ outputPath }) => {
        try {
            state.lastActivity = Date.now();
            const driver = getDriver();
            const screenshot = await driver.takeScreenshot();
            
            if (outputPath) {
                const fs = await import('fs');
                await fs.promises.writeFile(outputPath, screenshot, 'base64');
                return {
                    content: [{ type: 'text', text: `Screenshot saved to ${outputPath}` }]
                };
            } else {
                return {
                    content: [
                        { type: 'text', text: 'Screenshot captured as base64:' },
                        { type: 'text', text: screenshot }
                    ]
                };
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error taking screenshot: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "close_session",
    "closes the current browser session",
    {},
    async () => {
        try {
            state.lastActivity = Date.now();
            
            if (!state.driver || !state.currentSession) {
                return {
                    content: [{ type: 'text', text: 'No active session to close' }]
                };
            }
            
            const sessionId = state.currentSession;
            const driver = getDriver();
            
            // Try to close the current window/tab
            try {
                const allHandles = await driver.getAllWindowHandles();
                if (allHandles.length > 1) {
                    await driver.close();
                    
                    // Switch to remaining tab
                    const remainingHandles = await driver.getAllWindowHandles();
                    if (remainingHandles.length > 0) {
                        await driver.switchTo().window(remainingHandles[0]);
                    }
                    
                    return {
                        content: [{ type: 'text', text: `Tab session ${sessionId} closed` }]
                    };
                } else {
                    // Last tab - close entire browser
                    await driver.quit();
                    state.driver = null;
                    state.currentSession = null;
                    
                    // Close proxy server if running
                    if (proxyServer) {
                        proxyServer.close();
                        proxyServer = null;
                    }
                    
                    return {
                        content: [{ type: 'text', text: `Browser session ${sessionId} closed (last tab)` }]
                    };
                }
            } catch (closeError) {
                // If close fails, force quit
                await driver.quit();
                state.driver = null;
                state.currentSession = null;
                
                if (proxyServer) {
                    proxyServer.close();
                    proxyServer = null;
                }
                
                return {
                    content: [{ type: 'text', text: `Browser session ${sessionId} force closed` }]
                };
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error closing session: ${e.message}` }]
            };
        }
    }
);

// Resources
server.resource(
    "browser-status",
    new ResourceTemplate("browser-status://current"),
    async (uri) => ({
        contents: [{
            uri: uri.href,
            text: state.currentSession 
                ? `Active browser session: ${state.currentSession}`
                : "No active browser session"
        }]
    })
);

// Cleanup handler
async function cleanup() {
    if (state.driver && state.driver !== 'proxy') {
        try {
            await state.driver.quit();
            console.error('Browser closed during cleanup');
        } catch (e) {
            console.error('Error closing browser during cleanup:', e);
        }
    } else if (state.driver === 'proxy') {
        console.error('Proxy connection closed during cleanup');
    }
    
    // Close proxy server
    if (proxyServer) {
        try {
            proxyServer.close();
            console.error('Proxy server closed during cleanup');
        } catch (e) {
            console.error('Error closing proxy server during cleanup:', e);
        }
    }
    
    // Clean up coordination file
    try {
        await fs.unlink(COORDINATION_FILE).catch(() => {});
    } catch (e) {
        // Ignore errors
    }
    
    state.driver = null;
    state.currentSession = null;
    proxyServer = null;
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);