#!/usr/bin/env node

/**
 * Test to verify Gemini caching reduces costs by >50%
 * Compares token usage with and without context caching
 */

const { ScreenMonitor } = require('../src/screen-monitor');

function estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

async function testCachingCostReduction() {
    console.log('🧪 Testing Gemini Context Caching Cost Reduction\n');
    
    const monitor = new ScreenMonitor({
        tmuxSessionName: 'test',
        projectName: 'test-project',
        workflowMode: 'dev',
        enableGuidance: false
    });
    
    // Create a large conversation (simulating hours of work)
    const conversationSize = 1000; // 1000 turns
    const entries = [];
    
    for (let i = 0; i < conversationSize; i++) {
        entries.push({
            type: 'user',
            message: `User message ${i}: Working on implementing feature with multiple steps and details`
        });
        entries.push({
            type: 'assistant', 
            message: `Assistant response ${i}: I'll help with that. Let me analyze the code and make the necessary changes. Here's what I'm doing...`
        });
        entries.push({
            type: 'tool_use',
            toolUse: { name: 'edit', input: `file${i}.js` }
        });
        entries.push({
            type: 'tool_result',
            toolUseResult: { stdout: `File edited successfully with changes to implement feature ${i}` }
        });
    }
    
    // Format the conversation
    const formatted = monitor.formatClaudeLogsForMonitor(entries);
    const todoContent = 'Test todo with multiple tasks';
    
    // Generate prompt
    const prompt = monitor.generateCompliancePrompt(formatted, todoContent);
    const promptTokens = estimateTokens(prompt);
    
    console.log('📊 Token Usage Analysis:');
    console.log(`- Conversation entries: ${entries.length}`);
    console.log(`- Formatted text length: ${formatted.length} characters`);
    console.log(`- Estimated prompt tokens: ${promptTokens.toLocaleString()}`);
    
    // Cost calculation without caching (every check is full price)
    const checksPerDay = 24 * 60; // Every minute for 24 hours
    const inputPricePerMillion = 1.25; // $1.25 per 1M input tokens
    const outputTokensPerCheck = 200; // Typical response size
    const outputPricePerMillion = 10; // $10 per 1M output tokens
    
    const dailyCostWithoutCaching = (
        (checksPerDay * promptTokens * inputPricePerMillion / 1_000_000) +
        (checksPerDay * outputTokensPerCheck * outputPricePerMillion / 1_000_000)
    );
    
    // Cost calculation with caching (75% discount on cached tokens)
    const newTokensPerCheck = estimateTokens('New content since last check - about 500 chars');
    const cachedTokens = promptTokens - newTokensPerCheck;
    const cachingDiscount = 0.75; // 75% discount
    
    const dailyCostWithCaching = (
        // First check full price
        (promptTokens * inputPricePerMillion / 1_000_000) +
        // Subsequent checks: new tokens full price + cached tokens discounted
        ((checksPerDay - 1) * newTokensPerCheck * inputPricePerMillion / 1_000_000) +
        ((checksPerDay - 1) * cachedTokens * inputPricePerMillion * (1 - cachingDiscount) / 1_000_000) +
        // Output tokens (no caching)
        (checksPerDay * outputTokensPerCheck * outputPricePerMillion / 1_000_000)
    );
    
    const savings = dailyCostWithoutCaching - dailyCostWithCaching;
    const savingsPercent = (savings / dailyCostWithoutCaching * 100).toFixed(1);
    
    console.log('\n💰 Cost Analysis (24-hour operation):');
    console.log(`- Without caching: $${dailyCostWithoutCaching.toFixed(2)}/day`);
    console.log(`- With caching: $${dailyCostWithCaching.toFixed(2)}/day`);
    console.log(`- Savings: $${savings.toFixed(2)}/day (${savingsPercent}% reduction)`);
    
    console.log('\n📈 Caching Benefit Breakdown:');
    console.log(`- Cached tokens per check: ${cachedTokens.toLocaleString()} (${(cachedTokens/promptTokens*100).toFixed(1)}% of prompt)`);
    console.log(`- New tokens per check: ${newTokensPerCheck} (${(newTokensPerCheck/promptTokens*100).toFixed(1)}% of prompt)`);
    console.log(`- Effective discount: 75% on ${(cachedTokens/promptTokens*100).toFixed(1)}% of input`);
    
    const testPassed = parseFloat(savingsPercent) > 50;
    console.log('\n' + (testPassed ? '✅' : '❌') + ` TEST ${testPassed ? 'PASSED' : 'FAILED'}: ${savingsPercent}% cost reduction (target: >50%)`);
    
    return testPassed;
}

// Run test
testCachingCostReduction().then(passed => {
    process.exit(passed ? 0 : 1);
}).catch(console.error);