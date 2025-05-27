# CLI Tools Directory

This directory contains standalone command-line interface (CLI) tools and utilities that can be used independently or integrated with other systems, including AI assistants like Cursor.

## Available CLI Tools

### 1. Desktop Automation CLI (`desktop-automation-cli/`)

A powerful CLI tool for automating desktop applications on macOS through accessibility APIs.

**Features:**
- Open URLs and applications
- List UI elements with accessibility information
- Direct input control (keyboard, mouse, text input)
- AppleScript integration for reliable automation
- JSON output for programmatic use

**Quick Start:**
```bash
cd cli_tools/desktop-automation-cli
cargo build --bin cli --release
./target/release/cli --help
```

**Convenient Usage:**
```bash
# Use the wrapper script
cd cli_tools/desktop-automation-cli
./automation --help

# Web form automation example
./automation open-url "https://example.com"
./automation input click "400,350"
./automation input writetext "username"
./automation input keypress "Tab"
./automation input writetext "password"
./automation input keypress "Return"
```

**Documentation:**
- [User README](desktop-automation-cli/README.md) - Comprehensive user documentation
- [Cursor Agent Instructions](desktop-automation-cli/CURSOR_AGENT_INSTRUCTIONS.md) - AI assistant integration guide

**Use Cases:**
- Automated login to web services
- Desktop application interaction
- Form filling and data entry
- UI testing and verification
- AI-driven automation workflows

---

## CLI Tool Development Guidelines

When adding new CLI tools to this directory:

1. **Directory Structure**: Each CLI tool should have its own subdirectory
2. **Documentation**: Include a README.md with installation and usage instructions
3. **Build System**: Use appropriate build tools (Cargo for Rust, package.json for Node.js, etc.)
4. **Interface Design**: 
   - Prefer command-line interfaces with clear argument parsing
   - Output JSON for programmatic use when possible
   - Support both human-readable and machine-readable formats
5. **Error Handling**: Provide clear error messages and appropriate exit codes
6. **Testing**: Include examples and test cases
7. **Wrapper Scripts**: Consider providing shell wrapper scripts for easier usage

## Integration Patterns

CLI tools in this directory are designed to be used by:
- **AI Assistants**: Cursor, Claude, and other AI systems via terminal commands
- **Automation Scripts**: Shell scripts, Python scripts, etc.
- **CI/CD Pipelines**: Automated workflows and deployments
- **Manual Usage**: Direct command-line interaction by users
- **Other Applications**: Any system that can execute shell commands

## Design Principles

Each CLI tool should be:
- **Stateless**: No persistent state between invocations
- **Idempotent**: Safe to run multiple times with the same inputs
- **Well-documented**: Clear usage instructions and examples
- **Robust**: Proper error handling and input validation
- **Self-contained**: Minimal external dependencies when possible
- **Cross-platform**: Support multiple operating systems when feasible

## Difference from `tools/` Directory

- **`tools/`**: Contains LangChain tools and Python modules used by PersonalAgents
- **`cli_tools/`**: Contains standalone CLI applications that can be used independently

This separation keeps the codebase organized and makes it clear which tools are part of the agent framework versus which are standalone utilities. 