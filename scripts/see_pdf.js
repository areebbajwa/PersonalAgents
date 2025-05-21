// Script: scripts/see_pdf.js
// Description: Extracts text content from a PDF file using OpenAI GPT-4o-mini model via Assistants API with caching.
// Usage: node scripts/see_pdf.js <path_to_pdf_file>
// Example: node scripts/see_pdf.js /path/to/your/document.pdf

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import crypto from 'crypto'; // For direct use in this file if ai_cache_utils needs it or for consistency
import {
    initializeAICache,
    generateCacheKey,
    getFromAICache,
    storeInAICache
} from '../finances/financial-reports/scripts/ai_cache_utils.js'; // Adjusted path

dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') }); // Load environment variables from config/.env

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai;

if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.error("Error: OPENAI_API_KEY not set in .env file. This script requires an OpenAI API key to function.");
  process.exit(1);
}

const ASSISTANT_NAME = "GeneralPDFTextExtractor";
const ASSISTANT_MODEL = "gpt-4o"; // Using gpt-4o instead of gpt-4o-mini
let assistantId = process.env.GENERAL_PDF_ASSISTANT_ID; // Optional: Pre-configure assistant ID in .env

// Cache DB path (can be shared with other scripts using ai_cache_utils)
const CACHE_DB_PATH = process.env.CACHE_DB_PATH || '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/financial-reports/data/categorized_transactions.db';

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getOrCreateAssistant() {
  if (assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log(`Retrieved existing assistant '${ASSISTANT_NAME}' with ID: ${assistant.id}`);
      return assistant;
    } catch (error) {
      console.warn(`Could not retrieve assistant with ID ${assistantId}. Will try to find or create a new one. Error: ${error.message}`);
      assistantId = null; // Reset to find or create
    }
  }

  // Try to find an assistant by name if no ID is set or retrieval failed
  try {
    const existingAssistants = await openai.beta.assistants.list({ limit: 100 });
    const foundAssistant = existingAssistants.data.find(a => a.name === ASSISTANT_NAME && a.model === ASSISTANT_MODEL);
    if (foundAssistant) {
      console.log(`Found existing assistant by name '${ASSISTANT_NAME}' and model '${ASSISTANT_MODEL}' with ID: ${foundAssistant.id}`);
      assistantId = foundAssistant.id;
      // Optionally save this ID to .env here or recommend user to do so as GENERAL_PDF_ASSISTANT_ID
      return foundAssistant;
    }
  } catch (listError) {
      console.warn(`Could not list existing assistants to find by name. Error: ${listError.message}`);
  }

  console.log(`Creating new assistant named '${ASSISTANT_NAME}' with model '${ASSISTANT_MODEL}'...`);
  try {
    const newAssistant = await openai.beta.assistants.create({
      name: ASSISTANT_NAME,
      instructions: "You are an AI assistant. Your task is to extract all text content from the provided PDF document. Output only the raw text content without any additional explanations, summaries, or markdown formatting.",
      model: ASSISTANT_MODEL,
      tools: [{ type: "file_search" }]
    });
    assistantId = newAssistant.id;
    console.log(`Created new assistant with ID: ${assistantId}. Consider adding this to your .env as GENERAL_PDF_ASSISTANT_ID=${assistantId} for future runs.`);
    return newAssistant;
  } catch (creationError) {
    console.error(`Failed to create assistant: ${creationError.message}`);
    throw creationError;
  }
}

async function getCachedOrFetchPdfText(pdfPath) {
  const pdfFilename = path.basename(pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found at ${pdfPath}`);
    throw new Error(`PDF file not found at ${pdfPath}`);
  }

  const assistant = await getOrCreateAssistant();
  if (!assistant || !assistant.id) {
      throw new Error ("Could not get or create OpenAI assistant for PDF processing.");
  }

  // Use assistant object directly for cache key generation if it expects the full object
  // For simplicity, using assistant.id, model, and instructions as key components
  const cacheKeyParams = {
    id: assistant.id,
    model: assistant.model,
    instructions: assistant.instructions // Or a hash of instructions if too long
  };
  const cacheKey = generateCacheKey(cacheKeyParams, pdfPath, pdfFilename); // ai_cache_utils's generateCacheKey might need adjustment if it expects a different assistant format

  const cachedResponse = await getFromAICache(CACHE_DB_PATH, cacheKey);
  if (cachedResponse) {
    console.log(`Cache hit for ${pdfFilename} (key: ${cacheKey.substring(0,10)}...). Using cached response.`);
    return cachedResponse;
  }
  
  console.log(`Cache miss for ${pdfFilename} (key: ${cacheKey.substring(0,10)}...). Calling OpenAI API.`);
  let fileId = null;

  try {
    console.log(`Uploading ${pdfFilename} to OpenAI files...`);
    const fileObject = await openai.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: 'assistants',
    });
    fileId = fileObject.id;
    console.log(`File uploaded. File ID: ${fileId}`);

    console.log("Creating a new thread...");
    const thread = await openai.beta.threads.create();
    console.log(`Thread created. Thread ID: ${thread.id}`);

    console.log("Adding message to thread with file attachment...");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please extract all text content from the attached PDF: ${pdfFilename}. Follow the output format specified in your instructions.`,
      attachments: [
        { file_id: fileId, tools: [{ type: "file_search" }] }
      ]
    });

    console.log("Running assistant on the thread...");
    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });
    console.log(`Run created. Run ID: ${run.id}, Status: ${run.status}`);

    const maxPollingAttempts = 60; // 5 minutes (60 * 5s)
    let attempts = 0;
    while (["queued", "in_progress", "cancelling"].includes(run.status) && attempts < maxPollingAttempts) {
      await delay(5000); // 5 seconds
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Run status (attempt ${++attempts}/${maxPollingAttempts}): ${run.status}`);
    }

    if (run.status === "completed") {
      console.log("Run completed. Fetching messages...");
      const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc', limit: 1 });
      
      const assistantMessage = messages.data.find(m => m.role === 'assistant');

      if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
        const textContentItem = assistantMessage.content.find(c => c.type === 'text');
        if (textContentItem && textContentItem.text && textContentItem.text.value) {
          const extractedText = textContentItem.text.value.trim();
          console.log("Extracted text snippet (first 300 chars):", extractedText.substring(0,300) + (extractedText.length > 300 ? "..." : ""));
          
          const pdfBufferForHash = fs.readFileSync(pdfPath); 
          const currentContentHash = crypto.createHash('sha256').update(pdfBufferForHash).digest('hex');
          const currentRequestSignature = `assistantId:${assistant.id}_model:${assistant.model}_instructions_hash:${crypto.createHash('sha256').update(assistant.instructions).digest('hex')}_filename:${pdfFilename}`;

          await storeInAICache(CACHE_DB_PATH, cacheKey, currentRequestSignature, currentContentHash, extractedText, assistant.model);
          return extractedText;
        }
      }
      console.error(`OpenAI run completed for ${pdfFilename} but no usable text content found.`);
      throw new Error(`OpenAI Assistant run completed for ${pdfFilename} but yielded no usable text.`);
    } else {
      let errorMessage = `OpenAI Assistant run for ${pdfFilename} did not complete. Status: ${run.status}.`;
      if (run.last_error) {
        errorMessage += ` Last Error: ${run.last_error.code} - ${run.last_error.message}.`;
      }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error(`Error processing ${pdfFilename} with OpenAI: ${error.message}`);
    if (error.stack) console.error(error.stack);
    throw error; // Re-throw
  } finally {
    if (fileId) {
      try {
        console.log(`Attempting to delete OpenAI file resource: ${fileId}`);
        await openai.files.del(fileId);
        console.log(`Successfully deleted OpenAI file: ${fileId}`);
      } catch (deleteError) {
        console.warn(`Warning: Failed to delete OpenAI file ${fileId}. Manual cleanup may be required. Error: ${deleteError.message}`);
      }
    }
  }
}

async function main() {
  const pdfFilePath = process.argv[2];

  if (!pdfFilePath) {
    console.error("Usage: node scripts/see_pdf.js <path_to_pdf_file>");
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(pdfFilePath); // Resolve to absolute path

  console.log(`Processing PDF: ${absolutePdfPath}`);

  try {
    // Initialize AI Cache (creates table if not exists, clears old entries based on its own logic)
    // The db path for cache is now CACHE_DB_PATH
    await initializeAICache(CACHE_DB_PATH); 
    console.log(`AI Cache initialized using DB at: ${CACHE_DB_PATH}`);

    const extractedText = await getCachedOrFetchPdfText(absolutePdfPath);
    
    console.log("\n--- Extracted PDF Content ---");
    console.log(extractedText);
    console.log("--- End of Extracted PDF Content ---\n");

  } catch (error) {
    console.error(`
Script failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Unhandled error in main: ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exit(1);
}); 