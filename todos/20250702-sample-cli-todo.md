# 20250702-sample-cli-todo.md
Last updated: 2025-07-02 20:23

## Non-Negotiable User Requirements
- Create a CLI tool that generates random sample data in JSON format

## Context Discovery
- Found existing CLI tool patterns in cli_tools/ directory
- Each tool has its own directory with executable matching directory name
- Node.js tools use commander.js for argument parsing
- Tools support --json flag for machine-readable output
- Test patterns exist in tests/ directory
- @faker-js/faker is the recommended library for data generation (actively maintained)

## Tasks
🕒 [20:23] Create directory structure for sample-cli tool
🕒 [20:23] Initialize Node.js project with package.json
🕒 [20:23] Install dependencies (@faker-js/faker, commander)
🕒 [20:23] Create basic CLI structure with help text
🕒 [20:23] Write test for help flag functionality
🕒 [20:23] TEST GATE: Run help flag test - MUST PASS
🕒 [20:23] Commit: "feat: setup sample-cli basic structure - tests: 1/1 passed"
🕒 [20:23] Implement data generation with simple types (name, email, address)
🕒 [20:23] Write test for basic data generation
🕒 [20:23] TEST GATE: Run data generation test - MUST PASS
🕒 [20:23] Commit: "feat: add basic data generation - tests: 2/2 passed"
🕒 [20:23] Add count parameter for generating multiple records
🕒 [20:23] Write test for bulk generation
🕒 [20:23] TEST GATE: Run bulk generation test - MUST PASS
🕒 [20:23] Commit: "feat: add bulk generation support - tests: 3/3 passed"
🕒 [20:23] Add schema support via --schema parameter
🕒 [20:23] Write test for schema-based generation
🕒 [20:23] TEST GATE: Run schema test - MUST PASS
🕒 [20:23] Commit: "feat: add schema support - tests: 4/4 passed"
🕒 [20:23] Add to global CLI setup script
🕒 [20:23] Write end-to-end test
🕒 [20:23] TEST GATE: Run E2E test - MUST PASS
🕒 [20:23] Commit: "feat: complete sample-cli implementation - tests: 5/5 passed"
🕒 [20:23] Run workflow-cli --project sample-cli --next

## Notes
- Using @faker-js/faker for data generation (proven library)
- Following existing CLI tool patterns from the codebase
- Keeping it simple: generate to stdout, pipe-friendly
- No complex configuration files, just command line arguments