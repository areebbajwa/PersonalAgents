#!/usr/bin/env node

import { Command } from 'commander';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import mime from 'mime-types';

// Load environment variables from hardcoded config path
dotenv.config({ path: path.resolve(process.cwd(), '../../config/.env') });

class GmailCLI {
  constructor() {
    this.auth = null;
    this.gmail = null;
    this.calendar = null;
  }

  async initialize() {
    // Get credentials from environment
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new Error('Required Google OAuth credentials not found in config/.env');
    }

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    this.auth.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Initialize API clients
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  // Helper methods from MCP server
  getHeader(payload, name) {
    const header = payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  }

  getEmailBody(payload) {
    let textBody = null;
    let htmlBody = null;

    if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
      textBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
      htmlBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType.startsWith('multipart/')) {
      if (payload.parts && payload.parts.length > 0) {
        for (const part of payload.parts) {
          const partBody = this.getEmailBody(part);
          if (partBody.text) textBody = (textBody ? textBody + '\n' : '') + partBody.text;
          if (partBody.html) htmlBody = (htmlBody ? htmlBody + '\n' : '') + partBody.html;
          if (htmlBody && partBody.html) break;
        }
      }
    }
    return { text: textBody, html: htmlBody };
  }

  getAttachments(payload) {
    const attachments = [];
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size,
          });
        } else if (part.parts) {
          attachments.push(...this.getAttachments(part));
        }
      }
    }
    return attachments;
  }

  // Email Commands
  async listEmails(options) {
    const maxResults = options.maxResults || 10;
    const query = options.query || '';

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query,
    });

    if (!response.data.messages) {
      console.log(chalk.yellow('No messages found'));
      return;
    }

    const messages = await Promise.all(
      response.data.messages.map(async (message) => {
        const msg = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
        });

        const payload = msg.data.payload;
        return {
          id: message.id,
          subject: this.getHeader(payload, 'Subject') || '(no subject)',
          from: this.getHeader(payload, 'From') || '(unknown sender)',
          date: this.getHeader(payload, 'Date') || '(no date)',
          snippet: msg.data.snippet,
        };
      })
    );

    console.log(chalk.blue('\n📧 Recent Emails:'));
    messages.forEach((msg, index) => {
      console.log(chalk.gray(`\n${index + 1}. ID: ${msg.id}`));
      console.log(chalk.white(`   Subject: ${msg.subject}`));
      console.log(chalk.green(`   From: ${msg.from}`));
      console.log(chalk.yellow(`   Date: ${msg.date}`));
      console.log(chalk.gray(`   Snippet: ${msg.snippet}`));
    });
  }

  async searchEmails(query, options) {
    const maxResults = options.maxResults || 10;

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query,
    });

    if (!response.data.messages) {
      console.log(chalk.yellow(`No messages found for query: "${query}"`));
      return;
    }

    const messages = await Promise.all(
      response.data.messages.map(async (message) => {
        const msg = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
        });

        const payload = msg.data.payload;
        return {
          id: message.id,
          subject: this.getHeader(payload, 'Subject') || '(no subject)',
          from: this.getHeader(payload, 'From') || '(unknown sender)',
          date: this.getHeader(payload, 'Date') || '(no date)',
          snippet: msg.data.snippet,
        };
      })
    );

    console.log(chalk.blue(`\n🔍 Search Results for: "${query}"`));
    messages.forEach((msg, index) => {
      console.log(chalk.gray(`\n${index + 1}. ID: ${msg.id}`));
      console.log(chalk.white(`   Subject: ${msg.subject}`));
      console.log(chalk.green(`   From: ${msg.from}`));
      console.log(chalk.yellow(`   Date: ${msg.date}`));
      console.log(chalk.gray(`   Snippet: ${msg.snippet}`));
    });
  }

  async sendEmail(to, subject, body, options) {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
    ];

    if (options.cc) {
      emailLines.push(`Cc: ${options.cc}`);
    }
    if (options.bcc) {
      emailLines.push(`Bcc: ${options.bcc}`);
    }

    emailLines.push('');
    emailLines.push(body);

    const email = emailLines.join('\n');
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    console.log(chalk.green(`✅ Email sent successfully! Message ID: ${response.data.id}`));
  }

  async getEmailContent(messageId) {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const payload = message.payload;

    const subject = this.getHeader(payload, 'Subject');
    const from = this.getHeader(payload, 'From');
    const to = this.getHeader(payload, 'To');
    const date = this.getHeader(payload, 'Date');

    const { text, html } = this.getEmailBody(payload);
    const attachments = this.getAttachments(payload);

    console.log(chalk.blue('\n📧 Email Details:'));
    console.log(chalk.white(`Subject: ${subject}`));
    console.log(chalk.green(`From: ${from}`));
    console.log(chalk.green(`To: ${to}`));
    console.log(chalk.yellow(`Date: ${date}`));
    
    if (attachments.length > 0) {
      console.log(chalk.cyan(`\n📎 Attachments (${attachments.length}):`));
      attachments.forEach((att, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${att.filename} (${att.mimeType}) - ${att.size} bytes - ID: ${att.attachmentId}`));
      });
    }

    console.log(chalk.blue('\n📝 Content:'));
    if (text) {
      console.log(chalk.white(text));
    } else if (html) {
      console.log(chalk.gray('(HTML content - displaying raw HTML)'));
      console.log(chalk.white(html));
    } else {
      console.log(chalk.gray('(no readable content found)'));
    }
  }

  async getEmailAttachment(messageId, attachmentId, filename) {
    const response = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (!response.data.data) {
      throw new Error('Attachment data not found');
    }

    // Decode base64url data
    const data = Buffer.from(response.data.data, 'base64');
    
    // Use provided filename or generate one
    const outputFilename = filename || `attachment_${attachmentId}`;
    const outputPath = path.join(process.cwd(), 'tmp', outputFilename);

    // Ensure tmp directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    fs.writeFileSync(outputPath, data);
    console.log(chalk.green(`💾 Attachment saved to: ${outputPath}`));
    console.log(chalk.gray(`Size: ${data.length} bytes`));

    return outputPath;
  }

  async modifyEmail(messageId, addLabels, removeLabels) {
    const response = await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: addLabels || [],
        removeLabelIds: removeLabels || [],
      },
    });

    console.log(chalk.green(`✅ Email labels modified successfully for message: ${messageId}`));
  }

  // Calendar Commands
  async listEvents(options) {
    const maxResults = options.maxResults || 10;
    const timeMin = options.timeMin || new Date().toISOString();
    const timeMax = options.timeMax;

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    if (events.length === 0) {
      console.log(chalk.yellow('No upcoming events found'));
      return;
    }

    console.log(chalk.blue('\n📅 Upcoming Events:'));
    events.forEach((event, index) => {
      console.log(chalk.gray(`\n${index + 1}. ID: ${event.id}`));
      console.log(chalk.white(`   Summary: ${event.summary}`));
      console.log(chalk.green(`   Start: ${event.start?.dateTime || event.start?.date}`));
      console.log(chalk.yellow(`   End: ${event.end?.dateTime || event.end?.date}`));
      if (event.location) {
        console.log(chalk.cyan(`   Location: ${event.location}`));
      }
    });
  }

  async createEvent(summary, start, end, options) {
    const event = {
      summary,
      location: options.location,
      description: options.description,
      start: {
        dateTime: start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: options.attendees ? options.attendees.split(',').map(email => ({ email: email.trim() })) : [],
    };

    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log(chalk.green(`✅ Event created successfully! Event ID: ${response.data.id}`));
  }

  async updateEvent(eventId, options) {
    const event = {};
    if (options.summary) event.summary = options.summary;
    if (options.location) event.location = options.location;
    if (options.description) event.description = options.description;
    if (options.start) {
      event.start = {
        dateTime: options.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (options.end) {
      event.end = {
        dateTime: options.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (options.attendees) {
      event.attendees = options.attendees.split(',').map(email => ({ email: email.trim() }));
    }

    const response = await this.calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });

    console.log(chalk.green(`✅ Event updated successfully! Event ID: ${response.data.id}`));
  }

  async deleteEvent(eventId) {
    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    console.log(chalk.green(`✅ Event deleted successfully! Event ID: ${eventId}`));
  }
}

// CLI Setup
const program = new Command();
const cli = new GmailCLI();

program
  .name('gmail-cli')
  .description('A CLI tool for managing Gmail and Google Calendar')
  .version('1.0.0');

// Email Commands
program
  .command('list')
  .description('List recent emails')
  .option('-m, --max-results <number>', 'Maximum number of emails to return', '10')
  .option('-q, --query <string>', 'Search query to filter emails')
  .action(async (options) => {
    const spinner = ora('Initializing Gmail CLI...').start();
    try {
      await cli.initialize();
      spinner.succeed('Connected to Gmail');
      await cli.listEmails({ maxResults: parseInt(options.maxResults), query: options.query });
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search emails with advanced query')
  .option('-m, --max-results <number>', 'Maximum number of emails to return', '10')
  .action(async (query, options) => {
    const spinner = ora('Searching emails...').start();
    try {
      await cli.initialize();
      spinner.succeed('Connected to Gmail');
      await cli.searchEmails(query, { maxResults: parseInt(options.maxResults) });
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('send <to> <subject> <body>')
  .description('Send a new email')
  .option('--cc <emails>', 'CC recipients (comma-separated)')
  .option('--bcc <emails>', 'BCC recipients (comma-separated)')
  .action(async (to, subject, body, options) => {
    const spinner = ora('Sending email...').start();
    try {
      await cli.initialize();
      spinner.text = 'Sending email...';
      await cli.sendEmail(to, subject, body, options);
      spinner.succeed('Email sent successfully');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('content <messageId>')
  .description('Get the full content of an email')
  .action(async (messageId) => {
    const spinner = ora('Fetching email content...').start();
    try {
      await cli.initialize();
      spinner.succeed('Connected to Gmail');
      await cli.getEmailContent(messageId);
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('attachment <messageId> <attachmentId>')
  .description('Download an email attachment')
  .option('-f, --filename <name>', 'Custom filename for the attachment')
  .action(async (messageId, attachmentId, options) => {
    const spinner = ora('Downloading attachment...').start();
    try {
      await cli.initialize();
      spinner.text = 'Downloading attachment...';
      await cli.getEmailAttachment(messageId, attachmentId, options.filename);
      spinner.succeed('Attachment downloaded');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('modify <messageId>')
  .description('Modify email labels')
  .option('--add-labels <labels>', 'Labels to add (comma-separated)')
  .option('--remove-labels <labels>', 'Labels to remove (comma-separated)')
  .action(async (messageId, options) => {
    const spinner = ora('Modifying email labels...').start();
    try {
      await cli.initialize();
      const addLabels = options.addLabels ? options.addLabels.split(',').map(l => l.trim()) : [];
      const removeLabels = options.removeLabels ? options.removeLabels.split(',').map(l => l.trim()) : [];
      await cli.modifyEmail(messageId, addLabels, removeLabels);
      spinner.succeed('Email labels modified');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Calendar Commands
const events = program.command('events').description('Calendar event management');

events
  .command('list')
  .description('List upcoming calendar events')
  .option('-m, --max-results <number>', 'Maximum number of events to return', '10')
  .option('--time-min <time>', 'Start time in ISO format (default: now)')
  .option('--time-max <time>', 'End time in ISO format')
  .action(async (options) => {
    const spinner = ora('Fetching calendar events...').start();
    try {
      await cli.initialize();
      spinner.succeed('Connected to Google Calendar');
      await cli.listEvents({
        maxResults: parseInt(options.maxResults),
        timeMin: options.timeMin,
        timeMax: options.timeMax,
      });
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

events
  .command('create <summary> <start> <end>')
  .description('Create a new calendar event')
  .option('-l, --location <location>', 'Event location')
  .option('-d, --description <description>', 'Event description')
  .option('-a, --attendees <emails>', 'Attendee email addresses (comma-separated)')
  .action(async (summary, start, end, options) => {
    const spinner = ora('Creating calendar event...').start();
    try {
      await cli.initialize();
      spinner.text = 'Creating event...';
      await cli.createEvent(summary, start, end, options);
      spinner.succeed('Event created successfully');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

events
  .command('update <eventId>')
  .description('Update an existing calendar event')
  .option('-s, --summary <summary>', 'New event title')
  .option('-l, --location <location>', 'New event location')
  .option('-d, --description <description>', 'New event description')
  .option('--start <time>', 'New start time in ISO format')
  .option('--end <time>', 'New end time in ISO format')
  .option('-a, --attendees <emails>', 'New attendee email addresses (comma-separated)')
  .action(async (eventId, options) => {
    const spinner = ora('Updating calendar event...').start();
    try {
      await cli.initialize();
      spinner.text = 'Updating event...';
      await cli.updateEvent(eventId, options);
      spinner.succeed('Event updated successfully');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

events
  .command('delete <eventId>')
  .description('Delete a calendar event')
  .action(async (eventId) => {
    const spinner = ora('Deleting calendar event...').start();
    try {
      await cli.initialize();
      spinner.text = 'Deleting event...';
      await cli.deleteEvent(eventId);
      spinner.succeed('Event deleted successfully');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Environment Variables Help
program
  .command('env-help')
  .description('Show required environment variables')
  .action(() => {
    console.log(chalk.blue('\n📋 Required Environment Variables:'));
    console.log(chalk.white('The following variables must be set in config/.env:'));
    console.log(chalk.yellow('  GOOGLE_CLIENT_ID=your_google_client_id'));
    console.log(chalk.yellow('  GOOGLE_CLIENT_SECRET=your_google_client_secret'));
    console.log(chalk.yellow('  GOOGLE_REFRESH_TOKEN=your_refresh_token'));
    console.log(chalk.gray('\nNote: These are the same credentials used by the MCP server.'));
  });

// Parse and execute
if (process.argv.length === 2) {
  program.outputHelp();
} else {
  program.parse();
} 