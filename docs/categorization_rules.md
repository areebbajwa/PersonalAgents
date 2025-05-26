# Financial Transaction Categorization Rules (v3 - January 28, 2025)

This document summarizes the refined logic for assigning a `PrimaryCategory` to financial transactions based on analysis of TD EasyWeb accounts and user clarifications. This logic aims to correctly separate transactions for Personal use, MPYRE Software Inc., Kalaam Foundation, Metropolis, and AutoOptimize Inc.

**Important:** Before applying the rules in this document, always refer to the `spending_overrides.json` file which contains specific transaction description fragments and their corresponding categories. These manual overrides take precedence over the general rules outlined below.

**Entities:**

*   **Personal:** Transactions belonging to Areeb or Mariam personally, or shared family expenses.
*   **MPYRE Software Inc.:** Operating business. BN: 807356423
*   **Kalaam Foundation:** Registered non-profit entity.
*   **Metropolis:** Business entity (Metropolis Global Corp.).
*   **AutoOptimize Inc.:** Business entity. BN: 740161336

**Categorization Hierarchy (Applied in this order):**

1.  **CRITICAL: Exclude Non-Transaction Accounting Entries:**
    *   **Balance Forward:** Description contains `BALANCE FORWARD`, `Balance Forward`, `BAL FWD`, `OPENING BALANCE` - These are **EXCLUDED** from financial statements as they are accounting carry-forwards, not income or expenses.
    *   **NSF Returns:** Description contains `RTN NSF`, `RETURN NSF`, `NSF RTN`, `RETURNED NSF` - These are **EXCLUDED** from financial statements as they are corrections/reversals of bounced payments, not income.
    *   **Internal Accounting:** Description contains `JOURNAL ENTRY`, `ADJUSTMENT`, `RECONCILIATION` - These are **EXCLUDED** as internal accounting adjustments.
    *   **Action:** Mark these transactions with category `EXCLUDED_ACCOUNTING` and do not include in revenue or expense calculations.

2.  **Manual Overrides (`spending_overrides.json`):**
    *   If a transaction description contains a `fragment` listed in `spending_overrides.json`, the transaction is assigned the `category` specified in that file.
    *   **Important:** The `spending_overrides.json` file contains explicit text fragments that should be checked first for any transaction. Review this file regularly to see the current override rules. The file contains entries in the format: `{"fragment": "TEXT_TO_MATCH", "category": "ASSIGNED_CATEGORY"}`.
    *   **Note:** This file is checked second (after accounting exclusions). Existing rules might use the old "Kalaam" category, which may need future review to be updated to "Kalaam Foundation" or "MPYRE Software Inc." as appropriate for specific fragments.
    *   **(Correction):** The script will apply the category exactly as specified in `spending_overrides.json`. If an override specifies `"category": "Kalaam"`, that category will be assigned by the override. The user needs to update this file manually if those overrides should now point to `"Kalaam Foundation"` or `"MPYRE Software Inc."`.

3.  **Specific Description Keywords (Hardcoded):**
    *   Description contains `WPS BILLING`: Assign **MPYRE Software Inc.** (Wire transfer fees for Mpyre)
    *   Description contains `PAYPAL MSP`: Assign **MPYRE Software Inc.**
    *   Description contains `PENNYAPPEAL CANADA`, `ALLSTATE`, `HWY407 ETR BPY`: Assign **Personal**.
    *   Description contains `RPW` (typically indicates a wire transfer): Assign **Metropolis**.

4.  **General Cloud Service Keyword:**
    *   Description contains `CLOUD`: Assign **Kalaam Foundation**.

5.  **Description Keywords for Specific Entities:**
    *   **Kalaam Foundation:** Description contains `KALAAM`, `UPWORK`, `PURRWEB`, `OPENAI`, `ANAS`, `FIREBASE`, `VIMEO`, `JAHANZAIB`, `ISHAAQ`, `FRAMER`, `ANTHROPIC`, `MADINAH GIVE CO` (both incoming donations and outgoing expenses).

6.  **Account Name / Identifier Matching:**
    *   **Kalaam Foundation:**
        *   Account Name contains: `COMMUNITY PLAN`, `BUSINESS INVESTOR ACCOUNT`, `Kalaam Donations`, `TD BASIC BUSINESS PLAN`.
        *   *(Account number endings inferred from TD data: `4162`, `4952`, `3538`, `2695`, `1389`, `2065`)*
    *   **MPYRE Software Inc.:**
        *   Account Name contains: `Mpyre`, `TD BUSINESS TRAVEL VISA`, `CANADIAN MARGIN`, `US MARGIN`.
        *   *(Account number endings inferred from TD data: `7807`, `1012`, `5082`, `HR0E`, `HR0F`, `6Y7E`, `6Y7F`, `687A`, `687B`)*
    *   **Metropolis:**
        *   Account Name contains: `Metropolis`, `US DOLLAR CARD`, `TD BUSINESS CASH BACK VISA`, `US Dollar Credit Card`.
        *   *(Account number endings inferred from TD data: `7409`, `3361`, `0184`, `2631`, `7237`, `6877`, `4839`)*
    *   **AutoOptimize Inc.:**
        *   Account Name contains: `AutoOptimize`.
        *   *(Account number endings inferred from TD data: `1147`, `6838`, `6040`)*

7.  **Default Category:**
    *   If none of the above rules match, assign **Personal**.

**Accounts Requiring Note:**

*   Accounts appearing under multiple views in TD EasyWeb have been assigned based on user confirmation:
    *   `TD BUSINESS CASH BACK VISA (4839)` -> **Metropolis**
    *   `CANADIAN MARGIN (HR0E/6Y7E)` -> **MPYRE Software Inc.**
    *   `US MARGIN (HR0F/6Y7F)` -> **MPYRE Software Inc.**
*   Personal investment accounts (TFSA, CAD/USD Investment with FL/LB identifiers, LOC) seen under business views are still treated as **Personal** unless overridden.
*   `10068764 CANADA INC` seen in dropdown - Ignored as per user instruction.

**Inter-Entity Transfers:**

*   Transfers between accounts belonging to different entities (e.g., MPYRE funding Kalaam Foundation) need special attention. They should be recorded appropriately as transfers/donations/loans in each entity's books. The categorization script should ideally identify these based on source/destination accounts if possible, or they may need manual review. 
*   Payments described as `TD VISA PREAUTH PYMT` originating from an MPYRE Software Inc. account require manual verification to determine if the payment was to a personal VISA card (in which case it's a personal cash draw) or to an MPYRE Software Inc. business VISA card (in which case it's an internal business transaction). The destination VISA card is not always identifiable from the transaction data alone.
*   Similarly, payments described as `TD VISA PYMT MSP` (or similar VISA payment descriptions) originating from a **Metropolis** account require verification. If the destination VISA card cannot be confirmed as personal, it should be assumed to be a payment to a Metropolis business VISA card, and the transaction's `PrimaryCategory` should be **Metropolis**.
*   E-transfers originating from a **Metropolis** account (e.g., `Description` contains `SEND E-TFR` or `ai_category` is `Transfer (E-transfer Outgoing)`) should be categorized as **Metropolis** expenses.

**Transaction Filtering:**

* In the current implementation, transaction filtering for transfer/payment terms is disabled to keep all transactions as requested.
* The implementation has filtering logic commented out that would otherwise exclude transactions with keywords like `PAYMENT`, `TRANSFER`, `TFR-TO`, etc.

**Financial Statement Processing:**

* **CRITICAL:** Transactions marked as `EXCLUDED_ACCOUNTING` must be filtered out of financial statement calculations
* **Revenue Calculation:** Only include transactions with positive amounts that are NOT marked as `EXCLUDED_ACCOUNTING`
* **Expense Calculation:** Only include transactions with negative amounts that are NOT marked as `EXCLUDED_ACCOUNTING`
* **Verification:** Always verify that Balance Forward and NSF Return transactions are properly excluded

**Maintaining Categorization Rules:**

* To add new manual overrides for specific merchants or transaction types, update the `spending_overrides.json` file rather than modifying this document.
* The `spending_overrides.json` file should be reviewed periodically to ensure it reflects current categorization needs.

# Recent Findings and Clarifications (January 2025)

## Critical Accounting Entry Exclusions
- **Balance Forward entries are NOT income** - these are opening balances carried from previous periods
- **RTN NSF entries are NOT income** - these are corrections for bounced/returned payments
- Both must be excluded from financial statement calculations to prevent revenue overstatement

## Revenue Source Classifications (May 2025)
Based on detailed analysis with user clarification:

### Kalaam Foundation Income Sources:
1. **STRIPE MSP**: Direct donations via Stripe payment processor
2. **Wire transfers (pattern: YYMMDDSNNNNNNNWIRE)**: iOS App Store revenue from Apple
3. **Google Payment MSP**: Android Play Store revenue from Google Play
4. **MADINAH GIVE CO MSP** (incoming, positive amounts): Large donations to Kalaam Foundation
5. **WPS-[reference]**: Large institutional donations (e.g., EP Group $45.3k donation)

### Expense Classifications:
- **MADINAH GIVE CO** (outgoing, negative amounts): Kalaam Foundation expenses
- **ISHAAQ/ISHAAQMHR**: Social media marketing expenses
- **UPWORK**: Development contractor expenses
- **ANTHROPIC/OPENAI**: AI service expenses
- **CLOUD**: Cloud infrastructure expenses
- **Bank fees**: Include MONTHLY PLAN FEE, MONTHLY ACCOUNT FEE, OVERDRAFT INTEREST in operational expenses

### Internal Transfers (Exclude from Operational Analysis):
- **TFR-TO transactions**: Internal transfers between accounts, not operational income/expenses
- **TFR-FR transactions**: Internal transfers, exclude from revenue calculations

## Account Type Sign Corrections
Credit card transactions import with positive amounts but represent expenses (should be negative):

### Credit Card Accounts (flip positive amounts to negative):
- **TD BUSINESS TRAVEL VISA** (all variations)
- **Areeb personal CAD credit card** (all variations)  
- **Areeb personal USD** credit card accounts

### Bank Accounts (positive amounts remain positive):
- **Kalaam Donations** accounts
- **COMMUNITY PLAN** accounts
- **TD BASIC BUSINESS PLAN** accounts
- **BUSINESS INVESTOR ACCOUNT** accounts
- **Mpyre** accounts

### Complete Income Source Patterns:
- **STRIPE MSP**: Stripe donation processor
- **STRIPE PAYMENTS MSP**: Alternative Stripe pattern  
- **Google Payment MSP**: Google Play Store revenue
- **MADINAH GIVE CO MSP**: Large donations (incoming)
- **MADINAH GIVE CO COR**: Alternative Madinah pattern
- **WPS-[reference]**: Institutional donations (e.g., EP Group)
- **[YYMMDD]S[NNNNNNN]WIRE**: App Store revenue from Apple

### Non-Income Positive Transactions (exclude from revenue):
- **Starting Balance**: Opening account balances
- **ACCT BAL REBATE**: Bank fee rebates
- **RTN FUNDS HELD**: Banking adjustments
- **COLLECTION ITEM**: Banking corrections
- **SEND E-TFR**: Internal transfers

## Stripe Payouts
- Stripe payouts may appear as either `STRIPE MSP` or `STRIPE PAYMENTS MSP` in the Description field.
- Both refer to Stripe, but `STRIPE MSP` is used for both detailed, date-specific account names (e.g., `Kalaam Donations 2065-6161389 Feb 28-Mar 31 2023`) and the generic account name (`Kalaam Donations (1389)`