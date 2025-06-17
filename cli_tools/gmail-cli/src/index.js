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
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from hardcoded config path
// dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') });

class GmailCLI {
  constructor() {
    this.auth = null;
    this.gmail = null;
    this.calendar = null;
    this.genAI = null;
  }

  async initialize(profile = 'default') {
    // Load environment variables based on profile
    const envPath =
      profile === 'default'
        ? path.resolve(__dirname, '../../../config/.env')
        : path.resolve(__dirname, `../../../config/.env.${profile}`);

    if (!fs.existsSync(envPath)) {
      throw new Error(`Profile configuration file not found: ${envPath}`);
    }
    dotenv.config({ path: envPath, override: true });

    // Get credentials from environment
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      throw new Error('Required Google OAuth credentials not found in config/.env');
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error(`GEMINI_API_KEY not found in ${path.basename(envPath)}`);
    }

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    this.auth.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Initialize API clients
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

  async processInBatches(items, batchSize, processFn) {
    let results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processFn));
      results = results.concat(batchResults);
      if (this.onProgress) {
        this.onProgress(results.length, items.length);
      }
    }
    return results;
  }

  // Email Commands
  async listEmails(options) {
    const maxResults = options.maxResults || 10;
    const query = options.query || '';

    const finalQuery = `${query || ''} -label:"to-follow"`;
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: finalQuery,
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
    const sort = options.sort;

    const finalQuery = `${query} -label:"to-follow"`;
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: finalQuery,
    });

    if (!response.data.messages) {
      console.log(chalk.yellow(`No messages found for query: "${query}"`));
      return;
    }

    let messages = await Promise.all(
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

    if (sort) {
      messages.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sort === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

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
    const emailLines = [];
    // if we are replying to a thread, we need to fetch the original message
    if (options.replyTo) {
      const originalMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: options.replyTo,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Message-ID', 'References'],
      });

      const originalSubject = this.getHeader(originalMessage.data.payload, 'Subject');
      const originalMessageId = this.getHeader(originalMessage.data.payload, 'Message-ID');
      const originalReferences = this.getHeader(originalMessage.data.payload, 'References');

      emailLines.push(`To: ${this.getHeader(originalMessage.data.payload, 'From')}`);
      emailLines.push(`Subject: Re: ${originalSubject}`);
      emailLines.push(`In-Reply-To: ${originalMessageId}`);
      emailLines.push(`References: ${originalReferences ? originalReferences + ' ' : ''}${originalMessageId}`);
    } else {
      emailLines.push(`To: ${to}`);
      emailLines.push(`Subject: ${subject}`);
    }


    if (options.cc) {
      emailLines.push(`Cc: ${options.cc}`);
    }
    if (options.bcc) {
      emailLines.push(`Bcc: ${options.bcc}`);
    }

    emailLines.push('');
    emailLines.push(body.replace(/\\n/g, '\n'));

    const email = emailLines.join('\n');
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const requestBody = {
      raw: encodedEmail,
    };

    if (options.replyTo) {
      const originalMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: options.replyTo,
        format: 'minimal',
      });
      requestBody.threadId = originalMessage.data.threadId;
    }

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    if (options.replyTo) {
      await this.modifyEmail(options.replyTo, [], ['UNREAD']);
    }

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
    const threadId = message.threadId;

    const { text, html } = this.getEmailBody(payload);
    const attachments = this.getAttachments(payload);

    console.log(chalk.blue('\n📧 Email Details:'));
    console.log(chalk.white(`Subject: ${subject}`));
    console.log(chalk.green(`From: ${from}`));
    console.log(chalk.green(`To: ${to}`));
    console.log(chalk.yellow(`Date: ${date}`));
    console.log(chalk.magenta(`Thread ID: ${threadId}`));
    
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

  async listThreads(options) {
    const { query, maxResults, last = '2w', silent = false } = options;
    const spinner = ora('Fetching threads...').start();
    let allThreads = [];
    let nextPageToken = null;

    try {
      const finalQuery = `-label:"to-follow" from:me ${query || ''}`;
      const listResponse = await this.gmail.users.threads.list({
        userId: 'me',
        q: finalQuery,
        maxResults,
      });

      if (!listResponse.data.threads) {
        spinner.succeed('No threads found matching your criteria.');
        return [];
      }

      const threads = listResponse.data.threads;
      spinner.text = `Found ${threads.length} threads. Fetching details...`;

      this.onProgress = (processed, total) => {
        spinner.text = `Processing threads... ${processed}/${total}`;
      };

      const detailedThreads = await this.processInBatches(threads, 20, async (thread) => {
        const threadDetails = await this.gmail.users.threads.get({
          userId: 'me',
          id: thread.id,
          format: 'full',
        });
        return threadDetails.data;
      });

      this.onProgress = null;

      if (detailedThreads.length === 0) {
        spinner.succeed('No threads found matching your criteria.');
        return [];
      }

      // Sort threads by the date of the first message
      detailedThreads.sort((a, b) => {
        const dateA = new Date(this.getHeader(a.messages[0].payload, 'Date')).getTime();
        const dateB = new Date(this.getHeader(b.messages[0].payload, 'Date')).getTime();
        return dateA - dateB;
      });

      spinner.succeed(`Fetched ${detailedThreads.length} threads.`);

      if (!silent) {
        for (const [index, thread] of detailedThreads.entries()) {
          let threadContent = '';
          threadContent += `--- Thread ${index + 1} / ${detailedThreads.length} | Thread ID: ${thread.id} ---\n\n`;

          for (const [msgIndex, message] of thread.messages.entries()) {
            const { text } = this.getEmailBody(message.payload);
            const from = this.getHeader(message.payload, 'From');
            const subject = this.getHeader(message.payload, 'Subject');
            const date = this.getHeader(message.payload, 'Date');

            threadContent += `--- Message ${msgIndex + 1} / ${thread.messages.length} ---\n`;
            threadContent += `From: ${from}\n`;
            threadContent += `Subject: ${subject}\n`;
            threadContent += `Date: ${date}\n`;
            threadContent += '--- Body ---\n';

            if (text) {
              threadContent += `${text}\n`;
            } else {
              threadContent += '(No text content)\n';
            }
            threadContent += '\n';
          }
          console.log(threadContent);
        }
      }
      return detailedThreads;
    } catch (error) {
      spinner.fail(`Error fetching threads: ${error.message}`);
      throw error;
    }
  }

  async refreshCache(options) {
    const spinner = ora('Refreshing threads cache...').start();
    try {
      const threads = await this.listThreads({ ...options, silent: true });
      const simplifiedThreads = threads.map(thread => {
        let threadContent = '';
        for (const message of thread.messages) {
          const { text } = this.getEmailBody(message.payload);
          const from = this.getHeader(message.payload, 'From');
          threadContent += `From: ${from}\n${text}\n\n`;
        }
        return threadContent;
      });

      const cachePath = path.resolve(__dirname, '../threads_cache.json');
      fs.writeFileSync(cachePath, JSON.stringify(simplifiedThreads, null, 2));
      spinner.succeed(`Successfully refreshed threads cache with ${simplifiedThreads.length} threads.`);
    } catch (error) {
      spinner.fail(`Error refreshing cache: ${error.message}`);
      throw error;
    }
  }

  async respondToMultipleThreads(threadIdsString, options) {
    const spinner = ora('Generating response...').start();
    try {
      const cachePath = path.resolve(__dirname, '../threads_cache.json');
      if (!fs.existsSync(cachePath)) {
        throw new Error('Threads cache not found. Please run `refresh-cache` first.');
      }

      const cachedThreads = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

      const threadIds = threadIdsString.split(',').map(id => id.trim());
      if (threadIds.length === 0) {
        spinner.warn('No thread IDs provided.');
        return;
      }

      spinner.text = `Fetching details for ${threadIds.length} thread(s)...`;

      const threadsData = [];
      for (const threadId of threadIds) {
        const threadDetails = await this.gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });

        let currentThreadContent = '';
        for (const message of threadDetails.data.messages) {
          const { text } = this.getEmailBody(message.payload);
          const from = this.getHeader(message.payload, 'From');
          currentThreadContent += `From: ${from}\n${text}\n\n`;
        }
        threadsData.push({
          id: threadId,
          content: currentThreadContent,
          details: threadDetails.data
        });
      }
      
      spinner.text = 'Constructing prompt for AI...';

      let prompt = `
        Based on the following previous email threads, please draft a separate response for each of the current threads provided below.
        Each response must be concise, helpful, and consistent with the tone of previous replies.

        You will be given several "Current Thread" blocks, each with an ID (e.g., Current Thread 1 (ID: actual_thread_id_here)).
        For each of these threads, you MUST generate a response.
        Each generated response MUST strictly follow this format, replacing 'ACTUAL_THREAD_ID' with the specific ID of the thread you are responding to:
        ===START_RESPONSE_FOR_THREAD_ID_ACTUAL_THREAD_ID===
        (Your response content for this thread)
        ===END_RESPONSE_FOR_THREAD_ID_ACTUAL_THREAD_ID===

        It is critical that you use the exact delimiters and replace 'ACTUAL_THREAD_ID' with the real thread ID.
        Do NOT include any other text or explanations outside these delimited blocks for each response.

        Previous Threads (for context):
        ${JSON.stringify(cachedThreads, null, 2)}

      `;

      threadsData.forEach((thread, index) => {
        prompt += `
        Current Thread ${index + 1} (ID: ${thread.id}):
        --- Start of Content for Thread ${thread.id} ---
        ${thread.content}
        --- End of Content for Thread ${thread.id} ---
        `;
      });

      prompt += `
        Now, please provide the distinct responses for each "Current Thread" listed above, ensuring each response is wrapped in the specified start/end delimiters with the correct thread ID.
      `;

      const generationConfig = {
        thinkingConfig: {
          thinkingBudget: -1,
        },
        responseMimeType: 'text/plain',
      };
      const model = 'gemini-2.5-pro';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const responseStream = await this.genAI.models.generateContentStream({
        model,
        config: generationConfig,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        fullResponse += chunkText;
        process.stdout.write(chalk.cyan(chunkText));
      }
      
      spinner.succeed('\nGenerated response complete.');
    } catch (error) {
      spinner.fail(`Error responding to threads: ${error.message}`);
      throw error;
    }
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

  async generateAndDisplayResponses(inputData, cliOptions) {
    const spinner = ora('Generating response...').start();
    try {
      const cachePath = path.resolve(__dirname, '../threads_cache.json');
      if (!fs.existsSync(cachePath) && !inputData.isTextInput) { // Cache only strictly needed if not direct text input and we want context
         spinner.warn('Threads cache not found. Context from previous threads will be limited. Consider running `refresh-cache`.');
      }
      
      const cachedThreads = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : [];

      const threadsData = [];

      if (inputData.isTextInput) {
        spinner.text = 'Processing direct text input...';
        threadsData.push({
          id: 'direct-input-0', // Generic ID for direct input
          content: inputData.textInput,
          details: null, // No actual Gmail thread details
        });
      } else {
        const threadIds = inputData.threadIdsString.split(',').map(id => id.trim()).filter(id => id);
        if (threadIds.length === 0) {
          spinner.warn('No valid thread IDs provided.');
          return;
        }

        spinner.text = `Fetching details for ${threadIds.length} thread(s)...`;
        for (const threadId of threadIds) {
          const threadDetails = await this.gmail.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'full',
          });

          let currentThreadContent = '';
          for (const message of threadDetails.data.messages) {
            const { text } = this.getEmailBody(message.payload);
            const from = this.getHeader(message.payload, 'From');
            currentThreadContent += `From: ${from}\n${text}\n\n`;
          }
          threadsData.push({
            id: threadId,
            content: currentThreadContent,
            details: threadDetails.data,
          });
        }
      }
      
      if (threadsData.length === 0) {
        spinner.succeed('No content to process.');
        return;
      }

      spinner.text = 'Constructing prompt for AI...';

      let prompt = `
        Based on the following previous email threads (if available), please draft a separate response for each of the current inputs provided below.
        Each response must be concise and helpful. If the input is from an email thread, maintain consistency with previous replies.

        You will be given one or more "Current Input" blocks, each with an ID (e.g., Current Input 1 (ID: actual_thread_id_or_generic_id)).
        For each of these inputs, you MUST generate a response.
        Each generated response MUST strictly follow this format, replacing 'ACTUAL_ID' with the specific ID of the input you are responding to:
        ===START_RESPONSE_FOR_ID_ACTUAL_ID===
        (Your response content for this input)
        ===END_RESPONSE_FOR_ID_ACTUAL_ID===

        It is critical that you use the exact delimiters and replace 'ACTUAL_ID' with the real ID (e.g., a thread ID or 'direct-input-0').
        Do NOT include any other text or explanations outside these delimited blocks for each response.

        Previous Threads (for context, if available):
`;
        prompt += cachedThreads.length > 0 ? JSON.stringify(cachedThreads, null, 2) : "No cached threads available for context.";
        prompt += `

`;


      threadsData.forEach((thread, index) => {
        prompt += `
        Current Input ${index + 1} (ID: ${thread.id}):
        --- Start of Content for Input ${thread.id} ---
        ${thread.content}
        --- End of Content for Input ${thread.id} ---
        `;
      });

      prompt += `
        Now, please provide the distinct responses for each "Current Input" listed above, ensuring each response is wrapped in the specified start/end delimiters with the correct ID.
      `;
      
      const generationConfig = {
        responseMimeType: 'text/plain',
      };
      const model = 'gemini-2.5-pro';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const responseStream = await this.genAI.models.generateContentStream({
        model,
        config: generationConfig,
        contents,
      });

      let fullResponse = '';
      spinner.text = 'Receiving AI response...';
      process.stdout.write(chalk.blue('\n--- AI Response Start ---\n'));
      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullResponse += chunkText;
          process.stdout.write(chalk.cyan(chunkText));
        }
      }
      process.stdout.write(chalk.blue('\n--- AI Response End ---\n'));
      spinner.succeed('Generated response complete.');
    } catch (error) {
      spinner.fail(`Error generating responses: ${error.message}`);
      throw error;
    }
  }
}

// CLI Setup
const program = new Command();
const cli = new GmailCLI();

program
  .name('gmail-cli')
  .description('A CLI tool for managing Gmail and Google Calendar')
  .version('1.0.0')
  .option('-p, --profile <name>', 'Specify the configuration profile to use', 'default');

// Email Commands
program
  .command('list')
  .description('List recent emails')
  .option('-m, --max-results <number>', 'Maximum number of emails to return', '10')
  .option('-q, --query <string>', 'Search query to filter emails')
  .action(async (options) => {
    const spinner = ora('Initializing Gmail CLI...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
  .option('-s, --sort <order>', 'Sort by date: "asc" or "desc"')
  .action(async (query, options) => {
    const spinner = ora('Searching emails...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      spinner.succeed('Connected to Gmail');
      await cli.searchEmails(query, { maxResults: parseInt(options.maxResults), sort: options.sort });
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
  .option('--reply-to <messageId>', 'The message ID to reply to')
  .action(async (to, subject, body, options) => {
    const spinner = ora('Sending email...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      const addLabels = options.addLabels ? options.addLabels.split(',').map(l => l.trim()) : [];
      const removeLabels = options.removeLabels ? options.removeLabels.split(',').map(l => l.trim()) : [];
      await cli.modifyEmail(messageId, addLabels, removeLabels);
      spinner.succeed('Email labels modified');
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('threads')
  .description('List and fetch email threads')
  .option('-q, --query <string>', 'Search query to filter threads')
  .option('-m, --max-results <number>', 'Maximum number of threads to return', '300')
  .option('-l, --last <duration>', 'Time duration to look back (e.g., 2w, 1d, 3m)', '2w')
  .action(async (options) => {
    const spinner = ora('Initializing...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      spinner.succeed('Connected to Gmail');
      await cli.listThreads({
        query: options.query,
        maxResults: parseInt(options.maxResults),
        last: options.last,
      });
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('refresh-cache')
  .description('Refresh the cache of previous email threads')
  .option('-m, --max-results <number>', 'Maximum number of threads to cache', '300')
  .action(async (options) => {
    const spinner = ora('Initializing...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      spinner.succeed('Connected to Gmail');
      await cli.refreshCache({
        maxResults: parseInt(options.maxResults),
      });
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('respond [threadIds]')
  .description('Generate a response using cached context and display it. Provide comma-separated thread IDs or use --text-input for direct text.')
  .option('--text-input <text>', 'Direct text input to generate a response for (use instead of threadIds for a single query)')
  .action(async (threadIds, options) => {
    const spinner = ora('Initializing...').start();
    try {
      if (threadIds && options.textInput) {
        spinner.fail('Error: Cannot use both threadIds and --text-input simultaneously. Please provide one or the other.');
        process.exit(1);
      }
      if (!threadIds && !options.textInput) {
        spinner.fail('Error: You must provide either threadIds or use the --text-input option.');
        process.exit(1);
      }

      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      spinner.succeed('Connected to Gmail');

      let inputData;
      if (options.textInput) {
        inputData = { textInput: options.textInput, isTextInput: true };
      } else {
        inputData = { threadIdsString: threadIds, isTextInput: false };
      }
      await cli.generateAndDisplayResponses(inputData, options);
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('forward <messageId> <to> [body]')
  .description('Forward an email with attachments')
  .option('--cc <emails>', 'CC recipients (comma-separated)')
  .option('--bcc <emails>', 'BCC recipients (comma-separated)')
  .action(async (messageId, to, body, options) => {
    const spinner = ora('Initializing...').start();
    try {
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
      spinner.succeed('Connected to Gmail');
      await cli.forwardEmail(messageId, to, body, options);
    } catch (error) {
      // The error is already logged in the forwardEmail method
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
      const globalOptions = program.opts();
      await cli.initialize(globalOptions.profile);
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
    console.log(chalk.white('The following variables must be set in a .env file in the config/ directory.'));
    console.log(chalk.white('By default, the tool uses `config/.env`.'));
    console.log(chalk.white('You can use multiple profiles by creating `config/.env.profilename` and using the --profile flag.'));
    console.log(chalk.yellow('\n  GOOGLE_CLIENT_ID=your_google_client_id'));
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
