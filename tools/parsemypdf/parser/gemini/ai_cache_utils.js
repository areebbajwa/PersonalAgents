import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import fs from 'fs'; // Needed for getCacheKey if PDF path is passed directly

// Helper to get a database connection
function getDbConnection(dbPath) {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`Error opening database at ${dbPath}:`, err.message);
      throw err;
    }
  });
}

// Function to clear old cache entries
async function clearOldCacheEntries(dbPath, days = 14) {
  const db = getDbConnection(dbPath);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = cutoffDate.toISOString();

  return new Promise((resolve, reject) => {
    db.run("DELETE FROM ai_cache WHERE timestamp < ?", [cutoffTimestamp], function(err) {
      if (err) {
        console.error("Error clearing old cache entries:", err.message);
        db.close();
        reject(err);
      } else {
        console.log(`Cleared ${this.changes} old cache entries (older than ${cutoffTimestamp}).`);
        db.close();
        resolve(this.changes);
      }
    });
  });
}

// Function to ensure the ai_cache table exists
async function ensureCacheTableExists(dbPath) {
  const db = getDbConnection(dbPath);
  const createCacheTableSql = `
    CREATE TABLE IF NOT EXISTS ai_cache (
        key TEXT PRIMARY KEY,
        request_signature TEXT,
        content_hash TEXT, 
        response TEXT,
        model_used TEXT, 
        timestamp TEXT
    );
  `;
  return new Promise((resolve, reject) => {
    db.run(createCacheTableSql, (err) => {
      if (err) {
        console.error("Error ensuring ai_cache table exists:", err.message);
        db.close();
        reject(err);
      } else {
        // console.log("Table 'ai_cache' checked/created."); // Less verbose
        db.close();
        resolve();
      }
    });
  });
}

// Initialize cache: ensure table exists and clear old entries
async function initializeAICache(dbPath) {
    await ensureCacheTableExists(dbPath);
    // Always clear old entries, regardless of any external flags for other tables
    await clearOldCacheEntries(dbPath, 14); 
}


function generateCacheKey(assistant, pdfPath, pdfFilename) {
    const pdfBuffer = fs.readFileSync(pdfPath);
    // Ensure assistant.instructions is a string, sometimes it might be null/undefined if not explicitly set on assistant object
    const instructions = assistant.instructions || ""; 
    const requestSignature = `assistantId:${assistant.id}_model:${assistant.model}_instructions:${instructions}_filename:${pdfFilename}`;
    const contentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    return crypto.createHash('sha256').update(requestSignature + contentHash).digest('hex');
}

async function getFromAICache(dbPath, cacheKey) {
  const db = getDbConnection(dbPath);
  return new Promise((resolve, reject) => {
    db.get("SELECT response FROM ai_cache WHERE key = ?", [cacheKey], (err, row) => {
      db.close();
      if (err) {
        console.error("Error reading from ai_cache:", err.message);
        resolve(null); // Resolve with null on error to proceed to API call
      } else {
        resolve(row ? row.response : null);
      }
    });
  });
}

async function storeInAICache(dbPath, cacheKey, requestSignature, contentHash, response, modelUsed) {
  const db = getDbConnection(dbPath);
  const timestamp = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO ai_cache (key, request_signature, content_hash, response, model_used, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
           [cacheKey, requestSignature, contentHash, response, modelUsed, timestamp], (err) => {
      db.close();
      if (err) {
        console.error("Error writing to ai_cache:", err.message);
        reject(err); // Or resolve false? For now, reject.
      } else {
        console.log(`Saved to cache (key: ${cacheKey.substring(0,10)}...).`);
        resolve(true);
      }
    });
  });
}

export {
  initializeAICache,
  generateCacheKey,
  getFromAICache,
  storeInAICache
}; 