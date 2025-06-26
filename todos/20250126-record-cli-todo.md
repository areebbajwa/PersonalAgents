# 20250126-record-cli-todo.md
Last updated: 2025-01-26 18:48:00

## Tasks
✅ [18:48] Set up project structure and git branch
✅ [19:01] Create record-cli directory structure in cli_tools/
✅ [19:04] Implement basic CLI argument parsing (window/fullscreen modes)
✅ [19:05] Write E2E test for CLI argument handling
✅ [19:05] TEST GATE: Run test - MUST PASS → `workflow-cli --project record-cli --sub-task-next`
✅ [19:06] Implement screen recording using screencapture -v
✅ [19:07] Write E2E test for screen recording functionality
✅ [19:07] TEST GATE: Run test - MUST PASS → `workflow-cli --project record-cli --sub-task-next`
✅ [19:08] Add FFmpeg fallback for video compression to 480p
✅ [19:09] Write E2E test for video compression
✅ [19:09] TEST GATE: Run test - MUST PASS → `workflow-cli --project record-cli --sub-task-next`
✅ [19:11] Implement Gemini API video upload and analysis
✅ [19:12] Write E2E test for Gemini integration
✅ [19:12] TEST GATE: Run test - MUST PASS → `workflow-cli --project record-cli --sub-task-next`
✅ [19:13] Add progress logging and error handling
✅ [19:14] Write E2E test for full workflow
✅ [19:14] TEST GATE: Run test - MUST PASS → `workflow-cli --project record-cli --sub-task-next`
✅ [19:14] Create symlink and make executable
✅ [19:15] Final testing and cleanup
🕒 Run `workflow-cli --project record-cli --next`

## Notes
- Using screencapture -v as primary recording method (simpler than FFmpeg)
- FFmpeg only for compression: 480p H.264 with fast preset
- Reuse Gemini API patterns from pdf-ai-cli
- Progress updates: recording → compressing → uploading → analyzing
- Output format: timestamped descriptions from Gemini
🔥 BREAKTHROUGH [19:06]: screencapture -v doesn't support window-specific recording, will use fullscreen for both modes