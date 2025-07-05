#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inefficient-files-'));
    console.log(`Writing 100 files to: ${tempDir}`);
    console.log('This will take approximately 200 seconds (3.3 minutes)...');
    
    const startTime = Date.now();
    
    for (let i = 1; i <= 100; i++) {
        const fileName = path.join(tempDir, `file-${String(i).padStart(3, '0')}.txt`);
        const content = `This is file number ${i}\nCreated at: ${new Date().toISOString()}\n`;
        
        fs.writeFileSync(fileName, content);
        
        console.log(`Created file ${i}/100: ${fileName}`);
        
        if (i < 100) {
            await sleep(2000);
        }
    }
    
    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;
    
    console.log(`\nCompleted! Created 100 files in ${elapsedSeconds.toFixed(1)} seconds`);
    console.log(`Files location: ${tempDir}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});