import { GoogleGenAI, Type } from "@google/genai";
import { 
    getTextFromCache, 
    storeTextInCache, 
    MODEL_GEMINI_FLASH 
} from '../financial-reports/scripts/ai_cache_utils.js';
import 'dotenv/config';
import sqlite3 from 'sqlite3'; // Added for DB query
import pLimit from 'p-limit';   // Added for concurrency
import JSON5 from 'json5'; // Import JSON5

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DB_PATH = "/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/financial-reports/data/categorized_transactions.db";
const CONCURRENCY_LIMIT = 20; // Max 20 concurrent API calls

const ALLOWED_CATEGORIES = [
    "Bank Fees",
    "Business Expense",
    "Cash Withdrawal",
    "Charitable Donation",
    "Childcare Expenses",
    "Credit Card Payment",
    "Dining & Entertainment",
    "Education/Tuition",
    "Employment Income",
    "FHSA Contribution",
    "Gifts & Celebrations (Non-Charitable)",
    "Government Benefits",
    "Groceries",
    "Home Office Expenses",
    "Housing (Mortgage/Rent/PropertyTax)",
    "Insurance (Home/Auto/Life)",
    "Investment Income",
    "Investment Transaction (Buy/Sell)",
    "Loan Payment",
    "Medical Expense",
    "Moving Expenses",
    "Other Expense",
    "Other Income",
    "Personal Care",
    "Pet Care",
    "RRSP Contribution",
    "Recreation & Fitness",
    "Refund (Non-Tax)",
    "Self-Employment Income",
    "Shopping (General)",
    "Subscriptions (Non-News/Entertainment)",
    "Tax Payment",
    "Transfer (Between Own Accounts)",
    "Transfer (E-transfer Incoming)",
    "Transfer (E-transfer Outgoing)",
    "Transportation (Fuel/Transit/Maintenance)",
    "Travel",
    "Uncategorized/Review Needed",
    "Union & Professional Dues",
    "Utilities (Hydro/Gas/Water/Telecom)"
];

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found in .env file. Please ensure it is set.");
    process.exit(1);
}

// Ensure the table for tagged transactions exists before any tagging starts.
// This is called once at the beginning of the script.
createTaggedTransactionsTableIfNotExists().catch(err => {
    console.error("Failed to create tagged_transactions_2023 table on startup. Exiting.", err);
    process.exit(1); 
});

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function tagTransaction(transaction) {
    const transactionDescription = transaction.Description;
    let taggedTransactionData; // To store the successfully tagged data

    try {
        const cachedResponse = await getTextFromCache(DB_PATH, transactionDescription, MODEL_GEMINI_FLASH);
        if (cachedResponse) {
            try {
                const parsedResponse = JSON5.parse(cachedResponse);
                taggedTransactionData = { ...transaction, ...parsedResponse, _cached: true };
                // Incrementally save if from cache and parsed successfully
                await saveSingleTaggedTransaction(taggedTransactionData);
                return taggedTransactionData;
            } catch (e) {
                console.error(`Error parsing cached JSON5 for "${transactionDescription}":`, e.message);
                // If cache is corrupt, proceed to API call
            }
        }

        // Convert ALLOWED_CATEGORIES to a string format suitable for the prompt
        const allowedCategoriesString = ALLOWED_CATEGORIES.map(c => `"${c}"`).join(", ");

        // Stringify the whole transaction object for the prompt
        const transactionObjectString = JSON.stringify(transaction, null, 2); // Pretty print for prompt clarity

        const prompt = `
Analyze the following bank transaction object:

${transactionObjectString}

Based on the transaction object above, your response MUST be ONLY a valid JSON5 object, without any markdown formatting (no \`\`\`json5 or \`\`\`) and no conversational text.
The JSON5 object MUST have the following structure:
{
  category: "string", // THIS MUST BE ONE OF THE FOLLOWING EXACT VALUES: ${allowedCategoriesString}
  merchant: "string", // e.g., "Walmart", "Hydro One", "Employer Name" or "N/A" if not applicable. Extract from the transaction object if possible.
  tags: ["string", "string"] // e.g., ["food", "household"], ["electricity", "bill"], ["salary"]. Relevant tags based on the transaction.
}

Example based on a hypothetical transaction object:
If the transaction object contained a description like "TIM HORTONS #1234 TORONTO ON", the JSON5 output should be:
{
  category: "Dining & Entertainment", // Assuming "Dining & Entertainment" is in the allowed list above
  merchant: "Tim Hortons",
  tags: ["coffee", "quick service", "restaurant"]
}

Now, provide the JSON5 output for the transaction object provided above.`;
        
        const generationConfig = { 
            temperature: 0,
            response_mime_type: "application/json", // Keep JSON mode
        };
        
        const safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ];

        const result = await genAI.models.generateContent({
            model: MODEL_GEMINI_FLASH,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings
        });
        
        let llmResponseJson;
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
            let rawText = result.candidates[0].content.parts[0].text;
            try {
                const cleanedText = rawText.replace(/^```(?:json5)?\s*|\s*```$/g, '').trim();
                llmResponseJson = JSON5.parse(cleanedText); 

                // ---- START Category Validation and Correction ----
                if (llmResponseJson && llmResponseJson.category && !ALLOWED_CATEGORIES.includes(llmResponseJson.category)) {
                    console.warn(`Category "${llmResponseJson.category}" from AI for "${transactionDescription}" is not in ALLOWED_CATEGORIES. Setting to "Uncategorized/Review Needed".`);
                    llmResponseJson.category = "Uncategorized/Review Needed";
                } else if (!llmResponseJson || !llmResponseJson.category) {
                    console.warn(`No category found or LLM response malformed for "${transactionDescription}". Setting to "Uncategorized/Review Needed".`);
                    if (!llmResponseJson) llmResponseJson = {}; // Ensure llmResponseJson exists
                    llmResponseJson.category = "Uncategorized/Review Needed";
                    // Ensure merchant and tags exist if llmResponseJson was initially null/malformed for category
                    if (!llmResponseJson.merchant) llmResponseJson.merchant = "N/A";
                    if (!llmResponseJson.tags) llmResponseJson.tags = [];
                }
                // ---- END Category Validation and Correction ----

            } catch (e) {
                console.error(`Error parsing Gemini JSON5 response for "${transactionDescription}": ${e.message}`);
                console.error("Raw response text was:", rawText);
                return { ...transaction, _error: "Failed to parse LLM JSON5", _raw_response: rawText }; 
            }
            await storeTextInCache(DB_PATH, transactionDescription, MODEL_GEMINI_FLASH, JSON5.stringify(llmResponseJson));
            taggedTransactionData = { ...transaction, ...llmResponseJson, _cached: false };
            // Incrementally save if from API and parsed successfully
            await saveSingleTaggedTransaction(taggedTransactionData);
            return taggedTransactionData;
        } else {
            let errorDetail = "No valid content candidate part from Gemini";
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].finishReason) {
                errorDetail += ` Finish Reason: ${result.candidates[0].finishReason}`;
                if (result.candidates[0].safetyRatings) {
                    errorDetail += ` Safety Ratings: ${JSON.stringify(result.candidates[0].safetyRatings)}`
                }
            }
             if (result.promptFeedback) {
                errorDetail += ` Prompt Feedback: ${JSON.stringify(result.promptFeedback)}`;
            }
            console.error(`${errorDetail} for "${transactionDescription}"`);
            return { ...transaction, _error: errorDetail };
        }

    } catch (error) {
        console.error(`General error tagging transaction "${transactionDescription}":`, error);
        let errorMessage = "Unknown error during tagging";
        if (error.message) errorMessage = error.message;
        if (error.response && error.response.promptFeedback) {
             errorMessage += ` API Feedback: ${JSON.stringify(error.response.promptFeedback)}`;
        }
        return { ...transaction, _error: errorMessage };
    }
}

async function fetchTransactions() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error(`Error opening database at ${DB_PATH}:`, err.message);
                return reject(err);
            }
        });

        const query = "SELECT * FROM transactions WHERE strftime('%Y', Date) = '2023';";
        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                console.error("Error fetching transactions:", err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

async function main() {
    console.log("--- Starting Full Transaction Processing (2023) ---");
    let transactions;
    try {
        transactions = await fetchTransactions();
        console.log(`Fetched ${transactions.length} transactions for 2023.`);
    } catch (error) {
        console.error("Failed to fetch transactions. Aborting.", error);
        return;
    }

    if (!transactions || transactions.length === 0) {
        console.log("No 2023 transactions found to process.");
        return;
    }

    const limit = pLimit(CONCURRENCY_LIMIT);
    let processedCount = 0;
    let startTime = Date.now();

    // --- Removing Sample Run Modification ---
    // const sampleSize = 25; 
    // const transactionsToProcess = transactions.slice(0, sampleSize);
    // console.log(`--- Processing a SAMPLE of ${transactionsToProcess.length} transactions ---`);
    const transactionsToProcess = transactions; // Process all transactions
    console.log(`--- Processing all ${transactionsToProcess.length} transactions ---`);
    // --- End of Sample Run Modification ---

    const taggingPromises = transactionsToProcess.map(tx => {
        return limit(async () => {
            const result = await tagTransaction(tx);
            processedCount++;
            if (processedCount % 50 === 0 || processedCount === transactionsToProcess.length) { // Log every 50 or at the end
                const elapsedTime = (Date.now() - startTime) / 1000;
                console.log(`Tagged ${processedCount} of ${transactionsToProcess.length} transactions... (${elapsedTime.toFixed(2)}s)`);
            }
            return result;
        });
    });

    const allTaggedTransactions = await Promise.all(taggingPromises);
    const endTime = Date.now();
    console.log("--- Full Transaction Processing Complete ---"); // Updated log
    console.log(`Total time taken: ${((endTime - startTime) / 1000).toFixed(2)} seconds.`); // Updated log

    let newTags = 0;
    let cachedTags = 0;
    let errors = 0;
    allTaggedTransactions.forEach(tx => {
        if (tx._error) errors++;
        else if (tx._cached) cachedTags++;
        else newTags++;
    });
    console.log(`Summary: New tags: ${newTags}, Cached tags: ${cachedTags}, Errors: ${errors}`); // Updated log

    // Removed incremental saving summary as it happens within tagTransaction
    console.log("Full run finished. Data has been incrementally saved.");
    // process.exit(0); // REMOVE THIS LINE to allow full script execution
}

async function createTaggedTransactionsTableIfNotExists() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error(`Error opening database for creating table at ${DB_PATH}:`, err.message);
                return reject(err);
            }
        });

        // id is now PRIMARY KEY for INSERT OR REPLACE
        // Removed FOREIGN KEY constraint for simplicity with INSERT OR REPLACE, 
        // as it might cause issues if original transaction.id is not perfectly unique or present.
        // We assume transaction.id from the source data is sufficiently unique for our upsert purposes.
        const createTableSql = `
        CREATE TABLE IF NOT EXISTS tagged_transactions_2023 (
            id INTEGER PRIMARY KEY, 
            Date DATE,
            "Account Name" TEXT,
            Amount REAL,
            Description TEXT,
            SourceFile TEXT,
            PrimaryCategory TEXT,
            Currency TEXT,
            RawData TEXT,
            SheetTransactionID TEXT,
            ai_category TEXT,
            ai_merchant TEXT,
            ai_tags TEXT
        );
        `;
        
        db.exec(createTableSql, (err) => {
            if (err) {
                console.error("Error creating tagged_transactions_2023 table:", err.message);
                db.close();
                return reject(err);
            }
            const createIndexSql = `CREATE INDEX IF NOT EXISTS idx_tagged_transactions_2023_description ON tagged_transactions_2023 (Description);`;
            db.exec(createIndexSql, (indexErr) => {
                db.close(); // Close DB connection
                if (indexErr) {
                    console.error("Error creating index on tagged_transactions_2023 table:", indexErr.message);
                    // Not rejecting here, as table creation was successful.
                }
                console.log("Table 'tagged_transactions_2023' checked/created successfully.");
                resolve();
            });
        });
    });
}

// New function to save a single tagged transaction using INSERT OR REPLACE
async function saveSingleTaggedTransaction(tx) {
    if (!tx || tx._error || !tx.id) { // Ensure tx is valid, not an error, and has an ID
        // console.warn("Skipping save for transaction without ID or with error:", tx && tx.Description ? tx.Description : "Unknown");
        return;
    }

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error(`Error opening database for saving single transaction at ${DB_PATH}:`, err.message);
                return reject(err);
            }
        });

        const insertOrReplaceSql = `
        INSERT OR REPLACE INTO tagged_transactions_2023 (
            id, Date, "Account Name", Amount, Description, SourceFile, PrimaryCategory, Currency, RawData, SheetTransactionID,
            ai_category, ai_merchant, ai_tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        
        db.run(insertOrReplaceSql, [
            tx.id, 
            tx.Date, 
            tx["Account Name"], 
            tx.Amount, 
            tx.Description, 
            tx.SourceFile,
            tx.PrimaryCategory, 
            tx.Currency, 
            tx.RawData, 
            tx.SheetTransactionID,
            tx.category, 
            tx.merchant, 
            tx.tags ? JSON5.stringify(tx.tags) : null
        ], function(err) {
            db.close();
            if (err) {
                console.error(`Error saving/replacing transaction ID ${tx.id} (${tx.Description}): ${err.message}`);
                return reject(err);
            }
            // console.log(`Successfully saved/replaced transaction ID ${tx.id} (${tx.Description})`);
            resolve();
        });
    });
}

main().catch(console.error); 