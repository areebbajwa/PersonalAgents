# Tax Preparation 2023 - TODO List

## 1. Data Acquisition
- [x] 1.1 ~~Download all 2023 CRA Auto-fill slips (CRA Website)~~ (Slips available if needed for manual entry, AFR via Wealthsimple failed)
- [x] 1.2 Extract 2023 transaction data from local database (`transactions` table, for year 2023) into an in-memory structure.

## 2. Wealthsimple Tax - Initial Setup
- [x] 2.1 Access Wealthsimple Tax and start/open 2023 Tax Return.
    *   *Note: CRA Auto-fill (AFR) via Wealthsimple Tax failed. Proceeding with manual data entry.*

## 3. Transaction Data Categorization & Preparation (using AI)
- [x] 3.1 Process a 1–3 row sample of extracted 2023 transactions through Gemini for categorization (with cache verification).
- [x] 3.2 Upon successful sample, categorize all remaining 2023 transactions in parallel.
- [x] 3.3 Prepare categorized transaction data for input into Wealthsimple Tax.

## 4. Wealthsimple Tax - Data Input & Finalization
- [-] 4.1 Manually input/Import categorized transaction summaries (from step 3.3) into Wealthsimple Tax. **<- CURRENTLY IN PROGRESS**
    - [x] 4.1.1 Generate Markdown report of all 'Personal' 2023 transactions grouped by `ai_category` (with totals).
- [ ] 4.2 Manually input any other required financial data. **User to contact bank for details on the following transactions, and provide information for any other relevant transfers/large transactions:**
    *   **Suspected Wire Transfers (request full details as per below list if confirmed as international):**
        *   `2023-03-31, Description: "230331S2679300WIRE", Amount: 94000.68`
        *   `2023-05-18, Description: "230518S5073900WIRE", Amount: 3433.76`
    *   **General Wire Transfer Details to Request (if applicable):**
        *   Date of transfer
        *   Sender's full name and address
        *   Recipient's full name and address
        *   Sending bank name and branch
        *   Receiving bank name and branch
        *   Amount and currency of the transfer
        *   Purpose of the transfer (if documented)
        *   Any associated bank fees
    *   **Other Significant Transactions to Discuss with Bank (if not already clear):** Review the generated Markdown report for numerous e-transfers and internal account transfers. Discuss with your bank if any of these have tax implications or require special reporting (e.g., if they are not simply movements between your own accounts or gifts).
- [ ] 4.3 Perform Wealthsimple Tax review & optimization steps.
- [ ] 4.4 Validate the complete tax return within Wealthsimple Tax.
- [ ] 4.5 Submit the 2023 T1 tax return via NETFILE through Wealthsimple Tax.
- [ ] 4.6 Confirm CRA receipt/acceptance.

## 5. Archival & Post-Filing
- [ ] 5.1 Download and save the final submitted T1 return (PDF/TAX file) from Wealthsimple Tax.
- [ ] 5.2 Download and save the Notice of Assessment (NOA) once available from CRA.
- [ ] 5.3 Store all relevant documents (slips, working files, submitted return, NOA) in `finances/tax_returns/2023/`.
- [ ] 5.4 Monitor for any post-submission communications from CRA.

---
*Tasks dependent on information to be provided by the user (e.g., from bank for wire transfers): Primarily Step 4.2.*
*This list has been revised. Progress based on recent execution summary.* 