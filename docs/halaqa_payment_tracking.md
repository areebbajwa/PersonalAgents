# Halaqa Payment Tracking

## Overview
Payments to Numaan Attique who leads the Tuesday halaqa sessions.

## Quick Reference
- **Payment Amount**: $150 per session
- **Recipient**: Numaan Attique
- **Google Sheet ID**: `1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4`
- **Sheet Tab**: "Transfers" (not the full spreadsheet title)
- **Service Account**: `firebase-adminsdk-lod63@kalaam-25610.iam.gserviceaccount.com` (must be added as Editor to sheet)

## Critical Payment Details
- **AMOUNTS ARE NEGATIVE**: Payments going out must be negative numbers (e.g., -750 not 750)
- **Payment Name Format**: Use "Transfer to Sh Numaan" (not "Numaan Attique")
- **Sessions are on Tuesdays**: Count only Tuesday sessions when calculating payment

## Process
1. Use Browser MCP to navigate to WhatsApp Web
2. Check messages from Numaan Attique for payment reminders
   - Common message: "Also I'm not sure if you were about to send last months honorarium"
   - **IMPORTANT**: Check conversation history to see which sessions Numaan missed (e.g., "In Ottawa for tomorrow")
3. Check last payment in sheet:
   ```bash
   cd /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/google-sheets-cli
   
   # Check all transfers to Numaan (shows dates and amounts)
   python3 sheets-cli.py read "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4" "Transfers!A:C" --filter-column "Name" --filter-value "Transfer to" --json | grep -B1 -A1 "Numaan"
   ```
4. Calculate payment amount:
   - Count Tuesday sessions since last payment
   - Exclude sessions where Numaan said he couldn't make it
   - Multiply sessions × $150
5. Add new payment entry:
   ```bash
   # Create payment data with NEGATIVE amount
   echo '[["18/06/2025", "Transfer to Sh Numaan", "-750"]]' > payment.json
   
   # Append to sheet
   python3 sheets-cli.py append "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4" "Transfers!A:C" --json-file payment.json
   
   # Verify it was added
   python3 sheets-cli.py read "1JGrI2UhV5n0IiV94NeBvbAHNFMg4bGraZtXjHlJT3s4" "Transfers!A183:C186"
   ```

## Example Calculation
Last payment: May 6, 2025 (-$600)
Sessions to count:
- May: 13, 20, 27 (3 sessions)
- June: 10, 17 (2 sessions) - skipped June 3 as Numaan was in Ottawa
Total: 5 sessions × $150 = $750 → Enter as "-750"

## Key Information
- Always use JSON files for data to avoid shell escaping issues with "!"
- The sheet requires service account access for CLI operations
- Check WhatsApp history carefully to exclude sessions Numaan missed

## Email Money Transfer (EMT) Process
- **TD EasyWeb Automation Blocked**: Browser automation tools (Browser MCP) cannot automate TD EasyWeb due to security measures
- **MCP JS Bridge Not Available**: Attempted but no connection to companion extension
- **Manual Process Required**: EMT must be sent manually through TD EasyWeb
- **TD Credentials Location**: Available in `data/Google Passwords.csv`
  - Access Card: 4724090919663060
  - Look for authentication.td.com entries
- **Alternative**: Consider setting up recurring e-transfers or using TD mobile app for easier access

## Common Mistakes to Avoid
1. **DO NOT use positive amounts** - All outgoing payments must be negative (e.g., -750 not 750)
2. **DO NOT use "Numaan Attique"** - Use "Transfer to Sh Numaan" format in Google Sheet
3. **DO NOT count sessions when Numaan is away** - Check WhatsApp for "In Ottawa" or similar messages
4. **DO NOT create multiple documentation files** - Update this file with new learnings
5. **DO NOT attempt browser automation for TD** - It will fail due to security restrictions