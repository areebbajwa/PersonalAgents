#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing inefficient file writer script...');
console.log('This test will take approximately 3.5 minutes to complete.\n');

const scriptPath = path.join(__dirname, 'inefficient-file-writer.js');
const startTime = Date.now();

const child = spawn('node', [scriptPath], {
    stdio: 'pipe'
});

let tempDir = null;
let outputBuffer = '';

child.stdout.on('data', (data) => {
    const output = data.toString();
    outputBuffer += output;
    process.stdout.write(output);
    
    const match = output.match(/Writing 100 files to: (.+)/);
    if (match && !tempDir) {
        tempDir = match[1].trim();
    }
});

child.stderr.on('data', (data) => {
    process.stderr.write(data);
});

child.on('close', (code) => {
    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;
    
    console.log(`\n\nTest Results:`);
    console.log(`=============`);
    console.log(`Exit code: ${code}`);
    console.log(`Total test time: ${elapsedSeconds.toFixed(1)} seconds`);
    
    if (code !== 0) {
        console.error('❌ Test FAILED: Script exited with non-zero code');
        process.exit(1);
    }
    
    if (!tempDir) {
        console.error('❌ Test FAILED: Could not find temp directory in output');
        process.exit(1);
    }
    
    try {
        const files = fs.readdirSync(tempDir);
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        
        console.log(`Files created: ${txtFiles.length}`);
        
        if (txtFiles.length !== 100) {
            console.error(`❌ Test FAILED: Expected 100 files, found ${txtFiles.length}`);
            process.exit(1);
        }
        
        const firstFile = fs.readFileSync(path.join(tempDir, 'file-001.txt'), 'utf8');
        const lastFile = fs.readFileSync(path.join(tempDir, 'file-100.txt'), 'utf8');
        
        if (!firstFile.includes('file number 1') || !lastFile.includes('file number 100')) {
            console.error('❌ Test FAILED: File content validation failed');
            process.exit(1);
        }
        
        console.log('✅ Test PASSED: All 100 files created successfully!');
        console.log(`\nCleaning up test files...`);
        
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('Cleanup complete.');
        
    } catch (err) {
        console.error('❌ Test FAILED:', err.message);
        process.exit(1);
    }
});