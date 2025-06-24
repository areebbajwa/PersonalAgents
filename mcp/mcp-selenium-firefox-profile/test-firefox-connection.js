import pkg from 'selenium-webdriver';
const { Builder } = pkg;
import { promises as fs } from 'fs';

async function testConnection() {
    console.log('=== Testing Firefox Connection ===\n');
    
    // Read coordination file
    try {
        const coordination = JSON.parse(await fs.readFile('/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/mcp/selenium-mcp-coordination.json', 'utf-8'));
        console.log('Coordination file found:', coordination);
        
        const port = coordination.port;
        console.log(`\nAttempting to connect to Firefox on port ${port}...`);
        
        // Test different connection URLs
        const urls = [
            `http://localhost:${port}`,
            `http://localhost:${port}/wd/hub`,
            `http://127.0.0.1:${port}`,
            `http://127.0.0.1:${port}/wd/hub`
        ];
        
        for (const url of urls) {
            console.log(`\nTrying URL: ${url}`);
            try {
                const builder = new Builder()
                    .forBrowser('firefox')
                    .usingServer(url);
                
                console.log('Creating driver...');
                const driver = await builder.build();
                console.log('✅ Connection successful!');
                
                console.log('Testing window operations...');
                await driver.switchTo().newWindow('tab');
                console.log('✅ New tab created successfully!');
                
                await driver.quit();
                console.log('✅ Driver quit successfully!');
                
                console.log(`\n🎉 Working URL found: ${url}`);
                return;
                
            } catch (e) {
                console.log(`❌ Failed: ${e.message}`);
            }
        }
        
        console.log('\n❌ All connection attempts failed');
        
    } catch (e) {
        console.error('Error reading coordination file:', e.message);
    }
}

testConnection().catch(console.error);