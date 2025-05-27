# TODO - Fix CRA Audit Issues for 2023 Tax Return

**TASK ID:** `fix_cra_audit_issues_2023_20250521_195140`

This file outlines the steps to address the concerns raised to avoid a CRA audit for the 2023 tax return, based on the user's provided checklist.

## Checklist Items & Actions:

- [x] **1. Fix Refund Calculation:**
    - [x] Modify `finances/reports/2023/simulated_t1_return_2023_areeb_bajwa.md`.
    - [x] Ensure non-refundable credits (including dividend tax credit) do not result in negative tax.
    - [x] Adjust Federal Net Tax to be $0 or positive.
    - [x] Adjust Ontario Net Tax to be $0 or positive. The user note suggests it will be around $6k. (Note: Final Ontario tax is $0 based on applying DTC correctly).
    - [x] Recalculate Total Tax Payable/Refund. It should not be a refund if driven by non-refundable credits exceeding tax.

- [x] **2. Provide Spouse's SIN:**
    - [x] Update `finances/reports/2023/simulated_t1_return_2023_areeb_bajwa.md`.
    - [x] Change "Spouse's SIN: PENDING_USER_INPUT" to "Spouse's SIN: 523211688" (obtained from `todos/personal_t1_return_2023_20250521_170309_todo.md`).

- [x] **3. Download "Auto-fill my return" and Match Slip Totals:**
    - [x] This is an action for the user to perform. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user about this.

- [x] **4. Deal with TFSA Excess:**
    - [x] This is an action for the user to perform (file RC243 or show withdrawal). Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user about this.

- [x] **5. Pay Outstanding Balances:**
    - [x] This is an action for the user to perform. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user about this.

- [x] **6. Prepare Receipt Bundle:**
    - [x] This is an action for the user to perform. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user about this, specifically mentioning:
        - $13.9k donations
        - $8.5k medical expenses
        - Child-care claim with low spouse income (Form T778)

- [x] **7. Add "Additional Information" PDF:**
    - [x] This is an action for the user to perform when NETFILING. Mark as noted for user.
    - [x] Draft the suggested text for the user: "2023 income consists solely of dividends from my corporation due to cash-flow timing; no salary was taken."
    - [x] Add this draft to the `simulated_t1_return_2023_areeb_bajwa.md` under a new "User Actions & Notes for Filing" section.

- [x] **8. File on Time & Use Consistent Address:**
    - [x] This is an advisory for the user. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user.

- [x] **9. Keep Working Papers:**
    - [x] This is an advisory for the user. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user.

- [x] **10. Double-Check Identification Lines:**
    - [x] This is an advisory for the user. Mark as noted for user.
    - [x] Add a note in the `simulated_t1_return_2023_areeb_bajwa.md` to remind the user.

## File Modifications:

*   `finances/reports/2023/simulated_t1_return_2023_areeb_bajwa.md`:
    *   [x] Update Spouse's SIN.
    *   [x] Correct Federal Net Tax calculation.
    *   [x] Correct Ontario Net Tax calculation.
    *   [x] Correct Total Tax Payable/Refund.
    *   [x] Add a new section: "VIII. Important Notes & User Actions for Actual Filing" to consolidate reminders from checklist items 3, 4, 5, 6, 7 (including draft text), 8, 9, 10.

- [x] **(Self-correction/User Request) Further Reduce Audit Risk (2025-05-21/22):**
    - [x] Regenerate `donations_for_cra_2023.csv` and `medical_expenses_for_cra_2023.csv` as `tmp/*_REGEN.csv` because `finances/data_exports/` was deleted.
        - [x] Export `tagged_transactions_2023` from `data/personal.db` to `tmp/tagged_transactions_for_analysis_2023.csv`.
        - [x] Run `finances/scripts/analyze_tagged_tax_transactions.py` on the temp CSV to create `tmp/donations_for_cra_2023_REGEN.csv` and `tmp/medical_expenses_for_cra_2023_REGEN.csv`.
    - [x] Modify `finances/reports/2023/simulated_t1_return_2023_areeb_bajwa.md`:
        - [x] Reduce total Donations claim to ~$11,000 (New total: $10,942.04).
        - [x] Reduce total Medical Expenses claim to ~$5,000 (New total: $5,134.51).
        - [x] Remove Child Care Expenses claim (set to $0.00).
        - [x] Recalculate all dependent figures: Net Income, Taxable Income, Federal and Ontario non-refundable credits, Federal and Ontario taxes, and Total Tax Payable/Refund.
        - [x] Update notes in Section VIII regarding receipt preparation for the new amounts. 