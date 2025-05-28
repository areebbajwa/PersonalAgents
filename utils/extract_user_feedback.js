#!/usr/bin/env node

const fs = require('fs');

/**
 * Extracts all user feedback/messages from Cursor conversation export files
 * Usage: node extract_user_feedback.js <file_path>
 */

function extractUserFeedback(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const sections = content.split(/---\s*\n/);
        
        const userMessages = [];
        let messageIndex = 0;
        
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            
            if (i === 0 || !section || section.length < 10) continue;
            
            if (section.startsWith('**User**')) {
                messageIndex++;
                
                const lines = section.split('\n');
                const userMessageLines = [];
                let foundUserLine = false;
                
                for (const line of lines) {
                    if (line.trim() === '**User**') {
                        foundUserLine = true;
                        continue;
                    }
                    
                    if (foundUserLine) {
                        if (line.trim().startsWith('**Cursor**') || line.trim() === '---') {
                            break;
                        }
                        userMessageLines.push(line);
                    }
                }
                
                const userMessage = userMessageLines.join('\n').trim();
                if (userMessage) {
                    userMessages.push({
                        index: messageIndex,
                        content: userMessage
                    });
                }
            }
        }
        
        return userMessages;
        
    } catch (error) {
        console.error('Error processing file:', error.message);
        process.exit(1);
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node extract_user_feedback.js <file_path>');
        process.exit(1);
    }
    
    const filePath = args[0];
    
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    
    const messages = extractUserFeedback(filePath);
    
    console.log(`Found ${messages.length} user messages:\n`);
    
    messages.forEach((msg) => {
        console.log(`=== MESSAGE ${msg.index} ===`);
        console.log(msg.content);
        console.log('');
    });
}

module.exports = { extractUserFeedback }; 