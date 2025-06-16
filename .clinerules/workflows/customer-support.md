# Customer Support Workflow Rules

1.  **Fetch all previous support threads:** Before taking any action, always fetch and review ALL previous support threads (not just those from the current sender) using `cli_tools/gmail-cli/gmail-cli threads --profile support`. This must be done first, as it impacts all subsequent actions.

2.  **Fetch all unread emails:** At the beginning of the session, use the `gmail-cli` `search` command with the query `'is:unread after:YYYY/MM/DD -from:dmarcreport@microsoft.com -from:noreply-dmarc-support@google.com -from:noreply@dmarc.yahoo.com -from:noreply-dmarc@zoho.com -from:dmarcreports@secureserver.net -from:notifications@stripe.com'` and the `--sort asc` option to fetch all unread emails, sorted by date ascending. Use a high `--max-results` value (e.g., 100) to ensure all unread emails within the desired timeframe are fetched. Restrict to unread emailslast 2 weeks.

3.  **Process emails one by one, oldest first.**
    *   **For any issues related to data inaccuracy (e.g., incorrect translations, definitions), forward the email with attachments to Raghda (`r_khalifa@msn.com`) instead of creating a ticket.**
    *   **You must respond to every email and every Discourse ticket, regardless of what other actions you take.**
    *   **If an email has attachments, always download all attachments when processing the email.** Use the `attachment` command as described below for each attachment in the email.
    *   **If there are multiple unread emails from the same sender, show them as one thread and respond only to the most recent thread from that sender.**
    *   **Never proceed to the next email or Discourse topic without responding to the current one.**  
        For each email or topic, let me choose one of the following actions before moving on:
        - **Respond:** Draft and (after approval) send a reply.
        - **Push to Last:** Move this email/topic to the end of the queue to revisit after all others.
        - **Skip:** Mark the email as unread (using `cli_tools/gmail-cli/gmail-cli modify <messageId> --add-labels UNREAD --profile support`) or leave the Discourse topic unread, and move on to the next.

4.  **Handle different email types:**
    *   **DMARC/Automated Reports:** These can be ignored.
    *   **Support Requests:**
        *   Fetch the full thread content for the specific request using the `content` command with the message ID of the email (e.g., `cli_tools/gmail-cli/gmail-cli content <messageId> --profile support`). Always show the email you are responding to.
        *   If the email is not in English, it must be translated before drafting a response. The response should be in the user's original language.
        *   Draft a response to address the user's query, consistent with previous interactions.
        *   **CRITICAL: Always ask for approval before sending any email.** Use the `ask_followup_question` tool to present the draft and get confirmation.
        *   Once the draft is approved, send the email using the `send` command with the `--reply-to` option to ensure it is part of the correct thread.
        *   The `gmail-cli` tool is configured to automatically mark the thread as read after a reply is sent.

5.  **Drafting Responses:** Do not use a separate file for drafts. Present the draft directly within the `ask_followup_question` tool for approval.

6.  **Handling Streak Fix Requests:**
    *   To fix a user's streak, you need to make a POST request to the following API endpoint using terminal: `https://api-xjoi66infa-uc.a.run.app/streak/fix-latest-gap`
    *   The request body must be a JSON object with the following format:
        ```json
        {
          "email": "user-email@example.com",
          "forceVIP": true
        }
        ```
    *   **CRITICAL: Always ask for approval before performing this action.**

7.  **Handling Attachments:**
    *   To download an attachment, use the `attachment` command with the message ID and attachment ID.
    *   Use the `-f` or `--filename` option to specify the output path and filename (e.g., `cli_tools/gmail-cli/gmail-cli attachment <messageId> <attachmentId> -f output/attachment.png`).
    *   **If an email contains multiple attachments, repeat this process for each attachment.**

8.  **Learnings & Best Practices**
    *   **Verify Command Syntax:** Before executing a command, especially for a new or unfamiliar tool, verify the syntax by reading the documentation or using the `--help` flag. For example, the `gmail-cli send` command uses positional arguments (`<to> <subject> <body>`), not flags. To mark an email as read, use `cli_tools/gmail-cli/gmail-cli modify <messageId> --remove-labels UNREAD --profile support`.
    *   **Confirm Destructive Actions:** Always seek explicit confirmation from the user before performing irreversible actions, such as deleting an account. This prevents accidental data loss.

9.  **Handling Discourse Forum Topics**
    *   After processing all emails, use the browser to navigate to the Discourse forum at [https://discussion.kalaamapp.com](https://discussion.kalaamapp.com).
    *   First, collect the URLs of all topics and messages that require attention. Systematically check the following sections:
        - **New:** Review all new topics and collect their URLs.
        - **Latest:** On the "Latest" page, collect the URLs of all the topics since the last visit.
        - **Unread:** Go through all unread topics and posts and collect their URLs.
    *   Once all URLs are collected, process them one by one by navigating to each URL directly.
    *   For each topic or message, assess if a reply is needed. A reply is generally required if it has not received a satisfactory response from Raghda, Salah, Jahanzaib, or Areeb.
    *   Draft a response to address the user's query.
    *   **CRITICAL: Always ask for approval before posting any reply on the forum or in a direct message. Every topic that deserves a response should get one before moving on**

10. **User Management**
    *   Use `firebase mcp` for all user management tasks.

11. **Codebase & Ticket Management**
    * **Ticket Creation:**
        *   **When creating a ticket based on an email/Discourse topic, forward the original email (with attachments) to the assigned person (e.g., `jahanzaib@kalaamapp.com` or `salah@kalaamapp.com`) and mention in the ticket description that the email has been forwarded.**
        * **CRITICAL: Always ask for approval before creating a ticket.**
        * Tickets are always assigned to either **Salah** or **Jahanzaib**.
        * The default priority for new tickets is **Normal-High**.
        * When creating a ticket based on an email/Discourse topic:
            - Forward the email to the assigned person.
            - Include the details of the email/topic in the ticket description.
        * To create a ticket, make a POST request to the CodebaseHQ API. The required credentials are in the `config/.env` file.
        * ```bash
          source config/.env
          curl -X POST -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" \
          -H "Content-Type: application/xml" \
          -H "Accept: application/xml" \
          -d '<ticket><summary>Your Ticket Summary</summary><ticket-type>Your Ticket Type</ticket-type><description><![CDATA[Your ticket description here, including email/topic details.]]></description></ticket>' \
          https://api3.codebasehq.com/kalaam/tickets
          ```
    *   **Getting Ticket Info:**
        *   Get ticket statuses:
            ```bash
            source config/.env
            curl -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" https://api3.codebasehq.com/kalaam/tickets/statuses
            ```
        *   Get ticket priorities:
            ```bash
            source config/.env
            curl -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" https://api3.codebasehq.com/kalaam/tickets/priorities
            ```
        *   Get project users:
            ```bash
            source config/.env
            curl -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" https://api3.codebasehq.com/kalaam/assignments
            ```
            *   **Jahanzaib Ramzan:** ID `810661`
            *   **Salah Eddine Hm:** ID `812745`
            *   **Areeb:** ID `15403`
        *   Default Priorities:
            *   **Critical:** ID `9435665`
            *   **High:** ID `9435667`
            *   **Normal-High:** ID `9435669`
            *   **Normal:** ID `9435671`
            *   **Normal-Low:** ID `9435673`
            *   **Low:** ID `9435675`
            *   **Very Low:** ID `9435677`
    *   **Forwarding to Assignee:**
        *   **CRITICAL: Always ask for approval before forwarding an email.**
        *   This action is not yet supported by a direct API call. Please forward emails manually from your email client.
        *   **Special Rule:** When asked to forward something to **Raghda**, forward it (with attachments) to `r_khalifa@msn.com` **without adding any comment**.
    *   **Uploading Attachments:**
        *   Uploading an attachment and creating a ticket is a two-step process. First, you upload the file to get an upload token, and then you include that token when creating the ticket.
        *   **Step 1: Upload the file to get a token**
            ```bash
            source config/.env
            curl -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" \
            -F "files[]=@/path/to/your/file.png" \
            https://api3.codebasehq.com/uploads.xml
            ```
            The XML response will contain an `<identifier>` for the uploaded file. Make a note of this token.
        *   **Step 2: Create the ticket with the attachment**
            Use the upload token from the previous step in the `<upload-tokens>` array.
            ```bash
            source config/.env
            curl -X POST -u "$CODEBASEHQ_API_USERNAME:$CODEBASEHQ_API_KEY" \
            -H "Content-Type: application/xml" \
            -H "Accept: application/xml" \
            -d '<ticket>
                  <summary>Your Ticket Summary</summary>
                  <ticket-type>Your Ticket Type</ticket-type>
                  <description><![CDATA[Your ticket description here.]]></description>
                  <upload-tokens type="array">
                    <upload-token>IDENTIFIER_FROM_UPLOAD</upload-token>
                  </upload-tokens>
                </ticket>' \
            https://api3.codebasehq.com/kalaam/tickets
            ```

12. **Other Actions**
    *   **Copying User Accounts:**
        *   **CRITICAL: Always ask for approval before performing this action.**
        *   To copy a user's account, you need to make a GET request to a Google Cloud Function. The required API key is in the `config/.env` file.
        *   ```bash
          source config/.env
          curl -H "x-api-key: $COPY_USER_ACCOUNT_API_KEY" "https://us-central1-kalaam-25610.cloudfunctions.net/copyUserAccountData?targetuid=<target-uid>"
        ```

13. **Forwarding Emails with Attachments**
    *   To forward an email, including its attachments, use the `forward` command.
    *   **Syntax:** `gmail-cli forward <messageId> <to> [body] --cc <emails> --bcc <emails>`
    *   **Example:** `gmail-cli forward 1234567890abcdef user@example.com "FYI" --profile support`
    *   This command will forward the specified email to the recipient, including all original attachments and an optional body.

14. **Expressing Appreciation:**
    *   When a user expresses appreciation, like the post/email.
