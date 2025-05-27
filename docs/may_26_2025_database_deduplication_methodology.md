# Database Transaction Deduplication Methodology

**Created**: 2025-01-29  
**Last Updated**: 2025-01-29  
**Author**: AI Agent  

## Overview

This document outlines the methodology, scripts, and best practices for deduplicating transaction records in the personal.db database. This process was successfully implemented to remove 900 duplicate transactions from the database.

## Problem Description

### Root Causes of Duplicates

1. **Google Sheet Multiple Imports**: The primary source of duplicates (580 out of 677 duplicate groups) came from "Google Sheet - Transactions" being imported multiple times.

2. **PDF File Copies**: Secondary source of duplicates came from processing multiple copies of the same PDF files (e.g., "file.pdf" and "file (1).pdf", "file (2).pdf").

### Detection Method

Duplicates are identified by grouping transactions on:
- Date
- Account Name  
- Amount
- Description

Note: The existing UNIQUE constraint on `("SourceFile", "SheetTransactionID", "RawData")` prevents technical duplicates but not business logic duplicates.

## Deduplication Strategy

### Priority Ranking (Highest to Lowest)

1. **Google Sheet entries over PDF files** - Google Sheet entries are manually curated and more current
2. **Original files over numbered copies** - Files without "(1)", "(2)" suffixes are preferred
3. **Lexicographic order** - Among similar files, alphabetically first
4. **Lower rowid** - Final tiebreaker

### SQL Implementation

```sql
ROW_NUMBER() OVER (
    PARTITION BY "Date", "Account Name", "Amount", "Description"
    ORDER BY 
        -- Prefer Google Sheet entries over PDF files
        CASE WHEN "SourceFile" LIKE '%Google Sheet%' THEN 1 ELSE 2 END,
        -- Prefer original files over numbered copies
        CASE WHEN "SourceFile" NOT LIKE '%(%' THEN 1 ELSE 2 END,
        -- Lexicographic order for similar files
        "SourceFile",
        -- Final tiebreaker
        rowid
) AS priority_rank
```

## Execution Process

### Prerequisites

1. **Backup Creation**: Always create a database backup before deduplication
2. **Analysis Phase**: Run duplicate analysis queries to understand scope
3. **Script Testing**: Test deduplication logic on small samples first

### Safe Execution Steps

1. Create database backup: `cp data/personal.db data/personal_backup_YYYYMMDD.db`
2. Run analysis queries to identify duplicate patterns
3. Execute deduplication script within a transaction wrapper
4. Verify results and database integrity
5. Document results and clean up temporary files

### Verification Checks

- **Count Verification**: Ensure final count = original count - expected duplicates  
- **Zero Duplicates Check**: Verify no duplicate groups remain
- **Integrity Check**: Run `PRAGMA integrity_check` to ensure database health
- **Sample Review**: Manually review sample of deleted records

## Results (2025-01-29 Execution)

| Metric | Value |
|--------|-------|
| Original Transactions | 11,436 |
| Duplicate Groups Found | 677 |
| Duplicates Removed | 900 |
| Final Transaction Count | 10,536 |
| Remaining Duplicates | 0 |

### Source Breakdown of Removed Duplicates

- Google Sheet - Transactions: 580 duplicate groups
- PDF numbered copies: 97 duplicate groups  

## File Templates

### Analysis Query Template

```sql
-- Identify duplicate patterns
SELECT 
    "Date", "Account Name", "Amount", "Description", 
    COUNT(*) as duplicate_count,
    GROUP_CONCAT("SourceFile", '; ') as source_files
FROM transactions 
GROUP BY "Date", "Account Name", "Amount", "Description"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

### Source Analysis Template

```sql
-- Analyze which source files contribute to duplicates
SELECT 
    "SourceFile", 
    COUNT(*) as total_transactions
FROM (
    SELECT "Date", "Account Name", "Amount", "Description", "SourceFile"
    FROM transactions 
    GROUP BY "Date", "Account Name", "Amount", "Description"
    HAVING COUNT(*) > 1
) 
GROUP BY "SourceFile" 
ORDER BY total_transactions DESC;
```

## Best Practices

1. **Always Backup**: Never run deduplication without a current backup
2. **Incremental Approach**: Test on small datasets before full execution
3. **Transaction Wrapping**: Use SQL transactions for rollback capability
4. **Comprehensive Logging**: Capture all output for audit trails
5. **Integrity Verification**: Always check database integrity post-execution
6. **Documentation**: Document all executions with dates, counts, and results

## Rollback Procedure

If deduplication needs to be reversed:

```bash
# Stop all applications using the database
# Replace current database with backup
cp data/personal_backup_YYYYMMDD.db data/personal.db
# Verify restoration
sqlite3 data/personal.db "SELECT COUNT(*) FROM transactions;"
```

## Future Considerations

1. **Prevention**: Implement source-level duplicate detection in import scripts
2. **Monitoring**: Regular duplicate monitoring as part of data quality checks  
3. **Automation**: Consider automated duplicate detection with manual approval
4. **Documentation**: Keep this methodology updated with any process changes 