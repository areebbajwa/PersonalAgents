# AI Monitor CLI

AI Monitor watches Claude Code conversations and provides real-time guidance to ensure workflow compliance.

## Features

- **Workflow Compliance**: Monitors adherence to dev mode and task mode rules
- **Stuck Detection**: Identifies when AI is stuck (20+ turns without progress)
- **Cost Optimized**: Uses Gemini 2.5 Pro with context caching (73% cost reduction)
- **Turn Tracking**: Monitors conversation progress with turn counters
- **Smart Interventions**: Only intervenes when truly needed

## Installation

The AI Monitor CLI is automatically available after running the setup script:

```bash
./scripts/setup-global-cli-tools.sh
```

## Usage

### Start Monitoring

```bash
# Basic usage (started automatically by workflow-cli)
ai-monitor-cli monitor --session tmux-session-name --project my-project --mode dev

# With custom interval (default: 60 seconds)
ai-monitor-cli monitor --session tmux-session-name --interval 30

# Without sending guidance (observation only)
ai-monitor-cli monitor --session tmux-session-name --no-guidance
```

### Monitor All Active Sessions

```bash
# Monitor all workflow sessions
ai-monitor-cli monitor-all

# Check status
ai-monitor-cli status
```

### Test Mode

```bash
# Test the monitor with sample data
ai-monitor-cli test
```

## How It Works

1. **Reads Claude Code Logs**: Monitors JSONL conversation logs from `~/.claude/projects/`
2. **Analyzes with Gemini**: Sends full conversation history to Gemini 2.5 Pro
3. **Detects Issues**: Identifies workflow violations or stuck situations
4. **Sends Guidance**: Injects helpful commands via tmux (prefixed with "ai-monitor:")

## Intervention Criteria

### Will Intervene For:
- Workflow violations (skipping steps, not using todo, etc.)
- Stuck after 20+ turns without progress
- Repeating same failed action multiple times
- Not asking for help when blocked (e.g., 2FA)

### Won't Intervene For:
- Normal debugging and problem solving
- Waiting for builds/tests/installations
- Reading and analyzing code
- Making steady progress (even if slow)
- Trying different approaches

## Configuration

### Environment Variables

```bash
# Set in config/.env or shell
export GEMINI_API_KEY=your-api-key
```

### Cost Optimization

- Default 60-second interval balances coverage and cost
- Daily cost: ~$8/day with Gemini caching (vs $30/day without)
- Caching provides 73% cost reduction on repeated context

## Testing

```bash
# Run test suite
cd cli_tools/ai-monitor-cli
node tests/test-framework.js        # Basic functionality
node tests/run-simple-test.js       # Simple verification  
node tests/test-caching-costs.js    # Cost analysis
node tests/test-scenarios.js        # Full test suite
```

## Recent Improvements (July 2025)

- Clear "stuck" definition: 20+ turns without high-level progress
- Full conversation context (up to 7000 entries)
- No truncation of responses
- 73% cost reduction with Gemini caching
- Better false positive prevention

See [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for detailed changelog.

## Troubleshooting

### Monitor Not Detecting Logs
- Ensure you're in the correct project directory
- Check if Claude Code is generating logs in `~/.claude/projects/`
- Verify tmux session name matches

### High API Costs
- Verify Gemini caching is working (check logs)
- Consider increasing check interval
- Ensure you're using Gemini 2.5 Pro (supports caching)

### False Interventions
- Check workflow rules are up to date
- Verify the AI has proper context (todo file, workflow step)
- Review intervention in gemini logs directory

## Architecture

```
ai-monitor-cli
├── src/
│   ├── index.js          # CLI commands
│   ├── screen-monitor.js # Core monitoring logic
│   └── notification-manager.js # Alert system
├── tests/
│   ├── test-framework.js # Test infrastructure
│   ├── test-scenarios.js # 20 test cases
│   └── test-caching-costs.js # Cost analysis
└── docs/
    └── IMPROVEMENTS.md   # Recent changes
```

## License

Part of PersonalAgents project. See main repository for license details.