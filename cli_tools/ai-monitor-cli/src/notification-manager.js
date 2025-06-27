/**
 * AI Monitor Notification System
 * Core functionality for notifications and alerts
 */

const fs = require('fs');
const path = require('path');

class NotificationManager {
    constructor(options = {}) {
        this.logFile = options.logFile || path.join(__dirname, '..', 'logs', 'notifications.log');
        this.alertLevel = options.alertLevel || 'WARNING';
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile !== false;
    }

    /**
     * Parse Gemini analysis for notification level
     */
    parseAnalysisLevel(geminiAnalysis) {
        if (!geminiAnalysis) return 'INFO';
        
        const analysis = geminiAnalysis.toUpperCase();
        
        if (analysis.includes('STATUS: VIOLATION')) {
            return 'VIOLATION';
        } else if (analysis.includes('STATUS: WARNING')) {
            return 'WARNING';
        } else if (analysis.includes('STATUS: COMPLIANT')) {
            return 'INFO';
        }
        
        if (analysis.includes('ISSUES:') && !analysis.includes('ISSUES: NONE')) {
            return 'WARNING';
        }
        
        return 'INFO';
    }

    /**
     * Extract recommended actions from Gemini analysis
     */
    extractActions(geminiAnalysis) {
        if (!geminiAnalysis) return [];
        
        const actionsMatch = geminiAnalysis.match(/ACTIONS:\s*(.*?)$/ms);
        if (!actionsMatch) return [];
        
        const actionsText = actionsMatch[1].trim();
        if (actionsText.toLowerCase().includes('none') || actionsText.length === 0) {
            return [];
        }
        
        return actionsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('-'))
            .map(line => line.replace(/^[-•*]\s*/, ''))
            .slice(0, 5);
    }

    /**
     * Send notification
     */
    notify(level, message, details = {}) {
        const timestamp = new Date().toISOString();
        const notification = {
            timestamp,
            level,
            message,
            project: details.project || 'unknown',
            mode: details.mode || 'unknown',
            ...details
        };

        // Console notification
        if (this.enableConsole) {
            const levelIcon = {
                'INFO': 'ℹ️ ',
                'WARNING': '⚠️ ',
                'VIOLATION': '🚨'
            }[level] || '📢';
            
            console.log(`${levelIcon} [${level}] ${message}`);
            
            if (details.actions && details.actions.length > 0) {
                console.log('   Recommended actions:');
                details.actions.forEach(action => {
                    console.log(`   • ${action}`);
                });
            }
        }

        // File logging
        if (this.enableFile) {
            try {
                fs.appendFileSync(this.logFile, JSON.stringify(notification) + '\n');
            } catch (error) {
                console.error('Failed to write notification to file:', error.message);
            }
        }

        return notification;
    }

    /**
     * Process monitor log entry and send notifications
     */
    processMonitorEntry(logEntry) {
        const level = this.parseAnalysisLevel(logEntry.geminiAnalysis);
        const actions = this.extractActions(logEntry.geminiAnalysis);
        
        const levelPriority = { 'INFO': 1, 'WARNING': 2, 'VIOLATION': 3 };
        const alertPriority = levelPriority[this.alertLevel] || 2;
        
        if (levelPriority[level] < alertPriority) {
            return null;
        }

        let message;
        if (level === 'VIOLATION') {
            message = `Workflow rule violation detected in project ${logEntry.project}`;
        } else if (level === 'WARNING') {
            message = `Workflow compliance warning for project ${logEntry.project}`;
        } else {
            message = `Workflow status update for project ${logEntry.project}`;
        }

        return this.notify(level, message, {
            project: logEntry.project,
            mode: logEntry.mode,
            contentPreview: logEntry.preview,
            geminiAnalysis: logEntry.geminiAnalysis,
            actions: actions,
            guidanceSent: logEntry.guidanceSent
        });
    }

    /**
     * Get recent notifications
     */
    getRecentNotifications(count = 10) {
        try {
            if (!fs.existsSync(this.logFile)) {
                return [];
            }

            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.length > 0);
            
            return lines
                .slice(-count)
                .map(line => JSON.parse(line))
                .reverse();
                
        } catch (error) {
            console.error('Failed to read notifications:', error.message);
            return [];
        }
    }

    /**
     * Clear old notifications
     */
    clearOldNotifications(daysOld = 7) {
        try {
            if (!fs.existsSync(this.logFile)) {
                return 0;
            }

            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.length > 0);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const recentLines = lines.filter(line => {
                try {
                    const notification = JSON.parse(line);
                    return new Date(notification.timestamp) > cutoffDate;
                } catch {
                    return false;
                }
            });

            const removedCount = lines.length - recentLines.length;
            
            if (removedCount > 0) {
                fs.writeFileSync(this.logFile, recentLines.join('\n') + '\n');
            }
            
            return removedCount;
            
        } catch (error) {
            console.error('Failed to clean up notifications:', error.message);
            return 0;
        }
    }
}

module.exports = { NotificationManager };