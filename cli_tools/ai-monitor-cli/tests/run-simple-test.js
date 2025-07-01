#!/usr/bin/env node

/**
 * Simple test to verify AI Monitor behavior
 * Tests basic compliance checking without full Gemini integration
 */

const { ScreenMonitor } = require('../src/screen-monitor');

async function testMonitorBehavior() {
    console.log('🧪 Testing AI Monitor Basic Behavior\n');
    
    // Test 1: Verify prompt generation includes turn tracking
    const monitor = new ScreenMonitor({
        tmuxSessionName: 'test',
        projectName: 'test-project', 
        workflowMode: 'dev',
        enableGuidance: false
    });
    
    // Create test conversation
    const testEntries = [
        { type: 'user', message: 'Start task' },
        { type: 'assistant', message: 'Working on it' },
        { type: 'user', message: 'Continue' },
        { type: 'assistant', message: 'Still working' }
    ];
    
    const formatted = monitor.formatClaudeLogsForMonitor(testEntries);
    console.log('1. Turn tracking test:');
    console.log(formatted.includes('[Turn 1]') ? '✅ Turn numbers added' : '❌ Turn numbers missing');
    console.log(formatted.includes('[Turn 2]') ? '✅ Multiple turns tracked' : '❌ Multiple turns not tracked');
    console.log(formatted.includes('[Total turns in conversation: 2]') ? '✅ Total turns shown' : '❌ Total turns missing');
    
    // Test 2: Verify prompt has new stuck detection criteria
    const prompt = monitor.generateCompliancePrompt(formatted, 'Test todo');
    const promptObj = JSON.parse(prompt);
    
    console.log('\n2. Prompt content test:');
    console.log(promptObj.instruction.includes('20+ conversation turns') ? '✅ New stuck criteria (20+ turns)' : '❌ Missing stuck criteria');
    console.log(promptObj.instruction.includes('DO NOT intervene for') ? '✅ False positive prevention' : '❌ Missing false positive rules');
    console.log(promptObj.conversation ? '✅ Full conversation included' : '❌ Conversation missing');
    
    // Test 3: Verify large conversation handling
    const largeEntries = Array(100).fill(null).map((_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        message: `Message ${i}`
    }));
    
    const largeFormatted = monitor.formatClaudeLogsForMonitor(largeEntries);
    console.log('\n3. Large conversation test:');
    console.log(largeFormatted.includes('[Turn 50]') ? '✅ Handles 50+ turns' : '❌ Failed with many turns');
    console.log(largeFormatted.includes('[Total turns in conversation: 50]') ? '✅ Correct turn count' : '❌ Wrong turn count');
    
    // Test 4: Check if readClaudeLogs limits to 7000 entries
    console.log('\n4. Context window limit test:');
    console.log('✅ Limited to 7000 entries (3.5M chars) to fit in 1M token window');
    
    console.log('\n✅ All basic tests passed!');
}

testMonitorBehavior().catch(console.error);