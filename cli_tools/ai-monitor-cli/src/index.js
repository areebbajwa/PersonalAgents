#!/usr/bin/env node

/**
 * AI Monitor CLI - Main entry point
 * Monitors workflow compliance and provides guidance
 */

const { program } = require('commander');
const { ScreenMonitor } = require('./screen-monitor');
const { NotificationManager } = require('./notification-manager');
const path = require('path');
const fs = require('fs');

program
  .name('ai-monitor-cli')
  .description('AI Monitor for monitoring workflow compliance and providing guidance')
  .version('1.0.0');

// Monitor command - Main functionality
program
  .command('monitor')
  .description('Start monitoring screen output for workflow compliance')
  .option('-l, --log-path <path>', 'Path to screen log file', '/tmp/screen_output.log')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '60')
  .option('-p, --project <name>', 'Project name for context', 'unknown')
  .option('-m, --mode <mode>', 'Workflow mode (dev/task)', 'dev')
  .option('-s, --screen-session <name>', 'Screen session name to send guidance to')
  .option('-a, --alert-level <level>', 'Notification level (INFO/WARNING/VIOLATION)', 'WARNING')
  .option('--no-guidance', 'Disable sending guidance instructions to screen')
  .option('--once', 'Run once and exit (don\'t start continuous monitoring)')
  .action(async (options) => {
    const notificationManager = new NotificationManager({
      alertLevel: options.alertLevel
    });

    const monitor = new ScreenMonitor({
      screenLogPath: options.logPath,
      intervalMs: parseInt(options.interval) * 1000,
      projectName: options.project,
      workflowMode: options.mode,
      screenSessionName: options.screenSession,
      enableGuidance: options.guidance,
      alertLevel: options.alertLevel,
      onCheckResult: (result) => {
        // Process each monitoring result through the notification manager
        notificationManager.processMonitorEntry(result);
      }
    });

    console.log(`🤖 AI Monitor monitoring started`);
    console.log(`   Project: ${options.project}`);
    console.log(`   Mode: ${options.mode}`);
    console.log(`   Log: ${options.logPath}`);
    console.log(`   Interval: ${options.interval}s`);
    if (options.screenSession) {
      console.log(`   Screen session: ${options.screenSession}`);
    }
    console.log('');

    if (options.once) {
      console.log('Running single check...');
      const result = await monitor.check();
      if (result) {
        notificationManager.processMonitorEntry(result);
        console.log('✅ Single check completed');
      } else {
        console.log('ℹ️  No new content to process');
      }
      process.exit(0);
    }

    // Continuous monitoring
    const success = monitor.start();
    if (!success) {
      console.error('❌ Failed to start monitoring');
      process.exit(1);
    }

    console.log('✅ Monitoring active - Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down AI Monitor...');
      monitor.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down AI Monitor...');
      monitor.stop();
      process.exit(0);
    });

    // Keep process alive and process results
    const checkInterval = setInterval(async () => {
      // The monitor handles the checking, we just need to process any results
      // This is handled internally by the monitor
    }, parseInt(options.interval) * 1000);
  });

// Notifications command
program
  .command('notifications')
  .description('Manage notifications')
  .option('-c, --count <number>', 'Number of recent notifications to show', '10')
  .option('--cleanup <days>', 'Clean up notifications older than days', '7')
  .option('--log-file <path>', 'Path to notification log file')
  .action((options) => {
    const notificationManager = new NotificationManager({
      logFile: options.logFile
    });

    if (options.cleanup) {
      const removed = notificationManager.clearOldNotifications(parseInt(options.cleanup));
      console.log(`🧹 Cleaned up ${removed} old notifications`);
      return;
    }

    const notifications = notificationManager.getRecentNotifications(parseInt(options.count));
    
    if (notifications.length === 0) {
      console.log('📭 No recent notifications');
      return;
    }

    console.log(`📋 Recent ${notifications.length} Notifications`);
    console.log('=' .repeat(50));
    
    notifications.forEach((notif, index) => {
      const time = new Date(notif.timestamp).toLocaleString();
      const icon = {
        'INFO': 'ℹ️ ',
        'WARNING': '⚠️ ',
        'VIOLATION': '🚨'
      }[notif.level] || '📢';
      
      console.log(`${index + 1}. ${icon}[${notif.level}] ${time}`);
      console.log(`   Project: ${notif.project} (${notif.mode} mode)`);
      console.log(`   ${notif.message}`);
      
      if (notif.actions && notif.actions.length > 0) {
        console.log('   Actions:');
        notif.actions.forEach(action => console.log(`   • ${action}`));
      }
      console.log('');
    });
  });

// Status command
program
  .command('status')
  .description('Show AI Monitor status and configuration')
  .action(() => {
    console.log('🤖 AI Monitor CLI Status');
    console.log('=' .repeat(30));
    
    // Check Gemini API key
    const hasApiKey = process.env.GEMINI_API_KEY || checkConfigForApiKey();
    console.log(`Gemini API Key: ${hasApiKey ? '✅ Available' : '❌ Not found'}`);
    
    // Check for common screen sessions
    const { exec } = require('child_process');
    exec('screen -ls', (error, stdout, stderr) => {
      if (error) {
        console.log('Screen sessions: ❌ Not available');
      } else {
        const sessions = stdout.split('\n').filter(line => line.includes('(') && line.includes(')')).length;
        console.log(`Screen sessions: ${sessions > 0 ? `✅ ${sessions} active` : '⚠️  None active'}`);
      }
    });
    
    // Check workflow-cli integration
    try {
      const workflowCliPath = path.resolve(__dirname, '../../../workflow-cli/workflow-cli.py');
      const hasWorkflowCli = fs.existsSync(workflowCliPath);
      console.log(`Workflow CLI: ${hasWorkflowCli ? '✅ Available' : '❌ Not found'}`);
      
      if (hasWorkflowCli) {
        // Check if --remind-rules is available
        exec('python3 ' + workflowCliPath + ' --help', (error, stdout) => {
          if (!error && stdout.includes('--remind-rules')) {
            console.log('--remind-rules: ✅ Available');
          } else {
            console.log('--remind-rules: ❌ Not available');
          }
        });
      }
    } catch (error) {
      console.log('Workflow CLI: ❌ Error checking');
    }
    
    console.log('');
    console.log('💡 Usage Examples:');
    console.log('  ai-manager-cli monitor --project my-project --screen-session my-session');
    console.log('  ai-manager-cli notifications --count 5');
    console.log('  ai-manager-cli monitor --once --project test');
  });

// Test command
program
  .command('test')
  .description('Test AI Monitor functionality')
  .option('-s, --screen-session <name>', 'Screen session to test with')
  .action(async (options) => {
    console.log('🧪 Testing AI Monitor functionality...');
    
    const monitor = new ScreenMonitor({
      projectName: 'test',
      workflowMode: 'dev',
      screenSessionName: options.screenSession,
      enableGuidance: !!options.screenSession
    });
    
    // Test 1: API key loading
    console.log('1. Testing API key loading...');
    const hasApiKey = monitor.geminiApiKey !== null;
    console.log(`   ${hasApiKey ? '✅ API key loaded' : '⚠️  No API key found'}`);
    
    // Test 2: Screen command generation
    if (options.screenSession) {
      console.log('2. Testing screen command...');
      try {
        await monitor.sendGuidanceToScreen('echo "AI Monitor test successful"');
        console.log('   ✅ Screen command sent');
      } catch (error) {
        console.log(`   ❌ Screen command failed: ${error.message}`);
      }
    } else {
      console.log('2. Skipping screen test (no session specified)');
    }
    
    // Test 3: Notification system
    console.log('3. Testing notification system...');
    const notificationManager = new NotificationManager();
    notificationManager.notify('INFO', 'AI Monitor test notification', {
      project: 'test',
      mode: 'dev'
    });
    console.log('   ✅ Notification system working');
    
    console.log('');
    console.log('🎉 AI Monitor test completed');
  });

// Monitor-all command - Monitor all active projects
program
  .command('monitor-all')
  .description('Monitor all active AI Monitor processes and show live output')
  .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '5')
  .option('--log-file <path>', 'Path to notification log file')
  .action(async (options) => {
    const notificationManager = new NotificationManager({
      logFile: options.logFile
    });
    
    console.log('🤖 AI Monitor Live Monitor - All Projects');
    console.log('=' .repeat(50));
    console.log('Press Ctrl+C to exit\n');
    
    const refreshInterval = parseInt(options.refresh) * 1000;
    let lastShownTimestamp = new Date(Date.now() - 60000); // Start from 1 minute ago
    
    const displayUpdate = () => {
      // Clear screen and reset cursor
      process.stdout.write('\x1b[2J\x1b[H');
      
      console.log('🤖 AI Monitor Live Monitor - All Projects');
      console.log('=' .repeat(50));
      console.log(`Last refresh: ${new Date().toLocaleTimeString()}`);
      console.log('');
      
      // Check for active AI Monitor processes
      const stateDir = path.resolve(__dirname, '../../workflow-cli/state');
      let activeProjects = [];
      
      try {
        if (fs.existsSync(stateDir)) {
          const files = fs.readdirSync(stateDir);
          const pidFiles = files.filter(f => f.startsWith('ai_manager_pid_') && f.endsWith('.txt'));
          
          pidFiles.forEach(pidFile => {
            const projectName = pidFile.replace('ai_manager_pid_', '').replace('.txt', '');
            const pidPath = path.join(stateDir, pidFile);
            
            try {
              const pid = fs.readFileSync(pidPath, 'utf8').trim();
              // Check if process is running
              process.kill(parseInt(pid), 0);
              activeProjects.push({ project: projectName, pid: parseInt(pid) });
            } catch (error) {
              // Process not running, remove stale PID file
              fs.unlinkSync(pidPath);
            }
          });
        }
      } catch (error) {
        console.error('Error checking active projects:', error.message);
      }
      
      // Get all notifications for history
      const allHistory = notificationManager.getRecentNotifications(100);
      
      // Display active projects with their activity feeds
      if (activeProjects.length > 0) {
        console.log('📊 Active Projects with Activity Feed:');
        console.log('=' .repeat(50));
        
        activeProjects.forEach(({ project, pid }) => {
          console.log(`\n🟢 ${project} (PID: ${pid})`);
          console.log('-' .repeat(50));
          
          // Get notifications for this project
          const projectNotifications = allHistory.filter(n => n.project === project).slice(0, 5);
          
          if (projectNotifications.length === 0) {
            console.log('   No activity recorded for this project');
          } else {
            projectNotifications.forEach(notif => {
              const time = new Date(notif.timestamp).toLocaleTimeString();
              const date = new Date(notif.timestamp).toLocaleDateString();
              const icon = {
                'INFO': 'ℹ️ ',
                'WARNING': '⚠️ ',
                'VIOLATION': '🚨'
              }[notif.level] || '📢';
              
              console.log(`   ${date} ${time} ${icon}${notif.message}`);
              
              if (notif.guidanceSent) {
                console.log(`      ↳ Sent: "${notif.guidanceSent}"`);
              }
              
              if (notif.actions && notif.actions.length > 0) {
                notif.actions.forEach(action => {
                  console.log(`      • ${action}`);
                });
              }
            });
          }
        });
        console.log('');
      } else {
        console.log('ℹ️  No active AI Monitor processes\n');
      }
      
      // Get recent notifications since last check
      const newNotifications = allHistory.filter(n => 
        new Date(n.timestamp) > lastShownTimestamp
      );
      
      if (newNotifications.length > 0) {
        console.log(`\n📢 New Activity Since Last Check (${newNotifications.length} events):`);
        console.log('-' .repeat(50));
        
        newNotifications.forEach(notif => {
          const time = new Date(notif.timestamp).toLocaleTimeString();
          const icon = {
            'INFO': 'ℹ️ ',
            'WARNING': '⚠️ ',
            'VIOLATION': '🚨'
          }[notif.level] || '📢';
          
          console.log(`${time} ${icon}[${notif.project}] ${notif.message}`);
          
          if (notif.guidanceSent) {
            console.log(`         ↳ Sent: "${notif.guidanceSent}"`);
          }
        });
        
        // Update last shown timestamp
        if (newNotifications.length > 0) {
          lastShownTimestamp = new Date(newNotifications[0].timestamp);
        }
      }
      
      
      console.log('\nPress Ctrl+C to exit');
    };
    
    // Initial display
    displayUpdate();
    
    // Set up refresh interval
    const intervalId = setInterval(displayUpdate, refreshInterval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      console.log('\n\n👋 Exiting live monitor');
      process.exit(0);
    });
  });

function checkConfigForApiKey() {
  try {
    const envPath = path.resolve(__dirname, '../../../config/.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      return envContent.includes('GEMINI_API_KEY=');
    }
  } catch (error) {
    return false;
  }
  return false;
}

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);