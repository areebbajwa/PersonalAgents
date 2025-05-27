# Financial Data Analysis: Key Learnings & Best Practices

> **Context**: Lessons learned from Kalaam Foundation financial report verification project that uncovered major data integrity issues and led to systematic improvements.

## 🔍 Data Verification & Integrity

### Critical Rule: Always Verify Before Reporting
- **Problem**: Financial reports can have catastrophic errors (we found $60k deficit vs reported $39k surplus)
- **Solution**: Start every financial analysis with comprehensive data integrity checks
- **Implementation**: Create standard verification checklist before any financial report

### Transaction-Level Verification is Mandatory
- **Problem**: Category totals can appear correct while individual transactions are completely wrong
- **Solution**: Always drill down to actual transactions, not just category summaries
- **Implementation**: Build verification queries that show sample transactions for each category

```sql
-- Standard verification query template
SELECT 
    PrimaryCategory,
    COUNT(*) as transaction_count,
    SUM(Amount) as total_amount,
    -- Show sample transactions
    GROUP_CONCAT(Description, ' | ') as sample_descriptions
FROM transactions 
WHERE PrimaryCategory = 'TARGET_CATEGORY'
GROUP BY PrimaryCategory;
```

### Systematic Duplicate Detection
- **Problem**: Duplicates can create massive data distortions (we found $100k+ income inflation)
- **Pattern**: Look for identical amounts on consecutive dates with similar descriptions
- **Implementation**: Build duplicate detection into initial data import process

```sql
-- Duplicate detection query
SELECT Date, Description, Amount, COUNT(*) as duplicate_count
FROM transactions 
GROUP BY Date, Description, Amount 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, ABS(Amount) DESC;
```

## 🛠 System Design Patterns

### Conservative Data Processing Principle
- **Rule**: Scripts should NEVER override existing manual categorizations
- **Pattern**: Always check `(PrimaryCategory IS NULL OR PrimaryCategory = '')` before updates
- **Implementation**: All categorization functions must be idempotent

```python
# Template for safe categorization updates
def safe_categorize_transactions(conn, table_name):
    """Only processes truly uncategorized transactions."""
    cursor.execute(f'''
        UPDATE "{table_name}" SET PrimaryCategory = ?
        WHERE (conditions for categorization)
        AND (PrimaryCategory IS NULL OR PrimaryCategory = '')
    ''')
```

### Entity Separation is Critical
- **Problem**: Transactions can belong to wrong entities entirely (MPYRE vs Kalaam Foundation)
- **Solution**: Use account name patterns and transaction descriptions for entity separation
- **Implementation**: Build entity separation rules early in data pipeline

```python
# Entity categorization hierarchy
def categorize_by_entity(description, account_name):
    """Determine which entity a transaction belongs to."""
    # 1. Account name patterns (most reliable)
    # 2. Description keywords
    # 3. Transaction patterns
    # 4. Manual override rules
```

### Robust Error Handling Pattern
- **Pattern**: Handle missing data gracefully with meaningful error messages
- **Implementation**: Comprehensive input validation from the start

```python
# Template for robust data processing
try:
    # Process data
    if field is None:
        log_id = create_identifier_for_logging(other_fields)
        print(f"Skipping transaction ({log_id}) due to missing '{field}' field.")
        continue
except Exception as e:
    print(f"Error processing {identifier}: {e}")
    return False
```

## 📊 Financial Analysis Workflows

### Large Transaction Review Process
- **Threshold**: Flag any transaction >$10k for manual review
- **Pattern**: Wire transfers and large amounts need extra scrutiny
- **Implementation**: Automated flagging system for suspicious transactions

```sql
-- Large transaction review query
SELECT Date, "Account Name", Description, Amount, PrimaryCategory
FROM transactions 
WHERE ABS(Amount) > 10000 
ORDER BY ABS(Amount) DESC;
```

### Account-Level Validation
- **Pattern**: Validate that account names map to correct entities
- **Implementation**: Cross-reference account patterns with entity rules

```sql
-- Account entity validation
SELECT DISTINCT "Account Name", PrimaryCategory, COUNT(*) as transaction_count
FROM transactions 
GROUP BY "Account Name", PrimaryCategory 
ORDER BY "Account Name", transaction_count DESC;
```

## 🔧 Technical Implementation

### SQLite Row Factory Standard
- **Pattern**: Always use `conn.row_factory = sqlite3.Row` for column access by name
- **Implementation**: Include in all database connection utilities

```python
def connect_db(db_file_path):
    """Standard database connection with row factory."""
    conn = sqlite3.connect(db_file_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn
```

### Test-Driven Data Processing
- **Pattern**: Create test cases with known inputs/outputs before modifying data processing
- **Implementation**: Build comprehensive test suites for financial data processing

```python
def test_categorization_behavior():
    """Verify categorization doesn't override existing categories."""
    # Create test database with known categorized/uncategorized transactions
    # Run categorization process
    # Verify existing categories unchanged
    # Verify uncategorized transactions processed correctly
```

## 📈 Process Improvements

### Version Control for Financial Data
- **Pattern**: Track all database schema and major data corrections in git
- **Implementation**: Automatic git commits for major financial data changes

```bash
# Standard commit pattern for financial corrections
git add finances/
git commit -m "fix: correct $99k MPYRE transaction categorization

- Move wire transfer from Kalaam Foundation to MPYRE Software Inc
- Recalculate foundation financial position: +$39k -> -$60k
- Update income breakdown and donor contribution percentage"
```

### Automated Data Quality Checks
- **Implementation**: Build functions that automatically detect common issues

```python
def run_data_quality_checks(conn, table_name):
    """Comprehensive data quality assessment."""
    checks = {
        'duplicates': check_for_duplicates(conn, table_name),
        'large_transactions': check_large_transactions(conn, table_name),
        'entity_mixing': check_entity_separation(conn, table_name),
        'missing_categories': check_uncategorized_count(conn, table_name)
    }
    return checks
```

## 🎯 Standard Verification Queries

### Pre-built Financial Analysis Queries

```sql
-- 1. Duplicate Detection
SELECT Date, Description, Amount, COUNT(*) as duplicates
FROM transactions 
GROUP BY Date, Description, Amount 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC, ABS(Amount) DESC;

-- 2. Large Transaction Review
SELECT Date, "Account Name", Description, Amount, PrimaryCategory
FROM transactions 
WHERE ABS(Amount) > 10000 
ORDER BY Date DESC;

-- 3. Entity Verification
SELECT "Account Name", 
       COUNT(*) as transaction_count,
       SUM(Amount) as total_amount,
       GROUP_CONCAT(DISTINCT PrimaryCategory) as categories
FROM transactions 
GROUP BY "Account Name" 
ORDER BY transaction_count DESC;

-- 4. Category Breakdown with Samples
SELECT PrimaryCategory,
       COUNT(*) as count,
       SUM(Amount) as total,
       AVG(Amount) as avg_amount,
       MIN(Date) as earliest,
       MAX(Date) as latest
FROM transactions 
WHERE PrimaryCategory IS NOT NULL 
  AND PrimaryCategory NOT LIKE 'EXCLUDED_%'
GROUP BY PrimaryCategory 
ORDER BY ABS(total) DESC;

-- 5. Excluded Transaction Summary
SELECT PrimaryCategory, COUNT(*) as excluded_count
FROM transactions 
WHERE PrimaryCategory LIKE 'EXCLUDED_%'
GROUP BY PrimaryCategory;
```

## 🚀 Next Project Setup Checklist

For any new financial analysis project:

### Phase 1: Data Integrity (Day 1)
- [ ] Run duplicate detection queries
- [ ] Identify and separate different entities
- [ ] Flag large transactions (>$10k) for review
- [ ] Verify account name to entity mappings
- [ ] Check for obvious data anomalies

### Phase 2: System Setup (Day 1-2)
- [ ] Implement conservative categorization (never override existing)
- [ ] Set up proper database connections (with row factory)
- [ ] Create test cases for categorization logic
- [ ] Build automated data quality checks
- [ ] Set up version control for data corrections

### Phase 3: Processing (Day 2-3)
- [ ] Process exclusions (transfers, accounting entries)
- [ ] Fix obvious data issues (duplicate removal, amount signs)
- [ ] Apply categorization rules systematically
- [ ] Run verification queries after each major change
- [ ] Document all corrections in git commits

### Phase 4: Verification (Day 3-4)
- [ ] Verify category totals match expectations
- [ ] Sample transactions in each category for accuracy
- [ ] Cross-check with external sources where possible
- [ ] Run comprehensive data quality assessment
- [ ] Generate final reports with confidence intervals

## 🔗 Related Documentation

- `docs/may_26_2025_categorization_rules.md` - Detailed categorization hierarchy
- `finances/scripts/categorize_db_transactions.py` - Implementation of these patterns
- `finances/config/spending_overrides.json` - Manual categorization overrides

## 📊 Success Metrics

These practices should result in:
- **Faster setup**: Days instead of weeks for data verification
- **Higher accuracy**: Catch major errors before reporting
- **Better maintainability**: Clear, documented, reversible processes
- **Increased confidence**: Systematic verification at each step

---

*Last updated: May 2025*
*Based on: Kalaam Foundation financial analysis project* 