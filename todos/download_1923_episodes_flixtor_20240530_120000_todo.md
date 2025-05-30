# TODO: Download 1923 Episodes from Flixtor

**Task Identifier:** download_1923_episodes_flixtor_20240530_120000

**Objective:** Download episode 6 onward from season 1 and all of season 2 of the TV show "1923" from Flixtor.

**Credentials & Website:**
- Website: https://flixtor.to/viplogin
- Username: areebb@gmail.com
- Password: Mxypkwj123@@@ (Ensure this is saved if prompted by the browser)

**Download Location:** /Users/areeb2/Downloads/ (Default browser download location)

## Plan:

- [x] **Step 1: Navigate to Flixtor and Log In**
    - Description: Use `browser-use-cli` to navigate to `https://flixtor.to/viplogin` and log in using the provided credentials. Ensure the password is saved if the browser offers.
    - Notes: Successfully logged in using `cd cli_tools/browser-use-cli && ./browser-use "Go to https://flixtor.to/viplogin and log in using username areebb@gmail.com and password Mxypkwj123@@@. Save the password if prompted."`. The browser did not prompt to save the password.
- [ ] **Step 2: Navigate to "1923" TV Show Page**
    - Description: After logging in, use `browser-use-cli` to search for "1923" and navigate to its main page.
- [ ] **Step 3: Download Season 1 Episodes (6 onwards)**
    - Description: Identify and download episodes 6, 7, 8 (and any subsequent episodes if S1 has more) of Season 1.
- [ ] **Step 4: Download All Season 2 Episodes**
    - Description: Identify and download all episodes of Season 2.
- [ ] **Step 5: Verify Downloads**
    - Description: Check the `/Users/areeb2/Downloads/` directory to confirm that all specified episodes have been downloaded.
- [ ] **Step 6: Stop Browser Service**
    - Description: Use `browser-use-cli --stop-service` to close the persistent browser session.
- [ ] **Step 7: Self-Reflection and Output Validation**
    - Description: Review the downloaded files and ensure they match the request.
- [ ] **Step 8: Archive TODO**
    - Description: Move this TODO file to `todos/completed/`. 