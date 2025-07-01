#!/usr/bin/env node

/**
 * AI Monitor Test Framework
 * Tests various scenarios to ensure the AI Monitor behaves correctly
 */

const { ScreenMonitor } = require('../src/screen-monitor');
const fs = require('fs');
const path = require('path');

class AIMonitorTestFramework {
    constructor() {
        this.results = [];
        this.testDir = path.join(__dirname, 'test-scenarios');
        this.mockGeminiResponses = new Map();
    }

    /**
     * Mock the Gemini API call to return predefined responses
     */
    setupMockGemini(monitor) {
        const originalCallGeminiAPI = monitor.callGeminiAPI.bind(monitor);
        
        monitor.callGeminiAPI = async (prompt) => {
            // Extract scenario identifier from prompt
            const promptStr = JSON.stringify(prompt);
            
            // Check if we have a mock response for this scenario
            for (const [key, response] of this.mockGeminiResponses) {
                if (promptStr.includes(key) || promptStr.includes('Test scenario ' + key)) {
                    console.log(`🎭 Using mock response for scenario: ${key}`);
                    return response;
                }
            }
            
            // Return empty string if no mock found (no intervention)
            console.log('🎭 No mock response - returning empty (no intervention)');
            return '';
        };
    }

    /**
     * Create a test scenario with mock conversation data
     */
    createTestScenario(name, description, conversationEntries, expectedIntervention = null) {
        return {
            name,
            description,
            conversationEntries,
            expectedIntervention,
            todoContent: `# Test Todo
## Non-Negotiable User Requirements: "Test scenario ${name}"
## Tasks
🕒 Implement feature X
🕒 Write tests for feature X
🕒 Deploy to production`
        };
    }

    /**
     * Run a single test scenario
     */
    async runScenario(scenario) {
        console.log(`\n🧪 Running test: ${scenario.name}`);
        console.log(`   ${scenario.description}`);
        
        // Create a mock monitor instance
        const monitor = new ScreenMonitor({
            tmuxSessionName: 'test-session',
            projectName: 'test-project',
            workflowMode: 'dev',
            interval: 60000,
            enableGuidance: false,
            onCheckResult: (result) => {
                // Capture the result
                this.lastResult = result;
            }
        });
        
        // Setup mock Gemini if we have a predefined response
        if (scenario.mockGeminiResponse) {
            this.mockGeminiResponses.set(scenario.name, scenario.mockGeminiResponse);
        }
        this.setupMockGemini(monitor);
        
        // Mock the readClaudeLogs method to return our test conversation
        monitor.readClaudeLogs = () => {
            const formatted = monitor.formatClaudeLogsForMonitor(scenario.conversationEntries);
            return formatted;
        };
        
        // Mock the readTodoList method
        monitor.readTodoList = () => scenario.todoContent;
        
        // Run the check
        const result = await monitor.check();
        
        // Verify the result
        const passed = this.verifyResult(scenario, result);
        
        this.results.push({
            scenario: scenario.name,
            description: scenario.description,
            passed,
            actualIntervention: result?.geminiAnalysis || null,
            expectedIntervention: scenario.expectedIntervention
        });
        
        return passed;
    }

    /**
     * Verify if the monitor's response matches expectations
     */
    verifyResult(scenario, result) {
        const actualIntervention = result?.geminiAnalysis?.trim() || '';
        const expectedIntervention = scenario.expectedIntervention || '';
        
        if (expectedIntervention === '') {
            // Should not intervene
            const passed = actualIntervention === '';
            console.log(passed ? '✅ Correctly did not intervene' : '❌ Incorrectly intervened');
            if (!passed) {
                console.log(`   Unexpected intervention: "${actualIntervention}"`);
            }
            return passed;
        } else {
            // Should intervene with specific message
            const passed = actualIntervention !== '' && 
                          (actualIntervention.includes('ai-monitor:') || 
                           actualIntervention.includes(expectedIntervention));
            console.log(passed ? '✅ Correctly intervened' : '❌ Failed to intervene correctly');
            if (!passed) {
                console.log(`   Expected: "${expectedIntervention}"`);
                console.log(`   Actual: "${actualIntervention}"`);
            }
            return passed;
        }
    }

    /**
     * Generate test report
     */
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 AI MONITOR TEST RESULTS');
        console.log('='.repeat(60));
        
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        const passRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\nTotal Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Pass Rate: ${passRate}%`);
        
        if (total - passed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`\n- ${r.scenario}: ${r.description}`);
                console.log(`  Expected: "${r.expectedIntervention || 'No intervention'}"`);
                console.log(`  Actual: "${r.actualIntervention || 'No intervention'}"`);
            });
        }
        
        // Save detailed report
        const reportPath = path.join(__dirname, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        return passed === total;
    }

    /**
     * Run basic functionality test
     */
    async runBasicFunctionalityTest() {
        console.log('\n🔧 Running Basic Functionality Test...\n');
        
        try {
            // Test 1: Monitor can be created
            const monitor = new ScreenMonitor({
                tmuxSessionName: 'test-session',
                projectName: 'test-project',
                workflowMode: 'dev',
                interval: 60000,
                enableGuidance: false
            });
            console.log('✅ Monitor instance created successfully');
            
            // Test 2: Can read workflow rules
            const rules = monitor.readWorkflowRules();
            console.log(rules ? '✅ Workflow rules loaded' : '❌ Failed to load workflow rules');
            
            // Test 3: Can format Claude logs
            const testEntries = [
                { type: 'user', message: 'Test message' },
                { type: 'assistant', message: 'Test response' }
            ];
            const formatted = monitor.formatClaudeLogsForMonitor(testEntries);
            console.log(formatted.includes('[Turn 1]') ? '✅ Log formatting works' : '❌ Log formatting failed');
            
            // Test 4: Prompt generation works
            const prompt = monitor.generateCompliancePrompt('Test output', 'Test todo');
            const promptObj = JSON.parse(prompt);
            console.log(promptObj.instruction ? '✅ Prompt generation works' : '❌ Prompt generation failed');
            
            return true;
        } catch (error) {
            console.error('❌ Basic functionality test failed:', error.message);
            return false;
        }
    }
}

// Export for use in other test files
module.exports = { AIMonitorTestFramework };

// Run basic test if called directly
if (require.main === module) {
    (async () => {
        const framework = new AIMonitorTestFramework();
        const passed = await framework.runBasicFunctionalityTest();
        process.exit(passed ? 0 : 1);
    })();
}