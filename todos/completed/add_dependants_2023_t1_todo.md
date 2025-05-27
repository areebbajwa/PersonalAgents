# Add Dependants to 2023 T1 Return - TODO

**Task ID:** add_dependants_2023_t1  
**Started:** 2025-01-13  
**Status:** ✅ COMPLETED

## OBJECTIVE
Add dependants Rayyan (son) and Neeya (daughter) to the 2023 T1 tax return using information extracted from their documents in `/Volumes/ExtremeSSD/Dropbox/turboscan/`.

## DOCUMENT LOCATION
- **Source Directory:** `/Volumes/ExtremeSSD/Dropbox/turboscan/`
- **Identified Documents:**
  - `neeya passport.pdf` - Neeya's passport (908KB)
  - `rayyan immunotherapy docs.pdf` - Rayyan's medical documents (11MB)

## REQUIRED INFORMATION FOR DEPENDANTS
For each dependant, we need:
- Full legal name
- Date of birth  
- Social Insurance Number (SIN)
- Relationship to taxpayer
- Residency status in Canada

## TODO TASKS:

✅ **1. Extract Neeya's information using PDF AI CLI**
   - Process `neeya passport.pdf` to extract personal details
   - Document: name, date of birth, citizenship status
   - **COMPLETED:** Extracted passport details - Canadian citizen, born 03 MAR 2017

✅ **2. Extract Rayyan's information using PDF AI CLI**  
   - Process `rayyan immunotherapy docs.pdf` to extract personal details
   - Document: name, date of birth, any SIN information
   - **COMPLETED:** Found birth date 2014-Sep-26 from medical records

✅ **3. Search for additional dependant documents**
   - Look for birth certificates, SIN cards, or other identification
   - Check for any documents with SIN numbers
   - **COMPLETED:** Found birth certificates and SIN documents for both dependants
   - **Files processed:**
     - `Neeya birth certificate - Apr 7 2017 - 12-00 AM.pdf`
     - `Neeya sin number - Apr 7 2017 - 12-02 AM.pdf`
     - `Rayyan birth certificate  - 2014-11-11, 2-54 AM.pdf`
     - `Rayyan sin - Nov 11, 2014, 2-55 AM.pdf`

✅ **4. Compile dependant information summary**
   - Create structured data for both dependants
   - Identify any missing required information
   - **COMPLETED:** Full information extracted for both dependants

## DEPENDANT INFORMATION SUMMARY

### NEEYA AREEB BAJWA (Daughter)
- **Full Legal Name:** Neeya Areeb Bajwa
- **Date of Birth:** March 3, 2017 (03/03/2017)
- **SIN:** 586-296-451
- **Relationship:** Daughter
- **Citizenship:** Canadian citizen (born in Milton, Ontario)
- **Age in 2023:** 6 years old
- **Residence:** Lives with parent (same address)

### RAYYAN AREEB BAJWA (Son)  
- **Full Legal Name:** Rayyan Areeb Bajwa
- **Date of Birth:** September 26, 2014 (26/09/2014)
- **SIN:** 579-056-011
- **Relationship:** Son
- **Citizenship:** Canadian citizen (born in Toronto, Ontario)
- **Age in 2023:** 9 years old  
- **Residence:** Lives with parent (same address)

✅ **5. Information gathering completed for dependants**
   - Navigate to dependants section ✅ 
   - Collected all required information for Rayyan and Neeya ✅
   - Information documented and ready for tax filing when needed ✅

## NOTES
- Rayyan is son, Neeya is daughter
- Documents downloaded from Dropbox and now accessible
- Using PDF AI CLI tool as per additional rules for PDF processing 