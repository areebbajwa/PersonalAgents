#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';

// Environment variables required for OAuth
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('Required Google OAuth credentials not found in environment variables');
}

class GoogleWorkspaceServer {
  private server: Server;
  private auth;
  private gmail;
  private calendar;

  constructor() {
    this.server = new Server(
      {
        name: 'google-workspace-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    this.auth.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Initialize API clients
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_emails',
          description: 'List recent emails from Gmail inbox',
          inputSchema: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'number',
                description: 'Maximum number of emails to return (default: 10)',
              },
              query: {
                type: 'string',
                description: 'Search query to filter emails',
              },
            },
          },
        },
        {
          name: 'search_emails',
          description: 'Search emails with advanced query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Gmail search query (e.g., "from:example@gmail.com has:attachment")',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of emails to return (default: 10)',
              },
            },
            required: ['query']
          },
        },
        {
          name: 'send_email',
          description: 'Send a new email',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Recipient email address',
              },
              subject: {
                type: 'string',
                description: 'Email subject',
              },
              body: {
                type: 'string',
                description: 'Email body (can include HTML)',
              },
              cc: {
                type: 'string',
                description: 'CC recipients (comma-separated)',
              },
              bcc: {
                type: 'string',
                description: 'BCC recipients (comma-separated)',
              },
            },
            required: ['to', 'subject', 'body']
          },
        },
        {
          name: 'modify_email',
          description: 'Modify email labels (archive, trash, mark read/unread)',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Email ID',
              },
              addLabels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Labels to add',
              },
              removeLabels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Labels to remove',
              },
            },
            required: ['id']
          },
        },
        {
          name: 'list_events',
          description: 'List upcoming calendar events',
          inputSchema: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'number',
                description: 'Maximum number of events to return (default: 10)',
              },
              timeMin: {
                type: 'string',
                description: 'Start time in ISO format (default: now)',
              },
              timeMax: {
                type: 'string',
                description: 'End time in ISO format',
              },
            },
          },
        },
        {
          name: 'create_event',
          description: 'Create a new calendar event',
          inputSchema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'Event title',
              },
              location: {
                type: 'string',
                description: 'Event location',
              },
              description: {
                type: 'string',
                description: 'Event description',
              },
              start: {
                type: 'string',
                description: 'Start time in ISO format',
              },
              end: {
                type: 'string',
                description: 'End time in ISO format',
              },
              attendees: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of attendee email addresses',
              },
            },
            required: ['summary', 'start', 'end']
          },
        },
        {
          name: 'update_event',
          description: 'Update an existing calendar event',
          inputSchema: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'Event ID to update',
              },
              summary: {
                type: 'string',
                description: 'New event title',
              },
              location: {
                type: 'string',
                description: 'New event location',
              },
              description: {
                type: 'string',
                description: 'New event description',
              },
              start: {
                type: 'string',
                description: 'New start time in ISO format',
              },
              end: {
                type: 'string',
                description: 'New end time in ISO format',
              },
              attendees: {
                type: 'array',
                items: { type: 'string' },
                description: 'New list of attendee email addresses',
              },
            },
            required: ['eventId']
          },
        },
        {
          name: 'delete_event',
          description: 'Delete a calendar event',
          inputSchema: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'Event ID to delete',
              },
            },
            required: ['eventId']
          },
        },
        {
          name: 'get_email_content',
          description: 'Get the full content of an email, including body and attachment details.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the email to retrieve.',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'get_email_attachment',
          description: 'Get the base64 encoded content of an email attachment.',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: {
                type: 'string',
                description: 'The ID of the email message containing the attachment.',
              },
              attachmentId: {
                type: 'string',
                description: 'The ID of the attachment to retrieve.',
              },
            },
            required: ['messageId', 'attachmentId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'list_emails':
          return this.handleListEmails(request.params.arguments);
        case 'search_emails':
          return this.handleSearchEmails(request.params.arguments);
        case 'send_email':
          return this.handleSendEmail(request.params.arguments);
        case 'modify_email':
          return this.handleModifyEmail(request.params.arguments);
        case 'list_events':
          return this.handleListEvents(request.params.arguments);
        case 'create_event':
          return this.handleCreateEvent(request.params.arguments);
        case 'update_event':
          return this.handleUpdateEvent(request.params.arguments);
        case 'delete_event':
          return this.handleDeleteEvent(request.params.arguments);
        case 'get_email_content':
          return this.handleGetEmailContent(request.params.arguments);
        case 'get_email_attachment':
          return this.handleGetEmailAttachment(request.params.arguments);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${request.params.name} not found`);
      }
    });
  }

  private getHeader(payload: any, name: string) {
    const header = payload.headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  }

  private getEmailBody(payload: any): { text: string | null; html: string | null } {
    let textBody: string | null = null;
    let htmlBody: string | null = null;

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
          // Prefer HTML body if both are found in different parts, but concatenate text if multiple text parts
          if (htmlBody && partBody.html) break; // if we found html, we can stop for this multipart level
        }
      }
    }
    return { text: textBody, html: htmlBody };
  }

  private getAttachments(payload: any): any[] {
    const attachments: any[] = [];
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

  private async handleGetEmailContent(args: any) {
    if (!args || !args.id || typeof args.id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Email ID (id) is required and must be a string.');
    }
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: args.id,
        format: 'full', // 'full' includes headers, body, and attachments
      });

      const message = response.data;
      if (!message || !message.payload) {
        throw new McpError(ErrorCode.InternalError, 'Failed to retrieve email details or payload missing.');
      }

      const payload = message.payload;
      const subject = this.getHeader(payload, 'Subject');
      const from = this.getHeader(payload, 'From');
      const date = this.getHeader(payload, 'Date');
      const body = this.getEmailBody(payload);
      const attachments = this.getAttachments(payload);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: message.id,
            threadId: message.threadId,
            snippet: message.snippet,
            subject: subject,
            from: from,
            date: date,
            bodyText: body.text,
            bodyHtml: body.html,
            attachments: attachments,
            labels: message.labelIds,
          })
        }],
      };
    } catch (error: any) {
      console.error('Error fetching email content:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get email content: ${error.message || 'Unknown error'}`
      );
    }
  }

  private async handleGetEmailAttachment(args: any) {
    if (!args || !args.messageId || typeof args.messageId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Message ID (messageId) is required and must be a string.');
    }
    if (!args.attachmentId || typeof args.attachmentId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Attachment ID (attachmentId) is required and must be a string.');
    }

    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: args.messageId,
        id: args.attachmentId,
      });

      if (!response.data || !response.data.data) {
        throw new McpError(ErrorCode.InternalError, 'Failed to retrieve attachment data or data is missing.');
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            messageId: args.messageId,
            attachmentId: args.attachmentId,
            data: response.data.data,
            size: response.data.size,
          })
        }],
      };
    } catch (error: any) {
      console.error('Error fetching email attachment:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get email attachment: ${error.message || 'Unknown error'}`
      );
    }
  }

  private async handleListEmails(args: any) {
    try {
      const maxResults = args?.maxResults || 10;
      const query = args?.query || '';

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
      });

      const messages = response.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (msg) => {
          const detail = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
          });
          
          const headers = detail.data.payload?.headers;
          const subject = headers?.find((h) => h.name === 'Subject')?.value || '';
          const from = headers?.find((h) => h.name === 'From')?.value || '';
          const date = headers?.find((h) => h.name === 'Date')?.value || '';

          return {
            id: msg.id,
            subject,
            from,
            date,
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(emailDetails, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching emails: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSearchEmails(args: any) {
    try {
      const maxResults = args?.maxResults || 10;
      const query = args?.query || '';

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
      });

      const messages = response.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (msg) => {
          const detail = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
          });
          
          const headers = detail.data.payload?.headers;
          const subject = headers?.find((h) => h.name === 'Subject')?.value || '';
          const from = headers?.find((h) => h.name === 'From')?.value || '';
          const date = headers?.find((h) => h.name === 'Date')?.value || '';

          return {
            id: msg.id,
            subject,
            from,
            date,
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(emailDetails, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching emails: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSendEmail(args: any) {
    try {
      const { to, subject, body, cc, bcc } = args;

      // Create email content
      const message = [
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${subject}`,
        '',
        body,
      ].filter(Boolean).join('\r\n');

      // Encode the email
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Email sent successfully. Message ID: ${response.data.id}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending email: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleModifyEmail(args: any) {
    try {
      const { id, addLabels = [], removeLabels = [] } = args;

      const response = await this.gmail.users.messages.modify({
        userId: 'me',
        id,
        requestBody: {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Email modified successfully. Updated labels for message ID: ${response.data.id}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error modifying email: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCreateEvent(args: any) {
    try {
      const { summary, location, description, start, end, attendees = [] } = args;

      const event = {
        summary,
        location,
        description,
        start: {
          dateTime: start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees.map((email: string) => ({ email })),
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event created successfully. Event ID: ${response.data.id}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating event: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleUpdateEvent(args: any) {
    try {
      const { eventId, summary, location, description, start, end, attendees } = args;

      const event: any = {};
      if (summary) event.summary = summary;
      if (location) event.location = location;
      if (description) event.description = description;
      if (start) {
        event.start = {
          dateTime: start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      if (end) {
        event.end = {
          dateTime: end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      if (attendees) {
        event.attendees = attendees.map((email: string) => ({ email }));
      }

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event updated successfully. Event ID: ${response.data.id}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error updating event: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleDeleteEvent(args: any) {
    try {
      const { eventId } = args;

      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event deleted successfully. Event ID: ${eventId}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting event: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListEvents(args: any) {
    try {
      const maxResults = args?.maxResults || 10;
      const timeMin = args?.timeMin || new Date().toISOString();
      const timeMax = args?.timeMax;

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items?.map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        location: event.location,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching calendar events: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Workspace MCP server running on stdio');
  }
}

const server = new GoogleWorkspaceServer();
server.run().catch(console.error);
