#!/usr/bin/env node

/**
 * Comprehensive test suite for ai-monitor-cli
 * Tests path handling, violation detection, and edge cases
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { ScreenMonitor } = require('../cli_tools/ai-monitor-cli/src/screen-monitor');

// Test configuration
const TEST_PROJECT = 'test-ai-monitor';
const TEST_MODE = 'dev';
const TEST_SCREEN_SESSION = 'test-session-' + Date.now();
const TEST_LOG_DIR = path.join(__dirname, 'test-logs');
const TEST_SCREEN_LOG = path.join(TEST_LOG_DIR, `screen_output_${TEST_SCREEN_SESSION}.log`);

// Ensure test directory exists
if (!fs.existsSync(TEST_LOG_DIR)) {
    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
}

// Test results
const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(message) {
    console.log(`[TEST] ${message}`);
}

function success(testName, details = '') {
    testResults.passed++;
    testResults.tests.push({ name: testName, status: 'PASSED', details });
    console.log(`✅ ${testName} ${details ? '- ' + details : ''}`);
}

function fail(testName, error) {
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAILED', error: error.message || error });
    console.error(`❌ ${testName} - ${error.message || error}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Path resolution from different directories
async function testPathResolution() {
    const testName = 'Path Resolution';
    log(`Starting ${testName} test...`);
    
    try {
        // Save current directory
        const originalCwd = process.cwd();
        
        // Test from different directories
        const testDirs = [
            __dirname,
            path.join(__dirname, '..'),
            '/tmp',
            process.env.HOME
        ];
        
        for (const testDir of testDirs) {
            process.chdir(testDir);
            log(`Testing from directory: ${testDir}`);
            
            // Create monitor instance
            const monitor = new ScreenMonitor({
                screenSessionName: TEST_SCREEN_SESSION,
                projectName: TEST_PROJECT,
                workflowMode: TEST_MODE,
                enableGuidance: false
            });
            
            // Check if paths are correctly resolved
            const expectedLogPath = `/tmp/screen_output_${TEST_SCREEN_SESSION}.log`;
            if (monitor.screenLogPath !== expectedLogPath) {
                throw new Error(`Incorrect log path from ${testDir}: ${monitor.screenLogPath} !== ${expectedLogPath}`);
            }
            
            // Check gemini logs directory (should be absolute)
            if (!path.isAbsolute(monitor.geminiLogsDir)) {
                throw new Error(`Gemini logs dir is not absolute from ${testDir}: ${monitor.geminiLogsDir}`);
            }
        }
        
        // Restore original directory
        process.chdir(originalCwd);
        success(testName, 'All directories resolved correctly');
    } catch (error) {
        fail(testName, error);
    }
}

// Test 2: Screen log file reading with stale detection
async function testScreenLogReading() {
    const testName = 'Screen Log Reading';
    log(`Starting ${testName} test...`);
    
    try {
        // Create test log file
        const testContent = `[2025-01-27 10:00:00] Test line 1
[2025-01-27 10:00:01] Test line 2
[2025-01-27 10:00:02] \x1b[31mRed text\x1b[0m with escape sequences
[2025-01-27 10:00:03] ai-monitor: Previous guidance
[2025-01-27 10:00:04] Test line 5`;

        fs.writeFileSync(TEST_SCREEN_LOG, testContent);
        
        const monitor = new ScreenMonitor({
            screenLogPath: TEST_SCREEN_LOG,
            projectName: TEST_PROJECT,
            workflowMode: TEST_MODE,
            enableGuidance: false
        });
        
        // Test normal reading
        const content = monitor.readLast200Lines();
        if (!content) {
            throw new Error('Failed to read fresh log file');
        }
        
        // Check escape sequence cleaning
        if (content.includes('\x1b[')) {
            throw new Error('Escape sequences not cleaned properly');
        }
        
        // Test stale file detection (make file old)
        const oldTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago
        fs.utimesSync(TEST_SCREEN_LOG, new Date(oldTime), new Date(oldTime));
        
        const staleContent = monitor.readLast200Lines();
        if (staleContent !== null) {
            throw new Error('Stale file detection failed - should return null');
        }
        
        success(testName, 'Log reading and stale detection working');
    } catch (error) {
        fail(testName, error);
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_SCREEN_LOG)) {
            fs.unlinkSync(TEST_SCREEN_LOG);
        }
    }
}

// Test 3: Gemini log file writing
async function testGeminiLogWriting() {
    const testName = 'Gemini Log Writing';
    log(`Starting ${testName} test...`);
    
    try {
        const monitor = new ScreenMonitor({
            screenSessionName: TEST_SCREEN_SESSION,
            projectName: TEST_PROJECT,
            workflowMode: TEST_MODE,
            enableGuidance: false,
            geminiLogsDir: path.join(TEST_LOG_DIR, 'gemini')
        });
        
        // Ensure directory exists
        monitor.ensureGeminiLogsDir();
        if (!fs.existsSync(monitor.geminiLogsDir)) {
            throw new Error('Failed to create gemini logs directory');
        }
        
        // Test saving interaction
        const testPrompt = JSON.stringify({
            instruction: "Test instruction",
            terminal: "Line 1\nLine 2\nLine 3",
            rules: "Rule 1\nRule 2"
        });
        const testResponse = "Test gemini response";
        
        monitor.saveGeminiInteraction(testPrompt, testResponse);
        
        // Check if file was created
        const files = fs.readdirSync(monitor.geminiLogsDir);
        const geminiLogFile = files.find(f => f.startsWith(`gemini-${TEST_PROJECT}-`));
        
        if (!geminiLogFile) {
            throw new Error('Gemini log file not created');
        }
        
        // Read and verify content
        const logContent = JSON.parse(fs.readFileSync(path.join(monitor.geminiLogsDir, geminiLogFile), 'utf8'));
        
        // Check if multi-line content was converted to arrays
        if (!Array.isArray(logContent.prompt.terminal)) {
            throw new Error('Terminal content not converted to array');
        }
        
        if (!Array.isArray(logContent.prompt.rules)) {
            throw new Error('Rules content not converted to array');
        }
        
        success(testName, 'Gemini logs saved correctly with array formatting');
    } catch (error) {
        fail(testName, error);
    } finally {
        // Cleanup
        const geminiDir = path.join(TEST_LOG_DIR, 'gemini');
        if (fs.existsSync(geminiDir)) {
            fs.rmSync(geminiDir, { recursive: true });
        }
    }
}

// Test 4: Remind rules timing
async function testRemindRulesTiming() {
    const testName = 'Remind Rules Timing';
    log(`Starting ${testName} test...`);
    
    try {
        const monitor = new ScreenMonitor({
            screenSessionName: TEST_SCREEN_SESSION,
            projectName: TEST_PROJECT,
            workflowMode: TEST_MODE,
            enableGuidance: false,
            remindRulesIntervalMs: 1000 // Set to 1 second for testing
        });
        
        // Debug: check initial state
        log(`Initial lastRemindRulesTime: ${monitor.lastRemindRulesTime}`);
        log(`remindRulesIntervalMs: ${monitor.remindRulesIntervalMs}`);
        
        // First check should send remind
        const firstResult = await monitor.checkAndSendRemindRules();
        log(`First check result: ${firstResult}, lastRemindRulesTime: ${monitor.lastRemindRulesTime}`);
        if (!firstResult) {
            throw new Error('First remind check should return true');
        }
        
        // Immediate second check should not send
        const secondResult = await monitor.checkAndSendRemindRules();
        log(`Second check result: ${secondResult}`);
        if (secondResult) {
            throw new Error('Second immediate check should return false');
        }
        
        // Wait for interval and check again
        await sleep(1100);
        const now = Date.now();
        const timeSinceLastRemind = now - monitor.lastRemindRulesTime;
        log(`Time since last remind: ${timeSinceLastRemind}ms (should be >= 1000ms)`);
        
        const thirdResult = await monitor.checkAndSendRemindRules();
        log(`Third check result: ${thirdResult}`);
        if (!thirdResult) {
            throw new Error('Third check after interval should return true');
        }
        
        success(testName, 'Remind rules timing working correctly');
    } catch (error) {
        fail(testName, error);
    }
}

// Test 5: Violation detection scenarios
async function testViolationDetection() {
    const testName = 'Violation Detection';
    log(`Starting ${testName} test...`);
    
    try {
        // Create test scenarios
        const scenarios = [
            {
                name: 'Clean output',
                content: `[2025-01-27 10:00:00] Running tests...
[2025-01-27 10:00:01] All tests passed
[2025-01-27 10:00:02] Build successful`,
                expectedViolation: false
            },
            {
                name: 'Failed tests',
                content: `[2025-01-27 10:00:00] Running tests...
[2025-01-27 10:00:01] Test failed: expected true to be false
[2025-01-27 10:00:02] 1 test failed
[2025-01-27 10:00:03] Continuing with implementation...`,
                expectedViolation: true
            },
            {
                name: 'Repeating failed commands',
                content: `[2025-01-27 10:00:00] npm install
[2025-01-27 10:00:01] Error: Cannot find module
[2025-01-27 10:00:02] npm install
[2025-01-27 10:00:03] Error: Cannot find module
[2025-01-27 10:00:04] npm install
[2025-01-27 10:00:05] Error: Cannot find module`,
                expectedViolation: true
            }
        ];
        
        for (const scenario of scenarios) {
            log(`Testing scenario: ${scenario.name}`);
            
            // Write test content
            fs.writeFileSync(TEST_SCREEN_LOG, scenario.content);
            
            const monitor = new ScreenMonitor({
                screenLogPath: TEST_SCREEN_LOG,
                projectName: TEST_PROJECT,
                workflowMode: TEST_MODE,
                enableGuidance: false,
                geminiApiKey: process.env.GEMINI_API_KEY // Use real API key if available
            });
            
            // If no API key, skip actual violation detection
            if (!monitor.geminiApiKey) {
                log('Skipping actual API call - no GEMINI_API_KEY');
                continue;
            }
            
            const result = await monitor.check();
            if (result && result.geminiAnalysis) {
                log(`Gemini analysis: ${result.geminiAnalysis}`);
                
                // Extract the actual instruction that would be sent
                const guidanceInstruction = monitor.extractGuidanceInstruction(result.geminiAnalysis);
                log(`Extracted guidance: ${guidanceInstruction || '(none)'}`);
                
                // Check if violation was detected as expected
                // Empty guidance means no violation detected
                const hasViolation = guidanceInstruction && guidanceInstruction.length > 0;
                
                if (hasViolation !== scenario.expectedViolation) {
                    throw new Error(`Scenario "${scenario.name}" - expected violation: ${scenario.expectedViolation}, got: ${hasViolation}`);
                }
            }
        }
        
        success(testName, 'Violation detection scenarios tested');
    } catch (error) {
        fail(testName, error);
    } finally {
        if (fs.existsSync(TEST_SCREEN_LOG)) {
            fs.unlinkSync(TEST_SCREEN_LOG);
        }
    }
}

// Test 6: CLI invocation from different paths
async function testCLIInvocation() {
    const testName = 'CLI Invocation';
    log(`Starting ${testName} test...`);
    
    try {
        const cliPath = path.join(__dirname, '..', 'cli_tools', 'ai-monitor-cli', 'ai-monitor-cli');
        
        // Test help command
        const helpOutput = execSync(`${cliPath} --help`, { encoding: 'utf8' });
        if (!helpOutput.includes('ai-monitor-cli')) {
            throw new Error('CLI help output incorrect');
        }
        
        // Test status command from different directories
        const originalCwd = process.cwd();
        const testDirs = ['/tmp', process.env.HOME];
        
        for (const dir of testDirs) {
            process.chdir(dir);
            log(`Testing CLI from: ${dir}`);
            
            const statusOutput = execSync(`${cliPath} status`, { encoding: 'utf8' });
            if (!statusOutput.includes('AI Monitor CLI Status')) {
                throw new Error(`Status command failed from ${dir}`);
            }
        }
        
        process.chdir(originalCwd);
        success(testName, 'CLI works from all directories');
    } catch (error) {
        fail(testName, error);
    }
}

// Test 7: Edge cases
async function testEdgeCases() {
    const testName = 'Edge Cases';
    log(`Starting ${testName} test...`);
    
    try {
        // Test 1: Empty log file
        fs.writeFileSync(TEST_SCREEN_LOG, '');
        const monitor1 = new ScreenMonitor({
            screenLogPath: TEST_SCREEN_LOG,
            projectName: TEST_PROJECT,
            enableGuidance: false
        });
        
        const emptyResult = monitor1.readLast200Lines();
        if (emptyResult !== null) {
            throw new Error('Empty file should return null');
        }
        
        // Test 2: Very large log file
        const largeContent = 'Test line\n'.repeat(10000);
        fs.writeFileSync(TEST_SCREEN_LOG, largeContent);
        
        const monitor2 = new ScreenMonitor({
            screenLogPath: TEST_SCREEN_LOG,
            projectName: TEST_PROJECT,
            enableGuidance: false
        });
        
        const largeResult = monitor2.readLast200Lines();
        if (!largeResult) {
            throw new Error('Failed to read large file');
        }
        
        const lineCount = largeResult.split('\n').length;
        if (lineCount > 210) { // 200 + some overhead
            throw new Error(`Read too many lines: ${lineCount}`);
        }
        
        // Test 3: Non-existent log file
        const monitor3 = new ScreenMonitor({
            screenLogPath: '/tmp/non-existent-file-12345.log',
            projectName: TEST_PROJECT,
            enableGuidance: false
        });
        
        const nonExistentResult = monitor3.readLast200Lines();
        if (nonExistentResult !== null) {
            throw new Error('Non-existent file should return null');
        }
        
        // Test 4: Malformed content with binary data
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
        fs.writeFileSync(TEST_SCREEN_LOG, 'Normal text\n' + binaryContent + '\nMore text');
        
        const monitor4 = new ScreenMonitor({
            screenLogPath: TEST_SCREEN_LOG,
            projectName: TEST_PROJECT,
            enableGuidance: false
        });
        
        const binaryResult = monitor4.readLast200Lines();
        if (!binaryResult || binaryResult.includes('\x00')) {
            throw new Error('Failed to clean binary data');
        }
        
        success(testName, 'All edge cases handled correctly');
    } catch (error) {
        fail(testName, error);
    } finally {
        if (fs.existsSync(TEST_SCREEN_LOG)) {
            fs.unlinkSync(TEST_SCREEN_LOG);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('🧪 Starting AI Monitor CLI Test Suite');
    console.log('=' .repeat(50));
    
    const startTime = Date.now();
    
    // Run all tests
    await testPathResolution();
    await testScreenLogReading();
    await testGeminiLogWriting();
    await testRemindRulesTiming();
    await testViolationDetection();
    await testCLIInvocation();
    await testEdgeCases();
    
    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary');
    console.log(`Total tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏱️  Duration: ${duration}s`);
    
    // Save detailed report
    const reportPath = path.join(TEST_LOG_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Cleanup test directory
    if (fs.existsSync(TEST_LOG_DIR)) {
        fs.rmSync(TEST_LOG_DIR, { recursive: true });
    }
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});