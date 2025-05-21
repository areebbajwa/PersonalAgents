# Tax Preparation Carry-Forward Notes - Areeb Bajwa

**Last Updated:** 2025-05-22 (for the 2023 tax year simulation)

## Purpose
This document summarizes key information, decisions, and data points from the 2023 personal tax return preparation process for Areeb Bajwa. It is intended to assist with future tax return preparations by providing a quick reference to relevant details and methodologies.

## I. Personal Information (as of 2023 Tax Year)
*   **Full Name:** Areeb Bajwa
*   **SIN:** 529693855
*   **Date of Birth:** August 13, 1987
*   **Mailing Address (Dec 31, 2023):** 8175 first line nassagaweya, Campbellville ON L0P 1B0 Canada *(Note: Verify address annually)*
*   **Marital Status (Dec 31, 2023):** Married
    *   **Spouse's Full Name:** Nisha Ravindranath
    *   **Spouse's SIN:** PENDING_USER_INPUT for 2023 simulation. *(Action: Obtain and record for future filings if not already done).*
    *   **Spouse's 2023 Net Income:** Assumed $0.00 for 2023 spousal credit calculation. *(Action: Obtain actual net income annually for accurate calculations).*
*   **Dependents Claimed (2023):** None with net income.

## II. Key Income Information & Classifications (2023)
*   **Primary Personal Income Source:** Dividends from Mpyre Inc.
*   **Methodology for Dividends:** All funds withdrawn from Mpyre Inc. accounts (identified by `PrimaryCategory` = "MPYRE Software Inc.") and transferred to personal accounts (identified by `PrimaryCategory` = "Personal"), or any personal expenses paid directly using Mpyre Inc. funds, were classified as eligible dividends received by Areeb Bajwa.
*   **2023 Actual Eligible Dividend Amount (Mpyre Inc.):** $84,593.00
    *   Taxable Amount (after 38% gross-up): $116,738.34
*   **Other Potential Income (from 2023 analysis script based on AI categories, review annually):**
    *   The analysis script identified some transactions categorized by AI as 'Income: Employment Income', 'Income: Other Income', and 'Income: Other Investment Income'. For the 2023 simulation, the focus was on the Mpyre dividends as the primary declared income. These other categories should be reviewed annually to determine if they constitute taxable personal income, considering their `PrimaryCategory`.

## III. Key Deductions & Credits Claimed (2023 - Personal Only)
*Eligibility for these items was determined by filtering transactions where `PrimaryCategory` = "Personal" in the source data.*
*   **RRSP Contributions:** $0.00 (Confirmed by user for 2023).
*   **Professional Fees / Union Dues:** $0.00 (Confirmed by user for 2023).
*   **Child Care Expenses:** $401.15 (Paid to PEDALHEADS CANADA. Receipts confirmed available. This was manually included in the T1 summary as the script didn't initially pick it up under the 'Personal' filter for this specific expense category). *(Action: Ensure script logic or manual review covers this for future years if paid from accounts with `PrimaryCategory` = "Personal").*
*   **Tuition Fees:** $0.00 eligible claimed. (Various courses taken were deemed not eligible for T2202 post-secondary tuition credits).
*   **Investment Expenses / Carrying Charges (e.g., Margin Interest):** $0.00 claimed for 2023. (User indicated margin interest might exist but specific deductible amounts from personal investment activities were not identified/provided for the 2023 simulation). *(Action: Review annually if deductible investment expenses were incurred from accounts with `PrimaryCategory` = "Personal").*
*   **Medical Expenses:** $8,532.11 (Eligible amount $5,897.11 after threshold. Receipts confirmed available. Sourced from transactions with `PrimaryCategory` = "Personal").
*   **Donations:** $13,942.04 (Made from accounts with `PrimaryCategory` = "Personal". Receipts confirmed available).
*   **Employment Expenses (T2200):** $0.00 (Not applicable as no T4 employment).

## IV. Data Sources & Filtering Logic
*   **Primary Data Source:** Historically, a tagged transaction CSV (e.g., `tagged_transactions_for_analysis_2023.csv`, formerly in the now-removed `finances/data_exports/2023/` directory) was used. The primary source is now considered the `data/personal.db` database, and scripts should query this directly. The `PrimaryCategory` column in the database is crucial.
*   **Crucial Filtering Key for Account Ownership and Transaction Attribution:** The `PrimaryCategory` column in the transaction data (from `data/personal.db`) is the definitive source for determining if a transaction belongs to a "Personal", "MPYRE Software Inc.", or "Kalaam Foundation" context.
    *   **Personal Tax Claims:** Personal tax credits and deductions (donations, medical, child care, etc.) should *only* be claimed if the transaction's `PrimaryCategory` is "Personal".
    *   **Corporate/Foundation Transactions:** Transactions with `PrimaryCategory` "MPYRE Software Inc." or "Kalaam Foundation" are generally *not* for Areeb Bajwa's personal tax claims, unless they represent a clear financial benefit transferred to personal use (e.g., dividends from Mpyre Inc. as described in Section II).
*   **Analysis Script:** `scripts/analyze_tagged_tax_transactions.py` (or its future versions) is used to parse and summarize data, relying heavily on the `PrimaryCategory` field from the database.
*   **Supporting CSVs Generated (for CRA inquiries, 2023 examples - these were historical and their source directory `finances/data_exports/2023/` is removed):**
    *   `medical_expenses_for_cra_2023.csv` (contained only `PrimaryCategory` = "Personal" transactions)
    *   `donations_for_cra_2023.csv` (contained only `PrimaryCategory` = "Personal" transactions)

## V. Notes for Future Tax Cycles
*   **Spouse's Information:** Annually obtain and confirm spouse's SIN (if not yet on file) and Net Income for the tax year. This is critical for spousal credits and other potential benefits.
*   **Receipts:** Always ensure official tax receipts are available for all claimed expenses and donations.
*   **T-Slips:** Collect all T-slips (T4s, T5s, T3s, T4As, etc.) that may be issued.
*   **Data Integrity:** Annually review and confirm the accuracy of the `PrimaryCategory` assignments in the transaction data source. This is the cornerstone of correct attribution.
*   **AI Categorization Review:** Annually review the AI-driven transaction categorization (`ai_category`, `ai_tags`) in conjunction with `PrimaryCategory`.
*   **Mpyre Dividends:** Consistently apply the methodology for identifying Mpyre dividends (personal use of Mpyre Inc. funds, identified via `PrimaryCategory` shifts or Mpyre paying personal items). Document significant transactions.
*   **Business vs. Personal Distinction:** Maintain a clear distinction between personal expenses (`PrimaryCategory` = "Personal"), Mpyre Inc. business expenses (`PrimaryCategory` = "MPYRE Software Inc."), and Kalaam Foundation expenses (`PrimaryCategory` = "Kalaam Foundation").
*   **Child Care Expenses:** For 2023, these were identified by the user and manually factored in. Future script iterations or manual checks should confirm if these are captured correctly when filtering for `PrimaryCategory` = "Personal".
*   **Simulated 2023 Refund (for reference):** -$11,092.97.

## VI. Additional Notes from 2023 JSON Data
*   **Income Source 2023:** All personal funds derived from Mpyre/Margin accounts, to be classified as Dividend Income from Mpyre for 2023 tax year, as per user instruction on 2025-05-21.
*   **T-slips 2023:** User confirmed no T4, T5, or T4A for self for 2023. Income figures derived from reclassification of cash draws.
*   **RRSP 2023:** User confirmed no RRSP contributions for 2023.
*   **Professional Fees 2023:** User confirmed no professional fees/union dues for 2023.
*   **Employment Expenses 2023:** User confirmed no employer, T2200 not applicable for 2023.
*   **Tuition Fees 2023:** User confirmed no post-secondary tuition fees for 2023. Previously identified amounts for children's programs are not eligible for tuition credit.
*   **Margin Interest 2023:** User stated margin interest should be in transactions, but script did not identify specific margin interest transactions. Pending official statements or specific transaction details from user.
*   **Medical Receipts 2023:** User confirmed availability of receipts.
*   **Donation Receipts 2023:** User confirmed availability of receipts.
*   **Other Identified Income Notes (from JSON):**
    *   **Mariam Bajwa Income 2023:**
        *   Description: Employment income from AMAZON MSP deposited to Metropolis CAD Mariam Account (0184).
        *   Total Amount 2023: $3924.27
        *   Attribution: Attributed to Areeb Bajwa's sister, Mariam. Not considered for Areeb's or Nisha's 2023 T1.
        *   Transactions Identified:
            *   2023-12-08: $1280.47
            *   2023-10-27: $1219.84
            *   2023-12-22: $862.57
            *   2023-11-10: $561.39
    *   **Kalaam Foundation Income 2023:**
        *   Description: Various deposits (Stripe, transfers) to Kalaam Foundation accounts.
        *   Attribution: Considered income to the Kalaam Foundation, not personal income to Areeb Bajwa for T1 purposes.

This document should serve as a helpful starting point for future tax preparations. Remember to adapt to any changes in tax laws, personal circumstances, or data structures. 