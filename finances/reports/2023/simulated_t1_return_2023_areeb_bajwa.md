# Simulated 2023 T1 Personal Tax Return - Areeb Bajwa

**TASK ID:** `personal_t1_return_2023_20250521_170309`
**DATE PREPARED (SIMULATED):** 2025-05-21

**IMPORTANT NOTES:**
*   This is a **SIMULATED** tax return based on information provided by the user and analysis of the `personal.db` database. **IT IS NOT A FILED TAX RETURN.**
*   CRA Auto-fill was not available.
*   All figures are subject to verification with official tax slips (T-slips) and receipts, which are paramount for an actual filing.
*   Calculations for tax credits and taxes payable are estimates and depend on final confirmed income figures and spouse's information.
*   This document is for informational and planning purposes only.

## I. Identification
*   **Full Name:** Areeb Bajwa
*   **SIN:** 529693855
*   **Date of Birth:** 1987-08-13
*   **Mailing Address (as of Dec 31, 2023):** 8175 first line nassagaweya, Campbellville, ON L0P 1B0 Canada
*   **Marital Status (as of Dec 31, 2023):** Married
    *   **Spouse's Full Name:** Nisha Ravindranath
    *   **Spouse's SIN:** PENDING_USER_INPUT
    *   **Spouse's 2023 Net Income (for calculation):** $0.00 (Assumed, pending user confirmation)
*   **Dependents Claimed:** None

## II. Total Income
*   **Line 12000 - Taxable amount of eligible dividends:** $116,738.34
    *   (Actual eligible dividends: $84,593.00; Gross-up: 38%)
*   **Line 15000 - Total Income:** $116,738.34

## III. Deductions from Total Income
*   **Line 21400 - Child care expenses:** $401.15
*   **Line 23200 - Other deductions (e.g. RRSP):** $0.00
*   **Line 23600 - Net Income:** $116,738.34 - $401.15 = $116,337.19

## IV. Taxable Income
*   **Line 26000 - Taxable Income:** $116,337.19

## V. Federal Tax Calculation (Schedule 1)

### Federal Non-Refundable Tax Credits:
*   **Line 30000 - Basic personal amount:** $15,000.00
*   **Line 30300 - Spouse or common-law partner amount:** $15,000.00
*   **Medical Expenses (Line 33099):**
    *   Total Expenses: $8,532.11
    *   Threshold (lesser of 3% of Net Income [$3,490.12] or $2,635.00): $2,635.00
    *   Eligible Amount: $8,532.11 - $2,635.00 = $5,897.11
*   **Donations and Gifts (Line 34900):** $13,942.04
*   **Total Non-Refundable Credit Base:** $15,000 (BPA) + $15,000 (Spouse) + $5,897.11 (Medical) + $13,942.04 (Donations) = $49,839.15
*   **Value of Credits for Specific Items:**
    *   BPA + Spouse ($30,000.00 * 15%): $4,500.00
    *   Medical ($5,897.11 * 15%): $884.57
    *   Donations (First $200 * 15% = $30.00) + ($13,742.04 * 29% = $3,985.19) = $4,015.19
*   **Total Federal Non-Refundable Tax Credits (Line 35000 value):** $4,500.00 + $884.57 + $4,015.19 = $9,399.76

### Federal Income Tax:
*   Taxable Income: $116,337.19
*   Tax on first $53,359.00 @ 15%: $8,003.85
*   Tax on next $53,358.00 (up to $106,717.00) @ 20.5%: $10,938.39
*   Tax on remaining $9,620.19 (up to $116,337.19) @ 26%: $2,501.25
*   **Basic Federal Tax (Line 42900 / Line 38 on Sched 1):** $21,443.49
*   Federal Tax after Non-Refundable Credits: $21,443.49 - $9,399.76 = $12,043.73
*   **Federal Dividend Tax Credit (Line 40425):** $116,738.34 (taxable dividends) * 15.0198% = $17,533.61
*   **Net Federal Tax (Line 42000):** $12,043.73 - $17,533.61 = **-$5,489.88**

## VI. Ontario Tax Calculation (Form ON428)

### Ontario Non-Refundable Tax Credits:
*   **Line 58040 - Basic personal amount:** $11,865.00
*   **Line 58120 - Spouse or common-law partner amount:** $11,865.00
*   **Medical Expenses (Line 58689):**
    *   Eligible Amount (same as federal): $5,897.11
*   **Donations and Gifts (Line 58969):** $13,942.04
*   **Value of Credits for Specific Items:**
    *   BPA + Spouse ($23,730.00 * 5.05%): $1,198.37
    *   Medical ($5,897.11 * 5.05%): $297.80
    *   Donations (First $200 * 5.05% = $10.10) + ($13,742.04 * 11.16% = $1,533.61) = $1,543.71
*   **Total Ontario Non-Refundable Tax Credits (Line 59 on ON428 value):** $1,198.37 + $297.80 + $1,543.71 = $3,039.88

### Ontario Income Tax:
*   Taxable Income: $116,337.19
*   Tax on first $49,231.00 @ 5.05%: $2,486.17
*   Tax on next $49,232.00 (up to $98,463.00) @ 9.15%: $4,503.73
*   Tax on remaining $17,874.19 (up to $116,337.19) @ 11.16%: $1,994.76
*   **Basic Ontario Tax (Line 48 on ON428):** $8,984.66
*   Ontario Tax after Non-Refundable Credits (Line 51 on ON428): $8,984.66 - $3,039.88 = $5,944.78
*   **Ontario Surtax (Line 55 on ON428):** ($5,944.78 - $5,315) * 20% = $125.96
*   Total Ontario Tax before DTC (Line 57 on ON428): $5,944.78 + $125.96 = $6,070.74
*   **Ontario Dividend Tax Credit (Line 61520):** $116,738.34 (taxable dividends) * 10% = $11,673.83
*   **Net Ontario Tax (Line 70 on ON428):** $6,070.74 - $11,673.83 = **-$5,603.09**

## VII. Summary of Tax Payable/Refund
*   **Net Federal Tax (Line 42000):** -$5,489.88
*   **Net Ontario Tax (from ON428 Line 70, entered on Line 42800 of T1):** -$5,603.09
*   **Total Tax Payable/Refund (Line 48400 - Refund):** -$5,489.88 + (-$5,603.09) = **-$11,092.97**
    *   This indicates an **Estimated Total Refund of $11,092.97**

## VIII. Information Checklist & Outstanding Items
*   [ ] Spouse's SIN
*   [ ] Spouse's 2023 Net Income (crucial for spousal amount and some benefits - currently assumed $0)
*   [ ] Official RRSP contribution slips (User confirmed $0, but for actual filing, $0 slips are good practice if applicable from institutions)
*   [ ] Official Medical Expense Receipts (User confirmed availability)
*   [ ] Official Donation Receipts (User confirmed availability)
*   [ ] Official Child Care Expense Receipts (showing provider SIN/Business # - User confirmed $401.15)
*   [ ] Any T-slips if they arrive unexpectedly (T4, T5 for interest/other dividends, T3, T4A, etc.)
*   [ ] Details/Statements for any Margin Interest paid if to be claimed.

**SIMULATION COMPLETE BASED ON CURRENT INFORMATION AND ASSUMPTIONS.**
**THIS IS NOT A FILED RETURN. REVIEW WITH A TAX PROFESSIONAL BEFORE FILING.** 