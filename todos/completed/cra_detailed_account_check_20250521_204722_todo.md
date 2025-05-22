# TODO for Detailed CRA Account Check (cra_detailed_account_check_20250521_204722)

## A. My Business Account (Mpyre Software Inc.)

- [X] **Corporate Income Tax (RC0001)**
    - [X] Navigate to RC0001 "View and pay account balance" / "Transactions".
        - Notes: Navigated to "Account transactions – selection criteria" page. Default filters (All periods, seven years, Interim balance and balance) showed 30 transactions.
    - [ ] Download or copy "Transactions" history.
        - Notes: Transaction list for RC0001 (all periods, 7 years) is visible on screen. Contains 30 items. An "Export to CSV" option is available (ref `s7e508`). Key transactions noted:
            - 2014-12-31 period has a $11,920.00 CR balance due to a $12,043.00 CR "Carry Back" and a $123.00 debit "Trsf. to 807356423RP0001".
            - 2017, 2018, 2019 period ends all show $0.00 balance.
    - [X] Check for any penalty assessments (T2 late-filing, T5 late-slip noted here if found, though T5s are RZ).
        - Notes: No transactions explicitly labelled "penalty" found in the RC0001 transaction list for the last 7 years. Given outstanding T2 returns for 2020-2023, penalties are expected but not yet itemized here.
    - [X] Check for any interest charges.
        - Notes: No transactions explicitly labelled "interest" found in the RC0001 transaction list for the last 7 years. Similar to penalties, interest would be expected for late T2s but is not yet itemized.

- [X] **Information Returns (RZ0001)**
    - [X] Navigate to RZ0001 account details.
        - Notes: Navigated to RZ0001 Overview. Showed "Outstanding returns: No" and "You have no filed returns." Also checked "Notifications of errors" tab, which showed no incomplete records.
    - [X] Confirm if T5 penalties or warning letters are shown.
        - Notes: Navigated to RZ0001 "Account transactions – selection criteria". Attempted to view transactions for "Balance", "All periods", "seven years". Page returned a warning "VAT004 - ...our records indicate there are no accounting transactions for the criteria selected." This implies no T5 penalties or specific warning transactions are recorded on the RZ0001 account itself. This is consistent with "no filed returns" status.

- [X] **Mail Inbox (MPYRE SOFTWARE INC.)**
    - [X] Systematically review mail items (starting with unread, then older if necessary) for titles containing:
        - "Failure to file T2 return"
        - "Notice of Assessment – Penalty for late T5 return"
        - "Gross negligence penalty"
    - [X] Document findings for each relevant mail item.
        - Notes:
            - Reviewed mail for years 2024, 2023, 2022, 2021, 2020, 2019.
            - **"Failure to file T2 return" (as "Demand to file your corporation's income tax return"):**
                - 2024-03-05 (Unread)
                - 2023-03-07 (Unread)
                - 2022-06-21 (Unread)
            - **"Notice of Assessment – Penalty for late T5 return":** Not found in these years.
            - **"Gross negligence penalty":** Not found in these years.
            - Other mail items not matching these specific titles were observed but not detailed here as per user request focus.

## B. CRA My Account (Personal)

- [X] **Navigate to Personal CRA My Account**
    - Notes: User confirmed they are logged into their personal CRA account. Navigated to "Statement of account" selection page.
- [X] **Accounts and Payments → Statement of Account**
    - [X] Check for any interest still showing from prior years.
        - Notes: User displayed Income Tax Statement of Account. Transactions from July 2024 to March 2025 viewed.
            - "Arrears interest charged" on July 16, 2024: $788.63 and $20.00.
            - "Arrears interest charged" on March 19, 2025: $831.81.
            - These amounts, along with other charges (Federal Tax, Late-filing penalty, 2023 TFSA Assessment related amounts), were paid by March 20, 2025.
            - Current Income Tax Statement of Account balance is $0.00 as of March 20, 2025. No interest is currently outstanding from these prior charges.
    - [X] **TFSA Section**
    - [ ] Check amount of excess contribution.
        - Notes: Navigated to "Savings and pension plans", then to "Tax-Free Savings Account (TFSA)" page. Page displayed error: "This service is not available at this time. Please try again later." (ref `s30e115`). Unable to view TFSA details, excess contributions, penalties, or payment status.
    - [ ] Check dates and penalties charged for TFSA over-contribution.
        - Notes: Unable to retrieve due to TFSA service error.
    - [ ] Check whether TFSA penalties were paid or still outstanding.
        - Notes: Unable to retrieve due to TFSA service error. The Income Tax Statement of Account did show a "2023 TFSA Assessment" (ref `s27e182`) and related charges (Federal Tax $4,831.36, Late-filing penalty $241.57, Arrears interest) on July 16, 2024, which were subsequently paid off by March 20, 2025. This suggests a TFSA-related issue was assessed and resolved via the income tax account, but specific TFSA account details are currently inaccessible.

- [X] **Summarize all findings from Part A and Part B.**
    - Notes: 
        **Summary of Detailed CRA Account Check (cra_detailed_account_check_20250521_204722):**

        **A. My Business Account (Mpyre Software Inc. - BN 807356423)**

        1.  **Corporate Income Tax (RC0001):**
            *   **Transactions:** Viewed for the last 7 years.
                *   A significant credit balance of **$11,920.00 CR** exists for the 2014-12-31 period end, mainly due to a "Carry Back."
                *   Period ends for 2017, 2018, and 2019 all show $0.00 balances.
                *   Outstanding T2 returns for 2020, 2021, 2022, and 2023 were previously noted (in `mpyre_cra_overdue_check_20250521_201711_todo.md`).
            *   **Penalty Assessments (T2 late-filing, T5):** No transactions explicitly labelled "penalty" found in the RC0001 transaction list for the last 7 years. Penalties for outstanding T2s (2020-2023) are anticipated but not yet itemized on the account. T5 penalties would typically be on RZ account.
            *   **Interest Charges:** No transactions explicitly labelled "interest" found in the RC0001 transaction list for the last 7 years. Interest for outstanding T2s is anticipated but not yet itemized.

        2.  **Information Returns (RZ0001):**
            *   **Account Status:** Overview shows "Outstanding returns: No" and "You have no filed returns." The "Notifications of errors" tab also showed no incomplete records.
            *   **T5 Penalties/Warning Letters on Account:** Attempting to view account transactions resulted in a "VAT004 - no accounting transactions for the criteria selected" warning. This means no T5 penalties or specific warning *transactions* are recorded on the RZ0001 account itself. This is consistent with the "no filed returns" status.

        3.  **Mail Inbox (MPYRE SOFTWARE INC.):**
            *   Reviewed mail for years 2019 through 2024.
            *   **"Failure to file T2 return" (appeared as "Demand to file your corporation's income tax return"):**
                *   2024-03-05 (Unread)
                *   2023-03-07 (Unread)
                *   2022-06-21 (Unread)
            *   **"Notice of Assessment – Penalty for late T5 return":** Not found in these years.
            *   **"Gross negligence penalty":** Not found in these years.

        **B. CRA My Account (Personal - AREEB BAJWA)**

        1.  **Accounts and Payments → Statement of Account (Income Tax):**
            *   **Interest from prior years:**
                *   Significant "Arrears interest charged" amounts were noted on July 16, 2024 ($788.63 + $20.00) and March 19, 2025 ($831.81).
                *   These, along with other charges (Federal Tax, Late-filing penalty, and amounts related to a "2023 TFSA Assessment"), were fully paid by March 20, 2025.
                *   The **current Income Tax Statement of Account balance is $0.00** as of March 20, 2025. No interest is currently outstanding from these prior charges.

        2.  **TFSA Section:**
            *   **Service Unavailability:** The TFSA details section of CRA My Account displayed an error: "This service is not available at this time. Please try again later."
            *   **Excess Contribution:** Unable to determine.
            *   **Dates and Penalties Charged:** Unable to determine directly from TFSA section.
            *   **Payment Status of Penalties:** Unable to determine directly from TFSA section.
            *   **Note:** The Income Tax Statement of Account showed a "2023 TFSA Assessment" and related charges (Federal Tax $4,831.36, Late-filing penalty $241.57, Arrears interest) were assessed on July 16, 2024, and subsequently paid off via the income tax account by March 20, 2025. This indicates a TFSA-related issue was likely resolved, but specific TFSA account details remain inaccessible through the online portal at this time. 