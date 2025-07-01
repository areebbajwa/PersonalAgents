# Selenium CLI

A command-line tool for browser automation using Selenium WebDriver with persistent sessions.

## Features

- **Persistent browser sessions** - Keep browser running between commands
- **Firefox profile support** - Use your existing Firefox profile with saved logins
- **HTML diff tracking** - See what changed on the page after each action
- **Interactive element discovery** - Get a list of clickable elements after navigation
- **MCP-compatible** - Works with Model Context Protocol tools

## Installation

```bash
npm install
```

## Usage

### Basic Commands

```bash
# Navigate to a URL
selenium-cli navigate https://example.com

# Click an element
selenium-cli click "id=submit-button"

# Type text
selenium-cli type "id=username" "john@example.com"

# Take a screenshot
selenium-cli screenshot

# Close browser
selenium-cli close
```

### Element Selectors

All commands that interact with elements accept selectors in the format `strategy=value`:

- `id=element-id` - Select by ID
- `css=.class-name` - Select by CSS selector
- `xpath=//div[@class="x"]` - Select by XPath
- `name=field-name` - Select by name attribute
- `class=class-name` - Select by class name
- `tag=div` - Select by tag name

### Interactive Element Discovery

The `--show-elements` flag displays all interactive elements on the page after navigation, clicks, or typing:

```bash
# Show elements after navigating
selenium-cli navigate https://google.com --show-elements

# Show elements after clicking
selenium-cli click "id=search-button" --show-elements

# Show elements after typing
selenium-cli type "id=search-box" "test query" --show-elements
```

Example output:
```
✔ Navigation successful
Screenshot: screenshots/navigate-2025-07-01T00-52-30.png
HTML: html-exports/navigate-2025-07-01T00-52-30.html

Interactive Elements: 18 found
  1. a#test-link - "Test Link" [#test-link]
  2. button#submit - "Submit" [#submit]
  3. input#search - "Enter search term" [#search]
  4. textarea#comments - "Enter comments" [#comments]
  ... and 14 more elements
```

### Response Format

Each action returns:
- `screenshot` - Path to screenshot file
- `html` - Path to exported HTML file
- `htmlDiff` - Changes in the HTML:
  - `htmlSizeDiff` - Size change in bytes
  - `textAdded` - Characters added
  - `textRemoved` - Characters removed
  - `changedSections` - Specific text changes
- `elements` - Interactive elements (when using `--show-elements`):
  - `count` - Total number of elements
  - `items` - Array of element details

### Element Details

Each element in the response includes:
- `tag` - HTML tag name
- `text` - Visible text content (truncated to 100 chars)
- `id` - Element ID attribute
- `class` - CSS classes
- `name` - Name attribute
- `href` - Link URL (for anchor tags)
- `type` - Input type
- `role` - ARIA role
- `ariaLabel` - ARIA label
- `placeholder` - Placeholder text
- `cssSelector` - CSS selector for the element

## Advanced Usage

### Options

- `--headless` - Run browser in headless mode
- `--no-profile` - Don't use Firefox profile
- `--timeout <ms>` - Set timeout for element operations (default: 10000)
- `--show-elements` - Display interactive elements after action
- `--no-clear` - Don't clear input field before typing
- `--enter` - Press Enter after typing

### Examples

```bash
# Navigate and show interactive elements
selenium-cli navigate https://github.com --show-elements

# Type in search box without clearing it first
selenium-cli type "id=search" "additional text" --no-clear

# Type and press Enter
selenium-cli type "id=search" "selenium webdriver" --enter

# Click with custom timeout
selenium-cli click "css=.dynamic-button" --timeout 30000
```

## Architecture

The CLI uses a persistent session architecture:
- A session server runs in the background managing the browser
- Commands communicate with the session server via HTTP
- Browser stays open between commands for faster execution
- HTML diffs are calculated after each action
- Interactive elements are discovered using Selenium's findElements

## Testing

Run the test suite:
```bash
npm test
```

## License

MIT