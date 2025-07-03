# 20250103-selenium_playwright_selectors-todo.md

Last updated: 2025-01-03 17:42

## Non-Negotiable User Requirements

Implement Playwright-style selectors for selenium-cli tool as specified in /Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/tasks/selenium_cli_playwright_selectors_task.md

### Key Requirements from Task File:
1. Add support for new selector prefixes: text:, text*:, role:, aria:, placeholder:, alt:, title:, data-testid:
2. Create parseSelector function to translate Playwright-style to Selenium-compatible
3. Maintain backwards compatibility with existing selectors
4. Support chained selectors with >> syntax
5. Support nth selection (nth=N)
6. Support visibility filters (:visible, :enabled)
7. Provide clear error messages for invalid syntax
8. Write unit and integration tests
9. Update documentation and help text

## Context Discovery

### Current State:
- selenium-cli uses strategy=value format (e.g., css=.button, xpath=//button)
- Selector parsing happens in multiple places in src/index.js (lines 264-267, 436-437, etc.)
- findElement function in browser-manager.js supports: id, css, xpath, name, tag, class
- No default selector strategy - must always specify strategy=value
- Type command is broken (crashes session server) - critical known issue

### Simplification Strategy:
- Add pre-processing step to translate Playwright selectors to XPath
- Leverage existing XPath support in Selenium
- Single point of modification: intercept before existing parser
- No external libraries needed - simple string transformations

## Tasks

### Phase 1: Create Selector Parser Module
- 🕒 [17:42] Create src/playwright-selector-parser.js with parseSelector function
- 🕒 Write unit tests for parseSelector function
- 🕒 TEST GATE: All parser unit tests must pass (text:, text*:, role:, etc.)
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Commit: "feat: add Playwright selector parser - tests: X/X passed"

### Phase 2: Integrate Parser into CLI
- 🕒 Modify selector parsing in src/index.js to use parseSelector
- 🕒 Ensure backwards compatibility (existing selectors still work)
- 🕒 Write integration tests for command-line usage
- 🕒 TEST GATE: All integration tests must pass
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Commit: "feat: integrate Playwright selectors into CLI - tests: X/X passed"

### Phase 3: Add Advanced Features
- 🕒 Implement chained selector support (>>)
- 🕒 Implement nth selection support (nth=N)
- 🕒 Implement visibility filters (:visible, :enabled)
- 🕒 Write tests for advanced features
- 🕒 TEST GATE: All advanced feature tests must pass
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Commit: "feat: add advanced selector features - tests: X/X passed"

### Phase 4: Error Handling and Help
- 🕒 Add helpful error messages for invalid selectors
- 🕒 Update CLI help text with new selector examples
- 🕒 Write tests for error scenarios
- 🕒 TEST GATE: All error handling tests must pass
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Commit: "feat: add error handling and help - tests: X/X passed"

### Phase 5: Documentation and E2E Testing
- 🕒 Update README.md with Playwright selector guide
- 🕒 Create examples directory with usage examples
- 🕒 Write comprehensive E2E tests with real websites
- 🕒 TEST GATE: All E2E tests must pass
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Commit: "feat: add documentation and E2E tests - tests: X/X passed"

### Phase 6: Finalization
- 🕒 Run all tests one final time to ensure nothing broke
- 🕒 TEST GATE: All tests must pass (unit + integration + E2E)
- 🕒 Run workflow-cli --project selenium_playwright_selectors --sub-task-next
- 🕒 Run ./scripts/setup-global-cli-tools.sh
- 🕒 Commit: "feat: complete Playwright selectors implementation - all tests passed"
- 🕒 Commit in main repo: git -C ~/PersonalAgents add cli_tools/selenium-cli && git -C ~/PersonalAgents commit -m "feat: enhance selenium-cli with Playwright selectors"
- 🕒 Run workflow-cli --project selenium_playwright_selectors --next

## Notes

### Selector Translation Examples:
- text:Login → xpath=//*[text()='Login']
- text*:Add to → xpath=//*[contains(text(),'Add to')]
- role:button → xpath=//*[@role='button']
- aria:button[name="Submit"] → xpath=//*[@role='button' and @aria-label='Submit']
- placeholder:Email → xpath=//*[@placeholder='Email']
- alt:Logo → xpath=//*[@alt='Logo']
- title:Help → xpath=//*[@title='Help']
- data-testid:submit → xpath=//*[@data-testid='submit']

### Chain Translation:
- role:form >> text:Submit → Find form first, then find Submit within it
- Requires finding element, then searching within that element's context

### Known Issues to Watch:
- Type command is broken - may affect testing
- Multiple Firefox instances sometimes created
- Session management issues with type command