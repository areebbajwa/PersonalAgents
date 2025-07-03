# Task: Add Playwright-style Selectors to selenium-cli

## Objective
Enhance the selenium-cli tool to support Playwright-style selectors for more intuitive and robust web automation.

## Background
Current selenium-cli requires complex CSS selectors that often break due to special characters or pseudo-selectors. Playwright's selector approach is more readable and maintainable.

## Requirements

### 1. New Selector Syntax Support
Add support for the following selector prefixes:
- `text:` - Select by exact text content
- `text*:` - Select by partial text content
- `role:` - Select by ARIA role
- `aria:` - Select by ARIA role with attributes (e.g., `aria:button[name="Submit"]`)
- `placeholder:` - Select by placeholder text
- `alt:` - Select by alt text
- `title:` - Select by title attribute
- `data-testid:` - Select by data-testid attribute

### 2. Implementation Details

#### Selector Parser
Create a `parseSelector` function that translates Playwright-style selectors to Selenium-compatible ones:

```javascript
function parseSelector(selector) {
    // text:Exact Text → xpath=//*[text()='Exact Text']
    // text*:Partial → xpath=//*[contains(text(),'Partial')]
    // role:button → xpath=//*[@role='button']
    // aria:button[name="Submit"] → xpath=//*[@role='button' and @aria-label='Submit']
    // placeholder:Enter email → xpath=//*[@placeholder='Enter email']
    // alt:Logo → xpath=//*[@alt='Logo']
    // title:Help → xpath=//*[@title='Help']
    // data-testid:submit-btn → xpath=//*[@data-testid='submit-btn']
}
```

#### Backwards Compatibility
- Maintain support for existing selectors (css=, xpath=, id=, etc.)
- Default to CSS selector if no prefix is provided

### 3. Enhanced Features

#### Chained Selectors
Support Playwright's `>>` syntax for chaining:
- `role:navigation >> text:Home` - Find "Home" within navigation

#### Index Selection
Support nth selection:
- `role:button >> nth=2` - Select the 3rd button (0-indexed)

#### Visibility Filters
- `:visible` - Only select visible elements
- `:enabled` - Only select enabled elements

### 4. Error Handling
- Provide clear error messages for invalid selector syntax
- Suggest alternative selectors when elements aren't found
- Handle special characters in text selectors properly

### 5. Examples to Support

```bash
# Text selectors
selenium-cli click "text:Login"
selenium-cli click "text*:Add to cart"

# ARIA selectors
selenium-cli click "role:button"
selenium-cli click "aria:button[name='Submit']"
selenium-cli fill "role:textbox" "Hello world"

# Attribute selectors
selenium-cli click "placeholder:Search..."
selenium-cli click "alt:Company Logo"
selenium-cli click "data-testid:submit-form"

# Chained selectors
selenium-cli click "role:navigation >> text:Products"
selenium-cli fill "role:form >> role:textbox >> nth=1" "test@example.com"

# With visibility
selenium-cli click "text:Submit:visible"
```

### 6. Testing Requirements
- Unit tests for selector parsing
- Integration tests with real web pages
- Tests for backwards compatibility
- Tests for error scenarios

### 7. Documentation Updates
- Update CLI help text
- Add examples to README
- Create a selector guide comparing old vs new syntax

## Success Criteria
1. All new selector types work reliably
2. Existing selectors continue to work
3. Error messages are helpful
4. Performance is not significantly impacted
5. Code is well-tested and documented

## Technical Considerations
- The tool appears to be Node.js-based
- Need to handle XPath escaping for special characters
- Consider caching parsed selectors for performance
- Ensure the solution works across different browsers

## File Locations
- Main CLI tool: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/selenium-cli/selenium-cli`
- Source files: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/selenium-cli/src/`
- Tests: `/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/selenium-cli/tests/`