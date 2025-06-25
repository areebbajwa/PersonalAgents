#!/usr/bin/env node

// Test to verify screenshot cleanup functionality
import { promises as fs } from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'selenium-screenshots');

async function testCleanup() {
    console.log('Testing screenshot cleanup functionality...');
    
    // Ensure directory exists
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    
    // Create test files with different ages
    const now = Date.now();
    const oldTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
    const recentTime = now - (1 * 60 * 60 * 1000); // 1 hour ago
    
    // Create old screenshot
    const oldFile = path.join(SCREENSHOT_DIR, 'test_old.png');
    await fs.writeFile(oldFile, 'dummy', 'utf8');
    await fs.utimes(oldFile, new Date(oldTime), new Date(oldTime));
    
    // Create recent screenshot
    const recentFile = path.join(SCREENSHOT_DIR, 'test_recent.png');
    await fs.writeFile(recentFile, 'dummy', 'utf8');
    await fs.utimes(recentFile, new Date(recentTime), new Date(recentTime));
    
    console.log('Created test files:');
    console.log('  - test_old.png (25 hours old)');
    console.log('  - test_recent.png (1 hour old)');
    
    // Import and run the cleanup function
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    
    async function cleanupOldScreenshots() {
        try {
            const now = Date.now();
            const files = await fs.readdir(SCREENSHOT_DIR);
            let deletedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.png')) {
                    const filePath = path.join(SCREENSHOT_DIR, file);
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;
                    
                    if (age > MAX_AGE) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`Deleted old screenshot: ${file}`);
                    }
                }
            }
            
            if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} old screenshots`);
            }
            return deletedCount;
        } catch (error) {
            console.error(`Error cleaning up screenshots: ${error.message}`);
            return 0;
        }
    }
    
    // Run cleanup
    const deletedCount = await cleanupOldScreenshots();
    
    // Verify results
    const remainingFiles = await fs.readdir(SCREENSHOT_DIR);
    const pngFiles = remainingFiles.filter(f => f.endsWith('.png'));
    
    console.log('\nRemaining files:', pngFiles);
    
    // Check if old file was deleted and recent file remains
    const oldFileExists = pngFiles.includes('test_old.png');
    const recentFileExists = pngFiles.includes('test_recent.png');
    
    if (!oldFileExists && recentFileExists && deletedCount === 1) {
        console.log('\n✅ Cleanup test passed! Old file deleted, recent file kept.');
        
        // Clean up test file
        await fs.unlink(recentFile).catch(() => {});
        return true;
    } else {
        console.log('\n❌ Cleanup test failed!');
        console.log(`  Old file exists: ${oldFileExists} (should be false)`);
        console.log(`  Recent file exists: ${recentFileExists} (should be true)`);
        console.log(`  Deleted count: ${deletedCount} (should be 1)`);
        return false;
    }
}

// Run test
testCleanup()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Test failed:', err);
        process.exit(1);
    });