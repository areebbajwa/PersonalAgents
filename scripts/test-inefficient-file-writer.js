#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const tempDir = path.join(__dirname, '../temp');
const scriptPath = path.join(__dirname, 'inefficient-file-writer.js');

console.log('Starting test for inefficient file writer...');

// Clean up temp directory before test
if (fs.existsSync(tempDir)) {
  console.log('Cleaning up existing temp directory...');
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Run the script (this will take ~200 seconds)
console.log('Running inefficient file writer script...');
console.log('This will take approximately 200 seconds (3.3 minutes)...');

try {
  execSync(`node ${scriptPath}`, { stdio: 'inherit' });
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
}

// Verify results
console.log('\nVerifying results...');

if (!fs.existsSync(tempDir)) {
  console.error('❌ Test failed: temp directory does not exist');
  process.exit(1);
}

const files = fs.readdirSync(tempDir).filter(f => f.startsWith('file_') && f.endsWith('.txt'));
const fileCount = files.length;

if (fileCount === 100) {
  console.log(`✅ Test passed: Found exactly ${fileCount} files in temp directory`);
  
  // Verify file content of first and last file
  const firstFile = fs.readFileSync(path.join(tempDir, 'file_1.txt'), 'utf8');
  const lastFile = fs.readFileSync(path.join(tempDir, 'file_100.txt'), 'utf8');
  
  if (firstFile.includes('This is file number 1') && lastFile.includes('This is file number 100')) {
    console.log('✅ File content verification passed');
  } else {
    console.error('❌ File content verification failed');
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed! 1/1 tests succeeded.');
  process.exit(0);
} else {
  console.error(`❌ Test failed: Expected 100 files, found ${fileCount}`);
  process.exit(1);
}