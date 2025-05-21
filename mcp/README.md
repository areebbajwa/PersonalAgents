# MCP Server Setup Guide

This directory contains Model Context Protocol (MCP) servers used by the PersonalAgents project.
Below are instructions for setting up and configuring these servers.

## 1. Google Workspace MCP Server (`google-workspace-mcp-server`)

This server provides tools for interacting with Gmail and Google Calendar.

### Prerequisites

1.  **Node.js**: Ensure Node.js (version 14 or higher) is installed on your system.
2.  **Google Cloud Project**:
    *   You need a Google Cloud Project with the Gmail API and Google Calendar API enabled.
    *   You must have OAuth 2.0 credentials (a Client ID and Client Secret) configured for a "Web application".
    *   The "Authorized redirect URIs" for your OAuth 2.0 client ID **must** include `http://localhost:4100/code`.

### Setup Steps

1.  **Navigate to the Server Directory**:
    ```bash
    cd /path/to/your/PersonalAgents/mcp/google-workspace-mcp-server
    ```
    (Replace `/path/to/your/PersonalAgents/` with the actual absolute path to your project).

2.  **Install Dependencies**:
    If you haven't already, install the server's Node.js dependencies:
    ```bash
    npm install
    ```

3.  **Create `credentials.json`**:
    *   Inside the `mcp/google-workspace-mcp-server/` directory, create a file named `credentials.json`.
    *   This file **will not and should not** be committed to Git (it's covered by `.gitignore`).
    *   Its content should be:
        ```json
        {
            "web": {
                "client_id": "YOUR_GOOGLE_CLIENT_ID",
                "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
                "redirect_uris": ["http://localhost:4100/code"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        }
        ```
    *   Replace `YOUR_GOOGLE_CLIENT_ID` and `YOUR_GOOGLE_CLIENT_SECRET` with your actual credentials from the Google Cloud Console.

4.  **Generate `token.json` (Get Refresh Token)**:
    *   While still in the `mcp/google-workspace-mcp-server/` directory, run the following command:
        ```bash
        node get-refresh-token.js
        ```
    *   This will open a browser window, prompting you to log in with your Google account and authorize the application.
    *   After successful authorization, a `token.json` file will be created in the `mcp/google-workspace-mcp-server/` directory, and your **Refresh Token** will be printed to the console.
    *   The `token.json` file **will not and should not** be committed to Git.
    *   **Copy the Refresh Token** displayed in the console. You will need it for the main project `mcp.json` configuration.

5.  **Build the Server**:
    Run the build command to compile the TypeScript source:
    ```bash
    npm run build
    ```
    This creates a `build/index.js` file.

6.  **Configure in Project `mcp.json`**:
    *   Open the main MCP configuration file for this project, located at `/path/to/your/PersonalAgents/mcp.json`.
    *   Ensure the `google-workspace` server entry is configured correctly. It should look like this:
        ```json
        {
          "mcpServers": {
            "google-workspace": {
              "command": "node",
              "args": ["/path/to/your/PersonalAgents/mcp/google-workspace-mcp-server/build/index.js"],
              "env": {
                "GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID",
                "GOOGLE_CLIENT_SECRET": "YOUR_GOOGLE_CLIENT_SECRET",
                "GOOGLE_REFRESH_TOKEN": "YOUR_COPIED_REFRESH_TOKEN"
              }
            }
            // ... other servers
          }
        }
        ```
    *   **Crucially**:
        *   Update the `args` path to the **correct absolute path** of `index.js` on your current machine.
        *   Replace `YOUR_GOOGLE_CLIENT_ID` and `YOUR_GOOGLE_CLIENT_SECRET` with the same values you used in `credentials.json`.
        *   Replace `YOUR_COPIED_REFRESH_TOKEN` with the refresh token you obtained in step 4.
    *   The project `mcp.json` *is* intended to be committed to Git, but the actual secrets are passed as environment variables via this configuration, and the token/credential files themselves remain local and uncommitted.

### Important Notes on Portability

*   When you clone this project (`PersonalAgents`) to a new machine, you will need to repeat steps 1-5 for the `google-workspace-mcp-server` to set up its local dependencies and generate new `credentials.json` and `token.json` files (as tokens are often machine/environment specific).
*   You will then need to update the absolute path in the `args` and the `GOOGLE_REFRESH_TOKEN` (and potentially client ID/secret if they differ) in your main project `PersonalAgents/mcp.json` (step 6) to match the new machine's setup.

---

*You can add setup instructions for other MCP servers here as you integrate them.* 