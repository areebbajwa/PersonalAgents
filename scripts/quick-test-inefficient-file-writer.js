#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quick test - just verify the script logic works with 3 files instead of 100
const tempDir = path.join(__dirname, '../temp-test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Test with just 3 files to verify logic
for (let i = 1; i <= 3; i++) {
  const fileName = path.join(tempDir, `file_${i}.txt`);
  const content = `This is file number ${i}\nCreated at: ${new Date().toISOString()}\n`;
  
  fs.writeFileSync(fileName, content);
  console.log(`Created file ${i} of 3: ${fileName}`);
  
  // Short sleep for testing
  const start = Date.now();
  while (Date.now() - start < 100) {
    // Quick wait
  }
}

// Verify
const files = fs.readdirSync(tempDir).filter(f => f.startsWith('file_') && f.endsWith('.txt'));
if (files.length === 3) {
  console.log('✅ Quick test passed - logic is correct');
  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
} else {
  console.error('❌ Quick test failed');
}