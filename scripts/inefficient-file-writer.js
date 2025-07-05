#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Inefficient file writing with 2 second sleep between each
for (let i = 1; i <= 100; i++) {
  const fileName = path.join(tempDir, `file_${i}.txt`);
  const content = `This is file number ${i}\nCreated at: ${new Date().toISOString()}\n`;
  
  // Write file synchronously (inefficient)
  fs.writeFileSync(fileName, content);
  console.log(`Created file ${i} of 100: ${fileName}`);
  
  // Sleep for 2 seconds (inefficient delay)
  const start = Date.now();
  while (Date.now() - start < 2000) {
    // Busy wait (very inefficient)
  }
}

console.log('Finished creating 100 files!');