SELECT DISTINCT "Account Name" FROM transactions WHERE "Date" >= '2020-01-01' AND (
    "Account Name" LIKE '%7807%' OR
    "Account Name" LIKE '%1012%' OR
    "Account Name" LIKE '%5082%' OR
    "Account Name" LIKE '%HR0E%' OR
    "Account Name" LIKE '%HR0F%' OR
    "Account Name" LIKE '%6Y7E%' OR
    "Account Name" LIKE '%6Y7F%' OR
    "Account Name" LIKE '%687A%' OR
    "Account Name" LIKE '%687B%' OR
    "Account Name" LIKE '%8118%' OR
    "Account Name" LIKE '%561hr0f%' OR
    "Account Name" LIKE '%561hr0g%' OR
    "Account Name" LIKE '%Mpyre%' OR
    "Account Name" LIKE '%MPYRE%'
); 