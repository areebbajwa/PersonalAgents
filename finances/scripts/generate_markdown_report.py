import sqlite3
import os
from collections import defaultdict

DB_PATH = "/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/data/personal.db"
OUTPUT_DIR = "/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/finances/financial-reports/"
OUTPUT_FILENAME = "personal_transactions_2023_report.md"

KALAAM_KEYWORDS = [
    'KALAAM', 'UPWORK', 'PURRWEB', 'OPENAI', 'ANAS', 'FIREBASE', 'VIMEO',
    'JAHANZAIB', 'ISHAAQ', 'FRAMER', 'ANTHROPIC', 'MADINAH GIVE CO MSP'
]

def fetch_transactions():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = """
        SELECT Date, "Account Name", Description, Amount, Currency, ai_category
        FROM tagged_transactions_2023
        WHERE strftime('%Y', Date) = '2023' AND PrimaryCategory = 'Personal'
    """
    
    # Add conditions to exclude Kalaam keywords
    for keyword in KALAAM_KEYWORDS:
        query += f" AND Description NOT LIKE '%{keyword}%'"
    
    query += " ORDER BY ai_category, Date;"
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return rows

def format_as_markdown(transactions):
    categorized_transactions = defaultdict(list)
    category_totals = defaultdict(float)

    for row in transactions:
        category = row[5]
        amount = row[3]
        categorized_transactions[category].append(row)
        category_totals[category] += amount

    markdown_lines = ["# 2023 Personal Transactions Report\n"]

    for category, trans_list in sorted(categorized_transactions.items()):
        markdown_lines.append(f"## {category}")
        markdown_lines.append(f"**Total for {category}: {category_totals[category]:.2f}**\n")
        markdown_lines.append("| Date | Account Name | Description | Amount | Currency |")
        markdown_lines.append("|---|---|---|---|---|")
        for trans in trans_list:
            # Ensure description is a single line for Markdown table compatibility
            description = str(trans[2]).replace("\n", " ").replace("|", "\\|")
            markdown_lines.append(f"| {trans[0]} | {trans[1]} | {description} | {trans[3]:.2f} | {trans[4]} |")
        markdown_lines.append("\n")
    
    return "\n".join(markdown_lines)

if __name__ == "__main__":
    transactions = fetch_transactions()
    if transactions:
        markdown_content = format_as_markdown(transactions)
        output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(output_path, "w") as f:
            f.write(markdown_content)
        print(f"Report generated: {output_path}")
    else:
        print("No personal transactions found for 2023.") 