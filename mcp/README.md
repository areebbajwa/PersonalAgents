# MCP Server Setup Guide

This directory contains Model Context Protocol (MCP) servers used by the PersonalAgents project.
Below are instructions for setting up and configuring these servers.

## Gmail and Google Calendar Integration

**Note**: The Google Workspace functionality has been converted from an MCP server to a standalone CLI tool. Use the Gmail CLI tool instead:

```bash
cd cli_tools/gmail-cli
./gmail-cli --help
```

The Gmail CLI provides all the same functionality as the previous MCP server:
- Email listing, searching, sending, and content retrieval
- Email attachment downloads
- Calendar event management
- Uses the same OAuth2 credentials stored in `config/.env`

For setup instructions, run: `./gmail-cli env-help`

---

*You can add setup instructions for other MCP servers here as you integrate them.* 