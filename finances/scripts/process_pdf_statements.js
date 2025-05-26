// To run this code you need to install the following dependencies:
// npm install @google/genai dotenv sqlite3 openai pdf2pic # pdf2pic kept as optional fallback

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import OpenAI from 'openai'; // Added OpenAI
import crypto from 'crypto'; // For direct use in this file
import {
    initializeAICache,
    generateCacheKey,
    getFromAICache,
    storeInAICache
} from './ai_cache_utils.js';

// import axios from 'axios'; // Removed axios
// import FormData from 'form-data'; // Removed form-data
// import { fromPath } from 'pdf2pic'; // pdf2pic import, kept commented for potential fallback

dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') }); // Load environment variables from config/.env

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn("Warning: OPENAI_API_KEY not set. Script will fail if OpenAI processing is attempted.");
}

const ASSISTANT_NAME = "StatementTransactionExtractor";
let assistantId = process.env.OPENAI_ASSISTANT_ID; // Optionally pre-configure assistant ID

// Removed Extracta.ai specific constants and functions:
// const EXTRACTA_API_KEY = process.env.EXTRACTA_API_KEY;
// const EXTRACTA_API_BASE_URL = 'https://api.extracta.ai/api/v1';
// async function createExtractaJob...
// async function uploadToExtracta...
// async function getExtractaResults...

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getOrCreateAssistant() {
  if (assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log(`Retrieved existing assistant with ID: ${assistant.id}`);
      return assistant;
  } catch (error) {
      console.warn(`Could not retrieve assistant with ID ${assistantId}. Will try to create a new one. Error: ${error.message}`);
      assistantId = null; // Reset so we create a new one
    }
  }

  // Try to find an assistant by name if no ID is set or retrieval failed
  if (!assistantId) {
    try {
      const existingAssistants = await openai.beta.assistants.list();
      const foundAssistant = existingAssistants.data.find(a => a.name === ASSISTANT_NAME);
      if (foundAssistant) {
        console.log(`Found existing assistant by name '${ASSISTANT_NAME}' with ID: ${foundAssistant.id}`);
        assistantId = foundAssistant.id;
        // Optionally save this ID to .env here or recommend user to do so
        return foundAssistant;
      }
    } catch (listError) {
        console.warn(`Could not list existing assistants to find by name. Error: ${listError.message}`);
    }
  }

  console.log(`Creating new assistant named '${ASSISTANT_NAME}'...`);
  const newAssistant = await openai.beta.assistants.create({
    name: ASSISTANT_NAME,
    instructions: "You are an expert financial statement parser. You will be provided with a PDF bank or credit card statement. Your task is to extract all transaction data from the entire document. CRITICALLY IMPORTANT: Output ONLY the transaction data. Each transaction MUST be on a NEW LINE. Each line MUST strictly follow the format: YYYY-MM-DD|~|Transaction Description|~|Amount. The delimiter is ALWAYS '|~|'. Amount should be negative for debits/payments and positive for credits/deposits. DO NOT include ANY headers, summaries, introductory text, explanations, apologies, or markdown formatting (like ```). DO NOT number the transaction lines. Infer the year if not obvious from the document's context or other transactions. Process the entire document provided.",
    model: "gpt-4o", // Or the latest model that supports file search well
    tools: [{ type: "file_search" }] // Use "file_search" (formerly retrieval)
  });
  assistantId = newAssistant.id;
  console.log(`Created new assistant with ID: ${assistantId}. Consider adding this to your .env as OPENAI_ASSISTANT_ID=${assistantId} for future runs.`);
  return newAssistant;
}

// Renamed and modified function to include caching
async function getCachedOrFetchOpenAIDelimitedText(dbPath, pdfPath, pdfFilename) {
  if (!openai) {
    console.error("OpenAI API key not configured. Cannot process.");
    throw new Error("OpenAI API key not configured.");
  }

  const assistant = await getOrCreateAssistant(); // Ensures assistantId is available
  if (!assistant || !assistant.id) {
      throw new Error ("Could not get or create OpenAI assistant for caching.");
  }

  const cacheKey = generateCacheKey(assistant, pdfPath, pdfFilename);
  const requestSignatureFroLogging = `assistantId:${assistant.id}_model:${assistant.model}_instructions:${assistant.instructions}_filename:${pdfFilename}`;
  const contentHashForLogging = crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex'); // For logging if needed, actual hash done in generateCacheKey

  const cachedResponse = await getFromAICache(dbPath, cacheKey);
  if (cachedResponse) {
    console.log(`Cache hit for ${pdfFilename} (key: ${cacheKey.substring(0,10)}...). Using cached response.`);
    return cachedResponse;
  }
  
  console.log(`Cache miss for ${pdfFilename} (key: ${cacheKey.substring(0,10)}...). Calling OpenAI API.`);
  try {
    console.log(`Processing ${pdfFilename} using OpenAI Assistants API...`);

    console.log(`Uploading ${pdfFilename} to OpenAI files...`);
    const file = await openai.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: 'assistants',
    });
    console.log(`File uploaded. File ID: ${file.id}`);

    console.log("Creating a new thread...");
    const thread = await openai.beta.threads.create();
    console.log(`Thread created. Thread ID: ${thread.id}`);

    console.log("Adding message to thread with file attachment...");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please extract all transactions from the attached PDF statement: ${pdfFilename}. Follow the output format specified in your instructions.`,
      attachments: [
        { file_id: file.id, tools: [{ type: "file_search" }] }
      ]
    });

    console.log("Running assistant on the thread...");
    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });
    console.log(`Run created. Run ID: ${run.id}, Status: ${run.status}`);

    const maxPollingAttempts = 60;
    let attempts = 0;
    while (["queued", "in_progress", "cancelling"].includes(run.status) && attempts < maxPollingAttempts) {
      await delay(5000);
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Run status (attempt ${++attempts}/${maxPollingAttempts}): ${run.status}`);
    }

    if (run.status === "completed") {
      console.log("Run completed. Fetching messages...");
      const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc', limit: 10 });
      const assistantMessage = messages.data.find(m => m.role === 'assistant');

      if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
        const textContent = assistantMessage.content.find(c => c.type === 'text');
        if (textContent && textContent.text && textContent.text.value) {
          const delimitedText = textContent.text.value.trim();
          console.log("Extracted delimited text snippet (first 200 chars):", delimitedText.substring(0,200));
          
          const pdfBufferForHash = fs.readFileSync(pdfPath); 
          const currentContentHash = crypto.createHash('sha256').update(pdfBufferForHash).digest('hex');
          const currentRequestSignature = `assistantId:${assistant.id}_model:${assistant.model}_instructions:${assistant.instructions}_filename:${pdfFilename}`;

          await storeInAICache(dbPath, cacheKey, currentRequestSignature, currentContentHash, delimitedText, assistant.model);
          return delimitedText;
        }
      }
      // If no text content even after completion, treat as failure to yield text
      console.error(`OpenAI run completed for ${pdfFilename} but no usable text content found in assistant\'s message.`);
      let fullDetails = "Assistant message did not contain usable text content.";
      if (assistantMessage) fullDetails += ` Assistant Message: ${JSON.stringify(assistantMessage.content, null, 2)}`;
      throw new Error(`OpenAI Assistant run completed for ${pdfFilename} but yielded no usable text. Details: ${fullDetails}`);
    } else {
      // Handle other terminal statuses: failed, cancelled, expired
      let errorMessage = `OpenAI Assistant run for ${pdfFilename} did not complete. Status: ${run.status}.`;
      if (run.last_error) {
        errorMessage += ` Last Error: ${run.last_error.code} - ${run.last_error.message}.`;
        console.error("Run Last Error Details:", JSON.stringify(run.last_error, null, 2));
      }
      if (run.incomplete_details) {
        errorMessage += ` Incomplete Details: ${run.incomplete_details.reason}.`;
        console.error("Run Incomplete Details:", JSON.stringify(run.incomplete_details, null, 2));
      }
      console.error(errorMessage); // Log the detailed error message
      throw new Error(errorMessage);
    }
  } catch (error) {
    // Log the detailed error if it hasn't been logged with specifics already
    // The error thrown from within the API call logic above will be more specific.
    if (!error.message.startsWith("OpenAI Assistant run for")) {
        console.error(`General error processing ${pdfFilename} with OpenAI Assistants API:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
    if (error.stack && !error.message.startsWith("OpenAI Assistant run for")) console.error(error.stack);
    throw error; // Re-throw to be caught by the caller (processSinglePdf)
  }
}

function generateSqlFromDelimitedText(delimitedTextData, accountName, pdfFilename) {
  if (!delimitedTextData || delimitedTextData.trim().length === 0) {
    console.log(`No delimited text data to process for ${pdfFilename}.`);
    return "";
  }

  let cleanedTextData = delimitedTextData.trim();
  const preamblePostamblePatterns = [
    /^Here are the extracted transactions(?: from the PDF statement| from the document)?:?\s*\n?/im,
    /^I have extracted the transactions as requested:?\s*\n?/im,
    /^The transactions are as follows:?\s*\n?/im,
    /^```(?:json)?\s*\n?/im, 
    /\n?```\s*$/im, 
    /\n?Note:.*$/im, 
    /\n?These entries reflect.*$/im, 
    /\n?All transactions have been formatted.*$/im,
    /\n?These transactions are reconstructed.*$/im
  ];
  preamblePostamblePatterns.forEach(pattern => {
    if (pattern.test(cleanedTextData)) {
        cleanedTextData = cleanedTextData.replace(pattern, '');
    }
  });
  cleanedTextData = cleanedTextData.trim();

  const lines = cleanedTextData.split('\n');
  let sql = "";
  
  lines.forEach(originalLine => {
    let line = originalLine.trim();
    if (line.length === 0) return;

    const listPattern = /^\s*\d+\.\s*/;
    if (listPattern.test(line)) {
      line = line.replace(listPattern, '');
    }
    line = line.trim();

    const parts = line.split('|~|');
    if (parts.length === 3) {
      let [dateStr, description, amountStr] = parts;
      dateStr = dateStr.trim();
      description = description.trim().replace(/'/g, "''");
      
      let amount = amountStr.trim();
      amount = amount.replace(/[$,€£]/g, ''); 
      amount = amount.replace(/,/g, ''); 
      if (amount.startsWith('(') && amount.endsWith(')')) {
          amount = '-' + amount.substring(1, amount.length - 1);
      }
      const numericAmount = parseFloat(amount);

      // Flexible date parsing
      let formattedDate = null;
      try {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
            throw new Error('Invalid date value after parsing');
        }
        // Use UTC methods to avoid timezone-related date shifts
        const year = parsedDate.getUTCFullYear();
        const month = (parsedDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = parsedDate.getUTCDate().toString().padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      } catch (e) {
        console.warn(`Skipping due to invalid date: '${dateStr}' in ${pdfFilename}. Error: ${e.message} (cleaned line: '${line}', original: '${originalLine}')`);
        return;
      }

      if (isNaN(numericAmount)) {
        console.warn(`Skipping invalid amount: '${amountStr}' (parsed as '${amount}') in ${pdfFilename} (cleaned line: '${line}', original: '${originalLine}')`);
        return;
      }

      sql += `INSERT INTO transactions ("Date", "Account Name", "Amount", "Description", "SourceFile") VALUES ('${formattedDate}', '${accountName}', ${numericAmount}, '${description}', '${pdfFilename}');\n`;
    } else {
      if (originalLine.trim().length > 0 && !preamblePostamblePatterns.some(p => p.test(originalLine))){
          console.warn(`Skipping malformed line in ${pdfFilename} (expected 3 parts, got ${parts.length}): '${line}' (original: '${originalLine}')`);
      }
    }
  });
  return sql;
}

async function executeSqlOnDb(dbPath, sqlToExecute) {
  if (!sqlToExecute || sqlToExecute.trim().length === 0) {
    console.log("No SQL to execute.");
    return;
  }
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error opening database:", err.message);
      throw err;
    }
  });

  return new Promise((resolve, reject) => {
    db.exec(sqlToExecute, function(err) {
        if (err) {
        console.error("Error executing SQL:", err.message);
        console.error("Problematic SQL snippet (first 300 chars):", sqlToExecute.substring(0,300));
        db.close();
          reject(err);
        return;
      }
      const changes = this.changes;
      console.log(`${changes === undefined ? 'Some' : changes} rows affected.`); // this.changes might be undefined for multi-statement exec
      db.close((closeErr) => {
        if (closeErr) {
          console.error("Error closing database:", closeErr.message);
          reject(closeErr); // Still resolve the SQL execution promise? Or reject outer?
          return;
        }
        resolve(changes);
      });
    });
      });
    }

async function emptyDatabase(dbPath) {
    console.log("Recreating database table: transactions at", dbPath);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error opening database for recreation:", err.message);
            throw err;
        }
    });

    const dropTransactionsTableSql = "DROP TABLE IF EXISTS transactions;";
    const createTransactionsTableSql = `
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            "Date" DATE,
            "Account Name" TEXT,
            "Amount" REAL,
            "Description" TEXT,
            "SourceFile" TEXT,
            "PrimaryCategory" TEXT,
            "Currency" TEXT,
            "RawData" TEXT,
            "SheetTransactionID" TEXT,
            UNIQUE("SourceFile", "SheetTransactionID", "RawData")
        );
    `;
    // Cache table creation/dropping is now handled by initializeAICache in ai_cache_utils.js

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(dropTransactionsTableSql, (err) => {
                if (err) return reject(err);
                console.log("Table 'transactions' dropped if existed.");
                db.run(createTransactionsTableSql, (err) => {
                    if (err) return reject(err);
                    console.log("Table 'transactions' created.");
                    db.close((closeErr) => {
                        if (closeErr) return reject(closeErr);
                resolve();
                    });
                });
            });
      });
    });
}

async function processSinglePdf(pdfPath, dbPath, fileIndex = 1, totalFiles = 1) {
    const pdfFilename = path.basename(pdfPath);
    // Improved account name cleaning: remove dates like _YYYY_MM_DD, _Mon_DD_YYYY, common bank suffixes, and then statement/details.
    let accountNameFromFile = path.parse(pdfFilename).name;
    accountNameFromFile = accountNameFromFile
        .replace(/_\d{4}[-_]\d{2}[-_]\d{2}/g, '') // YYYY-MM-DD or YYYY_MM_DD
        .replace(/_[A-Za-z]{3}[-_]\d{1,2}[-_]\d{4}/g, '') // Mon_DD_YYYY or Mon-DD-YYYY
        .replace(/_statement/ig, '')
        .replace(/_details/ig, '')
        .replace(/\(\d+\)/g,'') // (1)
        .replace(/([_\d]+)$/, '') // Trailing numbers/underscores (e.g. account numbers part of filename)
        .replace(/_/g, ' ')
        .trim();
    // Further common cleanups
    accountNameFromFile = accountNameFromFile.replace(/TD Canada Trust/i, "TD").replace(/Royal Bank of Canada/i, "RBC");
    
    console.log(`\n[${fileIndex}/${totalFiles}] Processing: ${pdfFilename} for account: ${accountNameFromFile}`);

    try {
        if (!OPENAI_API_KEY) {
            console.error("OPENAI_API_KEY is not set in environment variables. Please add it to your .env file.");
            process.exit(1); // Hard exit if key is missing
        }
        if (!openai) { // Double check, though covered by global init
             openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        }

        const delimitedText = await getCachedOrFetchOpenAIDelimitedText(dbPath, pdfPath, pdfFilename);

      if (delimitedText && delimitedText.trim().length > 0) {
            const sqlToExecute = generateSqlFromDelimitedText(delimitedText, accountNameFromFile, pdfFilename);
        if (sqlToExecute && sqlToExecute.trim().length > 0) {
          await executeSqlOnDb(dbPath, sqlToExecute);
                console.log(`Finished processing and inserting data for ${pdfFilename}`);
            } else {
                console.log(`No valid SQL generated from OpenAI's delimited text for ${pdfFilename}.`);
            }
    } else {
            console.log(`No delimited text data extracted from ${pdfFilename} via OpenAI or data was empty.`);
        }

    } catch (error) {
        console.error(`Error processing ${pdfFilename} in processSinglePdf:`, error.message);
        // Error is re-thrown by getCachedOrFetchOpenAIDelimitedText, so it will be caught by the worker in processDirectory
        // No need to re-log unless adding more context here.
        // For batch processing, we want the worker to catch this and continue with the next file.
        throw error; // Important to rethrow so the worker in processDirectory can catch it.
    }
}

async function processDirectory(pdfDir, dbPath, sampleSize, targetFilename = null) {
  let allFiles = [];
  if (targetFilename) {
    const fullPath = path.join(pdfDir, targetFilename);
    if (fs.existsSync(fullPath) && fullPath.toLowerCase().endsWith('.pdf')) {
      allFiles = [targetFilename];
      console.log(`Processing specific file: ${targetFilename}`);
      } else {
      console.error(`Error: Specified file ${targetFilename} not found in ${pdfDir} or is not a PDF.`);
      return;
    }
  } else {
    // Recursively find all PDF files in subdirectories
    function findPDFsRecursively(dir, basePath = '') {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          files.push(...findPDFsRecursively(fullPath, relativePath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          files.push(relativePath);
        }
      }
      return files;
    }
    
    allFiles = findPDFsRecursively(pdfDir);
  }
  
  let filesToProcess = allFiles;

  if (!targetFilename && sampleSize && sampleSize > 0 && sampleSize < allFiles.length) {
    console.log(`Processing a sample of ${sampleSize} files out of ${allFiles.length} total.`);
    filesToProcess = allFiles.slice(0, sampleSize);
  } else if (!targetFilename && sampleSize && sampleSize >= allFiles.length) {
    console.log(`Sample size (${sampleSize}) is greater than or equal to total files (${allFiles.length}). Processing all files.`);
  } else if (!targetFilename) {
    console.log(`Processing all ${allFiles.length} PDF files found in ${pdfDir}`);
  }
  // If targetFilename is specified, sampleSize is effectively ignored for selection,
  // as we are only processing that one file.

  if (filesToProcess.length === 0) {
    console.log("No PDF files to process.");
    return;
  }
  console.log(`Found ${filesToProcess.length} PDF files to process.`);

  const concurrencyLimit = 20; 
  
  const workerPromises = [];
  const taskQueue = []; // Initialize empty, will populate after checking DB

  console.log("Checking database for existing entries before queueing files...");
  const db = new sqlite3.Database(dbPath);

  for (const pdfFile of filesToProcess) {
    const sourceFile = path.basename(pdfFile);
    const count = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM transactions WHERE SourceFile = ?", [sourceFile], (err, row) => {
        if (err) {
          console.error(`Error checking transactions for ${sourceFile}:`, err.message);
          resolve(0); // Assume 0 if error, to attempt processing
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });

    if (count > 0) {
      console.log(`Skipping ${sourceFile}: ${count} transactions already exist in database.`);
    } else {
      taskQueue.push(pdfFile); // Add to queue only if no transactions exist
    }
  }
  db.close(); // Close DB connection after checking all files

  if (taskQueue.length === 0) {
    console.log("No new files to process after checking existing transactions.");
    return;
  }
  console.log(`Updated task queue: ${taskQueue.length} files to process after checking existing transactions.`);

  console.log(`Starting parallel processing with concurrency: ${concurrencyLimit} for OpenAI GPT-4o.`);

  for (let i = 0; i < concurrencyLimit; i++) {
    workerPromises.push((async (workerId) => { // Pass workerId for logging
      console.log(`[Worker ${workerId}] started.`);
      while (taskQueue.length > 0) {
        const pdfFile = taskQueue.shift(); 
        if (!pdfFile) continue; 

        // Find the original index in allFiles for consistent overall progress logging
        const overallFileIndex = allFiles.findIndex(f => f === pdfFile) + 1; 
        const pdfPath = path.join(pdfDir, pdfFile);
        
        console.log(`[Worker ${workerId} starting ${overallFileIndex}/${allFiles.length}] Processing: ${pdfFile}`);
        try {
          await processSinglePdf(pdfPath, dbPath, overallFileIndex, allFiles.length);
          console.log(`[Worker ${workerId} finished successfully ${overallFileIndex}/${allFiles.length}] ${pdfFile}`);
        } catch (err) {
          // processSinglePdf already logs detailed errors from getCachedOrFetchOpenAIDelimitedText
          // We just log that this worker encountered an error for this file and is moving on.
          console.error(`!!!! [Worker ${workerId}] FAILED processing ${pdfFile} (index ${overallFileIndex}). Moving to next file. Error: ${err.message}`);
        }
      }
      console.log(`[Worker ${workerId}] finished. No more tasks in queue.`);
    })(i + 1)); // Pass workerId (1-based)
  }

  try {
    await Promise.all(workerPromises);
    console.log("\nBatch processing finished for all workers.");
  } catch (error) {
      console.error("\nError during Promise.all for worker completion (should not happen if errors are caught in workers):", error);
  }
  console.log("All PDF processing tasks have been attempted.");
}

async function main() {
  const args = process.argv.slice(2);
  const pdfDir = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/data/downloaded_statements';
  const dbPath = '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/data/personal.db';

  let sampleSize = null;
  const sampleArgIndex = args.indexOf('--sample');
  let targetFilename = null;
  const fileArgIndex = args.indexOf('--file');

  if (sampleArgIndex !== -1 && fileArgIndex !== -1) {
    console.error("Error: --sample and --file arguments cannot be used together. Please specify one or the other.");
    process.exit(1);
  }

  if (fileArgIndex !== -1) {
    if (args.length > fileArgIndex + 1 && args[fileArgIndex + 1] && !args[fileArgIndex + 1].startsWith('--')) {
      targetFilename = args[fileArgIndex + 1];
      console.log(`Single file mode enabled. Targeting file: ${targetFilename}`);
      } else {
      console.error("Error: --file argument requires a filename to be specified after it.");
      process.exit(1);
      }
  } else if (sampleArgIndex !== -1) {
    // Check if a number is provided after --sample
    if (args.length > sampleArgIndex + 1 && !isNaN(parseInt(args[sampleArgIndex + 1]))) {
      sampleSize = parseInt(args[sampleArgIndex + 1]);
      console.log(`Sample mode enabled. Processing ${sampleSize} file(s).`);
    } else {
      // --sample is present, but no number (or not a valid number) follows, default to 1
      sampleSize = 1;
      console.log(`Sample mode enabled. Processing 1 file (default for --sample flag).`);
    }
  }

  const clearDbArg = args.includes('--clear-db');

  // Initialize AI Cache (creates table if not exists, clears old entries)
  await initializeAICache(dbPath); 

  if (clearDbArg) {
    await emptyDatabase(dbPath); // emptyDatabase now only handles transactions table
    console.log("Transactions table cleared successfully.");
  }

  if (targetFilename) {
    console.log(`Processing single specified PDF: ${targetFilename} from ${pdfDir}...`);
    await processDirectory(pdfDir, dbPath, null, targetFilename); // Pass null for sampleSize as it's overridden
  } else if (sampleSize !== null) {
    console.log(`Processing a sample of ${sampleSize} PDF(s) from ${pdfDir}...`);
    await processDirectory(pdfDir, dbPath, sampleSize);
  } else {
    console.log(`Processing all PDFs from ${pdfDir}...`);
    await processDirectory(pdfDir, dbPath); // No sample size means process all
  }
}

main().catch(console.error);
