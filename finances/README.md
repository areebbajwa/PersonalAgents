# Financial Management Tools

This directory contains tools and documentation for financial management, reporting, and tax preparation.

## Directory Structure

```
finances/
├── financial-reports/     # Tools for generating and analyzing financial reports
│   ├── config/            # Configuration files
│   │   ├── serviceAccountKey.json   # Credentials for Google Sheets API (sensitive - ensure .gitignored)
│   │   └── spending_overrides.json  # Categorization rules for transactions
│   ├── data/              # Data files (e.g., categorized_transactions.csv - potentially sensitive, ensure .gitignored if necessary)
│   ├── scripts/           # Python scripts for financial processing
│   │   ├── main.py            # Main application for financial reports
│   │   ├── categorize_transactions.py  # Transaction categorization script
│   │   ├── extract_checklist_data.py   # Extract checklist data
│   │   └── get_accounts_info.py        # Account information retrieval
│   ├── requirements.txt   # Python dependencies for financial-reports
│   └── Dockerfile         # Docker configuration for deployment
├── docs/                  # Documentation files
│   ├── categorization_rules.md    # Documentation for transaction categorization rules
│   └── master_tax_checklist.md     # Master checklist for tax preparation
└── README.md              # This file
```

## Financial Reports

The `financial-reports` directory contains a web application and scripts for processing financial transaction data. It connects to Google Sheets to fetch transaction data, categorizes it, and generates reports.

### Prerequisites

- Python 3.10+
- Google Cloud account with service account key
- Required Python packages (see `finances/financial-reports/requirements.txt`)

### Setup and Configuration (Local)

1.  **Install dependencies:**
    ```bash
    cd finances/financial-reports
    pip install -r requirements.txt
    ```

2.  **Service Account Key:** Place your Google service account key in `finances/financial-reports/config/serviceAccountKey.json`. **Ensure this file is in your `.gitignore` to prevent committing sensitive credentials.**

3.  **Categorization Rules:** Configure transaction categorization rules in `finances/financial-reports/config/spending_overrides.json`.

### Usage (Local)

-   **View financial reports**: Run `main.py` from the `finances/financial-reports/scripts/` directory to start the web application.
    ```bash
    cd finances/financial-reports
    python scripts/main.py
    ```
    The application will be available at http://localhost:5000 by default.

-   **Categorize transactions**: Process transaction data from Google Sheets.
    ```bash
    cd finances/financial-reports
    python scripts/categorize_transactions.py
    ```

-   **Get account information**: Retrieve account information from Google Sheets.
    ```bash
    cd finances/financial-reports
    python scripts/get_accounts_info.py
    ```

## Deployment (Google Cloud Run)

This section covers how to deploy and update the Finance Report application on Google Cloud Run. Assumes you are in the `finances/financial-reports/` directory.

### Prerequisites for Deployment

*   Google Cloud SDK installed and configured
*   APIs enabled: Cloud Run, Cloud Build, Secret Manager, Artifact Registry
*   Secret Manager containing the service account key (e.g., `finance-report-sa-key`)
*   Artifact Registry repository created (e.g., `finance-report-repo`)
*   Your `gcloud` CLI is authenticated and configured for the correct project (e.g., `areeb-finance-report`)

### Initial Deployment

1.  **Create Secret in Secret Manager (if not already done):**
    This stores your `serviceAccountKey.json` securely.
    ```bash
    # Ensure you are in finances/financial-reports/
    gcloud secrets create finance-report-sa-key --data-file=./config/serviceAccountKey.json
    ```

2.  **Build Docker Image:**
    Replace `YOUR_PROJECT_ID` and `YOUR_REGION` (e.g., `us-central1`) with your actual values.
    ```bash
    # Ensure you are in finances/financial-reports/
    gcloud builds submit . --region=YOUR_REGION --tag YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/finance-report-repo/finance-report-image:latest
    ```

3.  **Deploy to Cloud Run:**
    ```bash
    # Ensure you are in finances/financial-reports/
    gcloud run deploy finance-report-app \
        --image YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/finance-report-repo/finance-report-image:latest \
        --region YOUR_REGION \
        --set-secrets="/etc/secrets/serviceAccountKey.json=finance-report-sa-key:latest" \
        --allow-unauthenticated \
        --memory=512Mi \
        --cpu=1 \
        --timeout=60s
    ```

### Redeployment Steps

After making code changes in `finances/financial-reports/`:

1.  **Build Updated Docker Image:**
    ```bash
    # Ensure you are in finances/financial-reports/
    gcloud builds submit . --region=YOUR_REGION --tag YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/finance-report-repo/finance-report-image:latest
    # Note the image digest (sha256:...) from the build output for precise deployment.
    ```

2.  **Deploy New Revision to Cloud Run:**
    You can deploy using the `:latest` tag, but using the specific image digest is recommended for production to ensure you deploy the exact image you just built.
    ```bash
    # Deploy using :latest tag (ensure you are in finances/financial-reports/)
    gcloud run deploy finance-report-app \
        --image YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/finance-report-repo/finance-report-image:latest \
        --region YOUR_REGION \
        --quiet

    # OR (Recommended) Deploy using the specific digest:
    # gcloud run deploy finance-report-app \
    #     --image YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/finance-report-repo/finance-report-image@sha256:DIGEST_FROM_BUILD_OUTPUT \
    #     --region YOUR_REGION \
    #     --quiet
    ```

3.  **Verify Deployment:**
    Access the service URL provided by the `gcloud run deploy` command to ensure your changes are live.

### Manual Spending Overrides

To update transaction categorization rules (`config/spending_overrides.json`):

1.  Edit the `finances/financial-reports/config/spending_overrides.json` file.
2.  Follow the redeployment steps above to apply changes to the Cloud Run service.

## Tax Documents and Checklists

The `docs/` directory contains resources for tax preparation:

-   `master_tax_checklist.md`: Comprehensive checklist for tax preparation.
-   `categorization_rules.md`: Detailed rules and logic for transaction categorization. 