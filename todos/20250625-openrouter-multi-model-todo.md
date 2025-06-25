# 20250625-openrouter-multi-model-todo.md
Last updated: 2025-06-25 16:48:00

## Tasks
✅ [16:48] Set up project structure and git branch
🕒 Create openrouter-multi-model CLI directory structure
🕒 Set up package.json with minimal dependencies (axios, dotenv, commander)
🕒 Add OPENROUTER_API_KEY to config/.env
🕒 Create main CLI entry point with command parsing
🕒 Write E2E test for CLI initialization and help command
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Implement OpenRouter API client with single model query
🕒 Write E2E test for single model API call
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Extend to query all 3 models concurrently (anthropic/claude-opus-4, google/gemini-2.5-pro-preview, openai/o3)
🕒 Write E2E test for multi-model concurrent queries
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Integrate caching using existing ai_cache_utils.js pattern
🕒 Write E2E test for caching functionality
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Implement formatted console output and JSON result saving
🕒 Write E2E test for output formatting and file saving
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Add error handling and graceful failures
🕒 Write E2E test for error scenarios
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Create executable script and update permissions
🕒 Final E2E test - full workflow test
🕒 TEST GATE → `workflow-cli --project openrouter-multi-model --sub-task-next`
🕒 Update README with usage instructions
🕒 Run `workflow-cli --project openrouter-multi-model --next`

## Notes
- Keep it simple: CLI tool that takes a prompt and queries 3 specific models
- Use existing patterns from pdf-ai-cli for consistency
- Leverage ai_cache_utils.js for caching to avoid repeated API calls
- Output both to console (formatted) and JSON file (timestamped)