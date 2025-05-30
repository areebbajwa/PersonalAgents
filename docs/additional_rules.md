# Additional Rules

## Global CLI Tool Access

**Use automated setup for global CLI tool access** - All CLI tools in `cli_tools/*/` directories can be made globally available via automated discovery. Run `./scripts/setup-global-cli-tools.sh` to create symlinks in `~/.local/bin/` for all discovered tools.

**Adding new CLI tools to global access**:
1. Create executable wrapper script in any `cli_tools/toolname/` directory
2. Run `./scripts/setup-global-cli-tools.sh` to auto-discover and symlink the new tool
3. Tool is immediately available globally: `toolname --help`

**No manual maintenance required** - The setup script automatically scans `cli_tools/*/` and excludes `node_modules/`, `src/`, and `target/` directories. New tools are discovered automatically without updating any configuration.

**PATH requirement** - Ensure `~/.local/bin` is in PATH: `export PATH="$HOME/.local/bin:$PATH"` (already set up in `.zshrc`)

## File Operations

**Never rename `__init__.py` files** - Essential for Python package imports

**Date prefixing format** - Use `mon_dd_yyyy_` prefix for scripts, docs, reports, and todos based on actual file modification dates. Use terminal to get today's date.

**Don't rename config files** - Configuration files referenced by scripts (like `spending_overrides.json`) should not be renamed as it breaks dependencies

**Don't rename utility modules** - Utility files that are imported/required by other scripts (like `ai_cache_utils.js`) should not be renamed as it breaks dependencies

**Use AI caching utility** - When creating scripts or tools that make AI API calls (OpenAI, Gemini), always use `utils/ai_cache_utils.js` to implement caching. This prevents redundant API calls, saves costs, and improves performance through content-based hashing.

**Bulk file operations** - Be specific about target files rather than using overly broad patterns

**Reference updates** - When renaming files, always update references using terminal find/replace commands

## Task Completion

**NEVER mark tasks as completed without successful end-to-end testing** - Tasks are only complete when they have been fully tested and demonstrated to work correctly. API key validation errors, missing dependencies, or any failures mean the task is NOT complete.

**NEVER send an email or finalize a task by submitting it officially without confirmation first** - Always stop and ask for confirmation before the final step of submitting the work. This includes emails, file uploads, API submissions, or any final deliverable.

## Content Verification and Research

**Only include information you can verify from available resources** - Never make assumptions about capabilities, features, or details that you cannot directly verify from provided codebases, documentation, or user-specified resources.

**Use multiple verification methods before making claims** - When analyzing systems or codebases, use appropriate search and investigation tools to confirm what actually exists before including information in responses.

**Ask for clarification when context is ambiguous** - When terms or requests could have multiple interpretations, clarify the specific meaning before proceeding.

**Remove internal process language from external deliverables** - Final outputs intended for external recipients should not contain references to your internal verification or analysis processes.

## API Key and Credential Management

**Always check existing config files for API keys first** - Before asking user for API keys or credentials, search `config/.env`, `data/`, and other credential files. Many keys may already be available.

**Use relative paths for config files** - Load environment variables from `config/.env` using relative paths to maintain consistency across different execution contexts.

**All tools and scripts must automatically load API keys from config/.env** - Never require users to manually set environment variables for API keys. All tools, scripts, and CLI applications should hardcode the path to `config/.env` and automatically load required API keys (OPENAI_API_KEY, GEMINI_API_KEY, etc.) from this central location.

## CLI Tool Development

**CLI tools must be tested with real data** - Help commands and argument parsing are insufficient. CLI tools must be tested end-to-end with actual input files/data to verify functionality.

**Create wrapper scripts for Node.js CLI tools** - Always create executable shell wrapper scripts (e.g., `./tool-name`) alongside Node.js CLI tools for easier usage.

**Self-documenting CLI tools** - Use comprehensive help text with examples and environment variable documentation. Avoid separate README files for simple tools.

## Code Reuse and Dependencies

**Prioritize existing utilities over new implementations** - Always search for and adapt existing code (like `ai_cache_utils.js`) before creating new implementations. Code reuse reduces duplication and leverages proven patterns.

## AI Model Selection

**Prefer Gemini Pro for PDF processing** - Gemini 2.5 Pro is faster and more effective for PDF text extraction than OpenAI. Use direct API calls with base64 encoded PDFs rather than complex assistant workflows.

## PDF Processing

**Always use the PDF AI CLI tool for PDF analysis** - When encountering PDF files that need to be read or analyzed, use `cli_tools/pdf-ai-cli/pdf-ai` to extract text content. Do not ask user for content or use other methods. The tool automatically loads GEMINI_API_KEY from config/.env.

**Single file**: `cd cli_tools/pdf-ai-cli && ./pdf-ai <pdf_path> <output_text_file>`
**Multiple files**: `cd cli_tools/pdf-ai-cli && ./pdf-ai batch <input_dir> <output_dir>`

The tool supports both single file processing and batch processing of entire directories. Caching ensures fast processing of previously seen files.

## Personal Information Management

**Check todos directory for personal information before asking user** - When forms or tasks require personal information (name, address, phone, etc.), always search the `todos/` and `todos/completed/` directories first for previously provided personal details before asking the user to provide them again. Personal information is often documented in completed task files. 