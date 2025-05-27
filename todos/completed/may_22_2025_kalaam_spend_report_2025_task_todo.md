# Kalaam Foundation 2025 Operational Spend Report

- [x] **Step 1: Locate and Access Financial Data**
    - Notes: Search for relevant financial data sources. This might involve looking for database files (e.g., `personal.db`) or CSV files within the `finances/` directory.
- [x] **Step 2: Query Financial Data for 2025 Operations**
    - Notes: Queried the `transactions` table in `data/personal.db`. Filtered for transactions in 2025 where `PrimaryCategory` is "Kalaam Foundation" and `Amount` is negative. Results saved to `kalaam_foundation_2025_spending.csv`.
- [x] **Step 3: Categorize Spending Data**
    - Notes: Manually defined 5 categories based on transaction descriptions (AI & Cloud Services, Contractors & Freelancers, Software & Subscriptions, Bank Fees & Interest, Other Operational Expenses), explicitly excluding internal transfers. Applied these categories to the extracted data.
- [x] **Step 4: Aggregate Spending by Category**
    - Notes: Processed `kalaam_foundation_2025_spending.csv` (excluding internal transfers) and aggregated totals for each defined category.
- [x] **Step 5: Generate and Present Report**
    - Notes: Total operational spend for Kalaam Foundation in 2025 (up to data available, excluding internal transfers) has been categorized.
        Final Operational Spending Breakdown (USD - Excluding Internal Transfers):
        - AI & Cloud Services: 86129.39 (49.85%)
        - Contractors & Freelancers: 84699.21 (49.02%)
        - Software & Subscriptions: 1838.89 (1.06%)
        - Bank Fees & Interest: 123.48 (0.07%)
        - Other Operational Expenses: 0.00 (0.00%)
        Total Operational Spend: 172790.97 USD
        (Excluded 20 internal transfers totaling: 133848.13 USD)