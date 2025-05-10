const puppeteer = require('puppeteer-core');
const fetch = require('node-fetch'); // Added for 2FA service polling

const username = '4724090919663060';
const password = '123mxypkwj'; // Be careful with hardcoding sensitive information

// User data directory and Browserless token
const USER_DATA_DIR = '~/Library/Application Support/Google/Chrome/'; // Default macOS Chrome directory
const BROWSERLESS_TOKEN = 'KALAAM786'; // Your new token
const BASE_BROWSERLESS_URL = 'wss://kalaam.ngrok.app'; // Your new ngrok URL

// Login page selectors
const usernameSelector = 'input[type="text"][formcontrolname="username"]';
const passwordSelector = 'input[type="password"][formcontrolname="password"]';
const loginButtonSelector = "form.login-form button.td-button-secondary";

// 2FA selectors
const twoFactorModalSelector = '#mat-dialog-0';
const textMeButtonBaseSelector = 'button.td-button-secondary'; // Used within page.evaluate
const otpInputSelector = 'input#code';
const otpSubmitButtonBaseClass = 'button.td-button-secondary'; // Base class for the submit button

const loginUrl = 'https://easyweb.td.com/';
const targetPageUrlPrefix = 'https://easyweb.td.com'; // Or more specific if needed after login
const manualOtpWaitSeconds = 60; // This will be repurposed for polling timeout message if needed, but primary control is in retrieve2FACode

async function retrieve2FACode() {
    const pollingUrl = 'https://2fa.ngrok.app/get-2fa-code';
    const maxAttempts = 120; // e.g., 120 attempts * 5 seconds = 10 minutes
    const intervalMs = 5000;
    let attempts = 0;

    console.error(`Polling ${pollingUrl} for 2FA code...`);
    while (attempts < maxAttempts) {
        console.error(`Checking for 2FA code (attempt ${attempts + 1}/${maxAttempts})...`);
        try {
            const response = await fetch(pollingUrl);
            if (response.ok) {
                const data = await response.json();
                if (data && data.code) {
                    console.error(`2FA code received: ${data.code}`);
                    return data.code;
                }
            } else {
                console.warn(`Polling for 2FA code failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error polling 2FA service:', error.message);
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    console.error('Timed out waiting for 2FA code from service.');
    return null;
}

async function run() {
  let browser;
  let page; // Define page in the outer scope

  try {
    console.error('Constructing Browserless WebSocket endpoint...');
    // Define launch options for headful and stealth mode
    const launchOptions = {
      headless: false,
      stealth: true
      // You can add other args here if needed, e.g., args: ['--window-size=1920,1080']
      // but page.setViewport below should also work.
    };

    // Construct the Browserless WebSocket endpoint URL
    // Includes user data directory, token, and launch options for headful mode
    const browserWSEndpoint = `${BASE_BROWSERLESS_URL}?token=${BROWSERLESS_TOKEN}&--user-data-dir=${encodeURIComponent(USER_DATA_DIR)}&launch=${encodeURIComponent(JSON.stringify(launchOptions))}`;
    
    console.error(`Connecting to Browserless (attempting headful): ${browserWSEndpoint.replace(BROWSERLESS_TOKEN, 'YOUR_NEW_TOKEN')}`); // Mask token
    browser = await puppeteer.connect({
      browserWSEndpoint,
      defaultViewport: null 
    });
    console.error('Connected to Browserless!');

    // Page handling: Browserless typically gives you a fresh context,
    // so trying to find an existing page might not be as relevant as with local persistent.
    // We will open a new page.
    console.error('Opening a new page in Browserless session...');
    page = await browser.newPage();

    page.on('error', err => {
        console.error(`>>> Page emitted an 'error' event: ${err.message}`, err);
    });
    page.on('pageerror', pageErr => {
        console.error(`>>> Page emitted a 'pageerror' (uncaught exception): ${pageErr.message}`, pageErr);
    });
    page.on('requestfailed', request => {
        console.warn(`>>> Page request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'); // Modern User Agent
    await page.setViewport({ width: 1920, height: 1080 }); // Standard viewport
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Increased timeout for network
    console.error(`Navigated to login page: ${loginUrl}`);

    // --- Check if already logged in ---
    let isLoggedIn = false;
    // const logoutSelector = "tduf-top-nav-link a:has-text('Logout')"; // Original selector
    const logoutSelector = "xpath//*[contains(translate(., 'LOGOUT', 'logout'), 'logout')]"; // General XPath selector
    try {
        console.error('Waiting 2 seconds for page to potentially settle...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Added delay

        console.error(`Checking for element containing 'Logout' (XPath: ${logoutSelector}) with timeout (5s)...`); // Updated log
        await page.waitForSelector(logoutSelector, { visible: true, timeout: 5000 }); // Decreased timeout
        console.error('Element containing "Logout" found. Assuming already logged in.'); // Updated log
        isLoggedIn = true;
    } catch (e) {
        console.error('Element containing "Logout" not found within timeout. Assuming not logged in.'); // Updated log
        // If not logged in, make sure we are on the login page before proceeding
        if (!page.url().startsWith(loginUrl)) {
             console.error(`Not on login page (${page.url()}). Navigating to: ${loginUrl}`);
             await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
             console.error('Page navigated to login URL.');
        } else {
             console.error('Already on login page.');
        }
        isLoggedIn = false;
    }

    if (!isLoggedIn) {
        // --- Start: Automated Login Steps (Only run if not logged in) ---
        console.error('Running login steps...');

        console.error('Checking if username field is present and page is stable before interaction...');
        await page.waitForSelector(usernameSelector, { visible: true, timeout: 15000 }); // Increased timeout
        console.error('Username selector is visible. Pausing for 5 seconds to observe stability...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.error('Pause finished. Proceeding to interact with username field...');
        
        // Try to find username field, but don't fail if it's not there (might be remembered due to user-data-dir)
        try {
            console.error(`Attempting to find username selector: ${usernameSelector} with short timeout...`);
            await page.waitForSelector(usernameSelector, { visible: true, timeout: 5000 }); // Increased timeout
            console.error('Username input found. Clicking and typing username...');
            await page.click(usernameSelector); // Click to focus
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            // Clear field first in case it's pre-filled
            await page.click(usernameSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(usernameSelector, username, { delay: 50 }); // Type with a small delay
        } catch (e) {
            console.error(`Username input not found or error during username input: ${e.message}. Assuming pre-filled or not required.`);
        }

        console.error(`Waiting for password and login button...`);
        await page.waitForSelector(passwordSelector, { visible: true, timeout: 5000 }); // Decreased timeout
        console.error('Password input found. Clicking and typing password...');
        await page.click(passwordSelector); // Click to focus
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        // Clear field first
        await page.click(passwordSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(passwordSelector, password, { delay: 50 }); // Type with a small delay

        console.error('Waiting for login button to be ready...');
        await page.waitForSelector(loginButtonSelector, { visible: true, timeout: 5000 });
        console.error('Login button found.');

        console.error('Clicking login button and initiating navigation/2FA wait...');
        // Start the click but don't await it immediately
        const clickPromise = page.click(loginButtonSelector);

        let is2FAPageReadyForCode = false;
        // isDirectLoginConfirmed will be set if logoutSelector is seen directly
        let isDirectLoginConfirmed = false; 

        try {
            console.error('Waiting for either 2FA modal or successful login (logout button)...');
            const raceResult = await Promise.race([
                page.waitForSelector(twoFactorModalSelector, { visible: true, timeout: 35000 }).then(() => '2faModal'),
                page.waitForSelector(logoutSelector, { visible: true, timeout: 35000 }).then(() => 'logoutButton')
            ]);

            if (raceResult === '2faModal') {
                console.error('2FA modal detected.');
                try {
                    console.error(`Attempting to find, scroll, and click "Text me" button inside ${twoFactorModalSelector}...`);
                    const textMeButtonHandle = await page.evaluateHandle((modalSel, btnClass) => {
                        const modal = document.querySelector(modalSel);
                        if (!modal) return null;
                        const buttons = modal.querySelectorAll(btnClass);
                        for (const button of buttons) {
                            if (button.textContent?.trim() === 'Text me') {
                                if (button instanceof HTMLElement) {
                                    button.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                }
                                return button; // Return the element itself for the handle
                            }
                        }
                        return null; // Button with specific text not found
                    }, twoFactorModalSelector, textMeButtonBaseSelector);

                    if (textMeButtonHandle && (await textMeButtonHandle.asElement())) {
                        console.error('"Text me" button found and scrolled. Pausing briefly before click...');
                        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for scroll and UI to settle
                        await textMeButtonHandle.click();
                        console.error('"Text me" button clicked.');
                        await textMeButtonHandle.dispose(); // Clean up the JSHandle
                    } else {
                        if(textMeButtonHandle) await textMeButtonHandle.dispose(); // Clean up if handle exists but not element
                        throw new Error('Failed to find and scroll "Text me" button in the 2FA modal.');
                    }
                    
                    console.error(`Waiting for OTP input field (${otpInputSelector}) to appear...`);
                    await page.waitForSelector(otpInputSelector, { visible: true, timeout: 15000 });
                    console.error('OTP input field is visible. Ready for 2FA code from service.');
                    is2FAPageReadyForCode = true;
                } catch (textMeOrOtpError) {
                    console.error(`Error clicking "Text me" or waiting for OTP input: ${textMeOrOtpError.message}`);
                    // Potentially dump page content here if useful for debugging this specific step
                }
            } else if (raceResult === 'logoutButton') {
                console.error('Logout button detected directly after login click. Assuming successful login, skipping 2FA.');
                isLoggedIn = true; // Already set by the main login check, but good to be explicit
                isDirectLoginConfirmed = true;
            }
        } catch (e) {
            console.warn(`Timeout or error waiting for 2FA modal/logout after login click: ${e.message}`);
            console.warn(`Current page URL: ${page.url()}. Will proceed to explicit checks.`);
        }
        
        // Ensure the main login click promise is resolved, regardless of race outcome
        try {
            await clickPromise;
            console.error('Main login button click promise resolved.');
        } catch (clickError) {
            console.warn(`Error from main login button click promise: ${clickError.message}`);
        }

        // --- End: Automated Login Steps ---

        // --- Start: 2FA Handling with Custom 2FA Service ---
        // This block now primarily relies on is2FAPageReadyForCode being true.
        // If isDirectLoginConfirmed is true, isLoggedIn is already true, and this block will be skipped.
        
        if (is2FAPageReadyForCode && !isLoggedIn) {
            console.error('\n----------------------------------------------------------------------');
            console.error('!!! ACTION REQUIRED FOR 2FA !!!');
            console.error('Please go to https://2fa.ngrok.app/input-2fa in your browser to submit the 2FA code.');
            console.error('The script is now polling for the code from that service.');
            console.error('----------------------------------------------------------------------\n');

            const twoFactorAuthCode = await retrieve2FACode();

            if (twoFactorAuthCode) {
                console.error(`Typing 2FA code into selector: ${otpInputSelector}`);
                await page.type(otpInputSelector, twoFactorAuthCode, { delay: 50 });
                
                // console.log(`Clicking 2FA submit button: ${otpSubmitButtonSelector}`); // Old log
                try {
                    // await page.waitForSelector(otpSubmitButtonSelector, { visible: true, timeout: 5000}); // No longer needed
                    // await page.click(otpSubmitButtonSelector); // Replaced by page.evaluate

                    console.error('Attempting to find and click OTP "Enter" button using page.evaluate...');
                    const clickedOtpEnterButton = await page.evaluate((modalSel, btnClass) => {
                        const scope = document.querySelector(modalSel) || document; // Search in modal or whole document
                        const buttons = scope.querySelectorAll(btnClass);
                        for (const button of buttons) {
                            if (button.textContent?.trim().toLowerCase() === 'enter') { // Case-insensitive match
                                if (button instanceof HTMLElement) button.click();
                                return true;
                            }
                        }
                        return false;
                    }, twoFactorModalSelector, otpSubmitButtonBaseClass);

                    if (!clickedOtpEnterButton) {
                        throw new Error('Failed to find and click OTP "Enter" button via page.evaluate.');
                    }
                    console.error('OTP "Enter" button clicked via page.evaluate.');

                    // Verify login success after 2FA submission
                    console.error('Waiting for login confirmation after 2FA submission...');
                    await page.waitForSelector(logoutSelector, { visible: true, timeout: 30000 }); // Increased timeout post-2FA
                    console.error('Logout element found. Login confirmed after 2FA.');
                    isLoggedIn = true;
                } catch (submitOrConfirmError) {
                    console.error('Error submitting 2FA or confirming login afterwards:', submitOrConfirmError);
                    throw new Error('Failed to submit 2FA or confirm login: ' + submitOrConfirmError.message);
                }
            } else {
                console.error('Could not retrieve 2FA code from service. Login cannot proceed.');
                throw new Error('Failed to retrieve 2FA code from the custom service.');
            }
        }
        // --- End: 2FA Handling ---
    } // End of if (!isLoggedIn)

    // If after all login and 2FA attempts, we are still not logged in, throw an error.
    if (!isLoggedIn) {
        // Re-check one last time to be absolutely sure
        try {
            await page.waitForSelector(logoutSelector, { visible: true, timeout: 5000 });
            console.error('Final check: Logout element found. Proceeding.');
            isLoggedIn = true;
        } catch (e) {
            console.error('Fatal Error: Script is not logged in after all attempts. Dumping current page content and exiting.');
            const finalPageContent = await page.content();
            console.error('--- Final Page Content Start ---');
            console.error(finalPageContent);
            console.error('--- Final Page Content End ---');
            throw new Error('Failed to log in after all attempts. Check credentials, 2FA, and selectors.');
        }
    }

    // --- Start: Post-Login Actions (Run only if login is confirmed) ---
    console.error('Proceeding to Interac e-Transfer navigation...');

    const eTransferTargetUrl = 'https://easyweb.td.com/waw/webui/emt/#/';
    const currentUrl = page.url();
    console.error(`Current URL is: ${currentUrl}`);

    if (!currentUrl.startsWith(eTransferTargetUrl)) {
        console.error('Not on e-Transfer page yet, attempting navigation...');
        // const eTransferLinkSelector = 'tduf-quick-link-item a:has-text("Interac")'; // Selector for the quick link - Failed
        // const eTransferLinkSelector = "xpath//tduf-quick-link-item//a[.//span[contains(., 'Interac e-Transfer')]]"; // XPath selector - Failed
        // const eTransferLinkSelector = 'a:has-text("Interac e-Transfer®")'; // Left Nav CSS selector - Failed
        // const eTransferLinkSelector = 'tduf-left-nav a:has-text("Interac e-Transfer")'; // Failed - Incorrect container
        // const eTransferLinkSelector = 'tduf-left-nav-menu a:has-text("e-Transfer")'; // Failed - has-text unreliable?
        // const eTransferLinkSelector = "xpath//tduf-left-nav-menu//a[contains(., 'e-Transfer')]"; // Try XPath - Failed
        // const eTransferLinkSelector = "xpath//tduf-left-nav-menu//nav/ul/li/a[contains(., 'e-Transfer')]"; // More specific XPath - Failed
        const eTransferLinkSelector = "#td-nav-left > tduf-left-nav-menu > nav > ul > li:nth-child(4) > a"; // Try specific CSS selector from user - Worked
        console.error(`Looking for e-Transfer link in left nav with selector: ${eTransferLinkSelector}`);
        // await new Promise(resolve => setTimeout(resolve, 1000)); // Keep 1-second delay for now - Removing delay, should not be needed if selector is correct
        await page.waitForSelector(eTransferLinkSelector, { visible: true, timeout: 15000 }); // Keep increased timeout for now
        console.error('Clicking Interac e-Transfer link in left nav...');
        // page.click() usually works well with :has-text - May need $x and click for XPath
        // const [eTransferButton] = await page.$x(eTransferLinkSelector); // Use $x for XPath
        // if (eTransferButton) {
        //     console.error('Found button via $x, attempting click...');
        //     await eTransferButton.click();
        // } else {
        //     throw new Error(`Could not find element with XPath: ${eTransferLinkSelector}`);
        // }
        await page.click(eTransferLinkSelector); // Use page.click for CSS selectors

        console.error('Waiting for e-Transfer page to load after click...');
        // Use Promise.all to wait for both navigation AND a known element on the target page
        // Example: Wait for a specific title or a known element ID on the e-Transfer page
        // Replace 'Expected e-Transfer Page Title' with the actual title or a selector like '#transfer-history-button'
        // const expectedElementSelectorOnEtransferPage = '#pfsTableCA_BANK'; // Example: Reuse a table ID if it exists there too, or find a better one.
        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
            // await Promise.all([
            //     page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            //     // page.waitForSelector(expectedElementSelectorOnEtransferPage, { visible: true, timeout: 15000 }) // Optional: Wait for a specific element too
            // ]);
            console.error('Navigated to e-Transfer page (based on navigation completion).');
        } catch (navError) {
             console.error('Error waiting for navigation to e-Transfer page:', navError);
             // Log current content to see where we ended up
             console.error('Logging page content after e-Transfer navigation attempt...');
             const contentAfterEtransferNav = await page.content();
             console.error('--- Page Content After e-Transfer Nav Attempt Start ---');
             console.error(contentAfterEtransferNav);
             console.error('--- Page Content After e-Transfer Nav Attempt End ---');
             throw navError; // Re-throw error after logging
        }
    } else {
        console.error('Already on e-Transfer page. Skipping navigation click.');
    }

    console.error(`Current URL: ${page.url()}`);
    console.error(`Current Title: ${await page.title()}`);

    // --- Navigate to History Page ---
    console.error('Navigating to e-Transfer History page...');
    const historyLinkSelector = 'a[href="#/history"]' // Confirmed working selector
    console.error(`Attempting to find History link. Current URL: ${await page.url()}`);
    console.error(`Waiting for History link selector: ${historyLinkSelector}`);
    // Add a small pause before waiting for selector, in case of slow rendering
    console.error('Pausing for 3 seconds before waiting for history link...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.waitForSelector(historyLinkSelector, { visible: true, timeout: 30000 }); // Increased timeout
    console.error('Clicking History link...');
    await page.click(historyLinkSelector);

    // --- Scrape History Table ---
    console.error('Waiting for history table body to appear...');
    const historyTableBodySelector = 'ezw-emt-history-grid tbody';
    await page.waitForSelector(historyTableBodySelector, { visible: true, timeout: 15000 });
    console.error('History table body found. Scraping data...');

    console.error(`History page (Money Sent tab) should be loaded. URL: ${page.url()}`);

    // --- Click Money Received Tab ---
    console.error('Attempting to click the "Money Received" tab...');
    const moneyReceivedTabSelector = 'div.td-tabs ul > li:nth-child(3) > span.td-tabs-label > a';
    try {
        console.error(`Preparing to wait for Money Received tab selector: ${moneyReceivedTabSelector}`);
        await page.waitForSelector(moneyReceivedTabSelector, { visible: true, timeout: 5000 }); // Decreased timeout
        console.error(`"Money Received" tab selector found: ${moneyReceivedTabSelector}`);
        await page.click(moneyReceivedTabSelector);
        console.error('Clicked "Money Received" tab.');
        console.error('Pausing 5 seconds for Money Received tab content to initially load...');
        await new Promise(resolve => setTimeout(resolve, 5000)); 

        // --- Repeatedly click "Show more" on Money Received tab ---
        const showMoreSelectors = [
            'ezw-emt-history-grid a#get-all-data.td-link-standalone-secondary:has-text("Show more")', // S1: ID, specific class, text
            'ezw-emt-history-grid a#get-all-data',                                                  // S2: ID only
            'ezw-emt-history-grid a.td-link-standalone-secondary:has-text("Show more")'             // S3: Specific class, text
        ];
        let showMoreVisible = true;
        let clickCount = 0;

        while (showMoreVisible) {
            let clickedInThisIteration = false;
            for (const selector of showMoreSelectors) {
                try {
                    console.error(`Loop ${clickCount + 1}, Attempting selector: ${selector}`);
                    await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                    console.error(`"Show more" button found with selector: ${selector}. Clicking it...`);
                    await page.click(selector);
                    clickCount++;
                    console.error(`Clicked "Show more" ${clickCount} time(s). Pausing 4 seconds for content to load...`);
                    await new Promise(resolve => setTimeout(resolve, 4000));
                    clickedInThisIteration = true;
                    break; // Found and clicked, exit selector loop for this iteration
                } catch (e) {
                    console.error(`Selector ${selector} failed or timed out.`);
                }
            }

            if (!clickedInThisIteration) {
                console.error('All "Show more" selectors failed in this iteration. Assuming all transactions are loaded.');
                showMoreVisible = false; // Stop the while loop
            }
        }
        console.error('Finished clicking "Show more". Total clicks: ' + clickCount);

        // --- Scrape Money Received Table ---
        console.error('Waiting for Money Received history table body to ensure it is settled...');
        const receivedHistoryTableBodySelector = 'ezw-emt-history-grid tbody'; // Same table container structure
        await page.waitForSelector(receivedHistoryTableBodySelector, { visible: true, timeout: 5000 }); // Decreased timeout
        console.error('Money Received history table body found. Scraping data...');

        const receivedTransactions = await page.$$eval(
            `${receivedHistoryTableBodySelector} tr`,
            (rows, currentYear) => {
              return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length >= 4) {
                  let dateDeposited = cells[0]?.innerText.trim();
                  // Append current year if year is missing, assuming transactions are for the current or previous year contextually handled by month filter
                  if (dateDeposited && !/\d{4}/.test(dateDeposited)) {
                      dateDeposited += ', ' + currentYear;
                  }
                  return {
                    dateDeposited,
                    receivedFrom: cells[1]?.innerText.trim(),
                    amount: cells[2]?.innerText.trim(),
                    method: cells[3]?.innerText.trim(),
                    status: cells[4]?.innerText.trim() // Status is often in the 5th column
                  };
                }
                return null;
              }).filter(Boolean); // Remove null entries for rows that didn't match structure
            },
            new Date().getFullYear() // Pass current year for date reconstruction
          );

          console.error('--- Money Received Transactions --- ');
          console.log(JSON.stringify(receivedTransactions, null, 2));

    } catch (error) {
        console.error(`Error clicking or processing "Money Received" tab: ${error.message}`);
        // Removed HTML logging here, error message should suffice for most cases
    }

    // TODO: Scrape "Money Requested" tab if needed

    console.error('Pausing for 5 seconds before detaching...');
    // await page.waitForTimeout(5000); // Replace failing function
    await new Promise(resolve => setTimeout(resolve, 5000)); // Use standard JS timeout
    // --- End: Post-Login Actions ---

    console.error('Script finished successfully.');

  } catch (error) {
    // Keep existing error handling
     if (error.message.includes('Stopping execution')) { // Catch any intentional stop
         console.error(error.message);
    } else {
        console.error('An error occurred during main execution:', error); // Clarified error source
    }
  } finally {
    if (browser) {
      console.error('Closing Browserless browser connection...');
      await browser.close(); // Use close() for Browserless
    }
    console.error('Script execution ended.');
  }
}

run(); 