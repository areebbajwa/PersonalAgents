# Workflow Design Guide

A comprehensive guide for creating and converting workflows for the workflow-cli tool based on learned best practices.

## Core Philosophy

The workflow-cli exists to help AI assistants stay focused by providing **only the relevant rules for the current step** while maintaining essential global principles. This prevents information overload and keeps the AI on track.


## Workflow Structure

### YAML Format Requirements

All workflows must be in clean YAML format for easy parsing:

```yaml
name: "Workflow Name"
description: "Brief description of when to use this workflow"
steps:
  - number: 1
    title: "Step Title"
    content: |
      Step-specific content here
    mandatory: true/false
    
global_rules:
  - title: "Rule Category"
    content: |
      Rule content that applies to ALL steps
      
quick_reference:
  essential_commands:
    - "command 1"
    - "command 2"
    
emergency_procedures:
  - title: "Emergency Type"
    commands:
      - "command 1"
      - "command 2"
```

## Global Rules Best Practices

### What SHOULD Be Global Rules

Global rules are re-iterated with every step, so they must be:

1. **Universal Principles** - Apply to literally every step
   - Core workflow principles (simplify ruthlessly, test everything, etc.)
   - Critical "never do" rules that could break things
   - Essential mindset/approach guidelines

2. **Safety Rules** - Things that could cause damage if forgotten
   - Never proceed with failing tests
   - Never mark tasks complete without E2E testing

3. **Keep It Minimal** - Aim for 2-4 global rule sections
   - Each section should have 5-7 items max
   - Combine related rules to reduce redundancy
   - If you have 10+ rule sections, consolidate them

### What Should NOT Be Global Rules

1. **Step-Specific Guidance** 
   - File operation details → Move to implementation steps
   - Testing procedures → Move to testing steps
   - Git workflow commands → Move to git setup steps

2. **Contextual Information**
   - API key management → Move to setup/configuration steps
   - Tool-specific instructions → Move to relevant usage steps
   - Validation procedures → Move to validation steps

## Step Design Principles

### 1. Rules Must Appear When First Needed

**CRITICAL**: Place rules in the earliest step where they're used, not where they're most relevant:

```yaml
# WRONG: File rules in implementation step
- number: 6
  title: "Implement Features"
  content: |
    **File Operations:**
    - NEVER rename __init__.py files
    - Don't rename config files

# RIGHT: File rules in first step that touches files
- number: 3
  title: "Research Context"  
  content: |
    Before reading any files:
    
    **File Operations (for all subsequent steps):**
    - NEVER rename __init__.py files (breaks Python imports)
    - Don't rename config files referenced by scripts
    
    Now search these locations:
    1. Check docs/ for documentation
    2. Look in config/.env for API keys
```

### 2. Eliminate Rule Duplication

**Anti-Pattern**: Rules repeated across multiple steps
```yaml
# DON'T: Same rules in multiple steps
- number: 3
  content: "File operations: Never rename config files"
- number: 6  
  content: "File operations: Never rename config files"
- number: 8
  content: "File operations: Never rename config files"
```

**Best Practice**: Rules appear once in earliest needed step
```yaml
# DO: Rules appear once when first needed
- number: 3
  title: "Foundation Setup"
  content: |
    **File Operations (apply to all subsequent steps):**
    - NEVER rename __init__.py files
    - Don't rename config files
    - Use existing utilities over creating new ones
    
    Now apply these rules as you:
    1. Search existing documentation
    2. Check configuration files

- number: 6
  title: "Implement Features"
  content: |
    Implementation guidelines (see Step 3 for file operations):
    
    **CLI Tool Development:**
    - Test with real data, not just help commands
    - Create executable wrapper scripts
```

### 3. Make Steps Actionable and Self-Contained

Each step should have clear actions AND all rules needed for those actions:

```yaml
- number: 3
  title: "Research Context"
  content: |
    **Rules for this research phase:**
    - Check config/.env for API keys first (never ask user)
    - Search todos/completed/ for personal information
    - Prioritize existing utilities over new implementations
    
    **Actions to take:**
    1. Search docs/ for relevant documentation
    2. Check todos/completed/ for similar past tasks  
    3. Look in config/.env for API keys and credentials
    4. Search for existing utilities to reuse
    5. Check LEARNINGS.md for proven patterns
    
    **Don't proceed until you have:**
    - Understanding of existing codebase patterns
    - Location of all needed credentials
    - List of reusable components
```

### 4. Best Practices for Specific Workflow Components

**Planning Steps:**
- Include batch operation examples with code
- Reinforce test gates and commit patterns
- Integrate todo file management instructions
- Call workflow-cli --next only after todo completion

**Implementation Steps:**
- Focus on action items, not rules
- Reference earlier steps for shared guidelines
- Include "never give up" reminders for autonomy
- Combine related steps (e.g., test tracking with implementation)

**Final Steps:**
- Dynamic branch detection (not hardcoded "main")
- Project state cleanup commands
- User confirmation for destructive actions

**Git Workflow:**
- Use project-based branch naming: `[project-name]-YYYYMMDD`
- Combine announcement with git setup when logical
- Include instructions for continuing existing work

### 5. Use Progressive Rule Introduction

Introduce rules when they become relevant, but ensure dependencies are met:

```yaml
# Step 2: Basic rules
- number: 2
  content: |
    **Git Workflow Rules:**
    - Never commit without permission
    - Always create feature branches
    
# Step 5: Advanced rules that build on Step 2
- number: 5  
  content: |
    **Testing Rules (use Git rules from Step 2):**
    - Never commit failing tests
    - Mark tests as passed before committing
    
# Step 8: Completion rules that reference earlier steps  
- number: 8
  content: |
    **Final Steps (follow Git rules from Step 2, Testing from Step 5):**
    - Run full test suite
    - Commit with test status
```

## Project-Based State Management

### State Isolation Benefits

- Each project maintains separate workflow progress
- Multiple projects can run simultaneously without conflicts
- State persists between AI sessions
- Mode is remembered per project

### Project Naming Guidelines

```bash
# Good project names
workflow-cli --project bug-fix-auth-123
workflow-cli --project feature-dark-mode
workflow-cli --project refactor-api-client

# Avoid generic names
workflow-cli --project task1
workflow-cli --project work
workflow-cli --project temp
```

### Git Branch Naming

Branches should follow project naming:
```bash
git checkout -b [project-name]-YYYYMMDD
```

### Project State Management

- Use `workflow-cli --project [name] --clean` to delete project state after completion
- State cleanup is included in final workflow steps

## Converting Existing Workflows

### Step 1: Analyze Current Structure

1. **Identify Global vs Step-Specific Rules**
   - What applies to every single step? → Keep global
   - What applies to specific activities? → Move to steps

2. **Look for Rule Duplication**
   - Are the same rules repeated in multiple places?
   - Can they be consolidated into relevant steps?

3. **Check for Information Overload**
   - Are there 20+ global rules? → Most should move to steps
   - Do steps have 50+ lines of rules? → May need splitting

### Step 2: Reorganize Rules

```yaml
# BEFORE: Too many global rules
global_rules:
  - File operations (20 rules)
  - Testing procedures (15 rules)  
  - Git workflow (10 rules)
  - API management (8 rules)
  - CLI development (12 rules)

# AFTER: Minimal global, distributed to steps
global_rules:
  - Core principles (7 rules)
  - Critical safety rules (5 rules)

steps:
  - number: 2
    title: "Setup Git Workflow"
    content: |
      Git-specific rules here...
  
  - number: 6
    title: "Implement Features"
    content: |
      File operations and CLI development rules here...
      
  - number: 8
    title: "Test Implementation"
    content: |
      Testing procedures here...
```

### Step 3: Eliminate External Dependencies

- **Remove references to additional_rules.md or other external files**
- **Integrate all rules directly into workflow steps**
- **Ensure workflows are self-contained**

### Step 4: Test and Validate

```bash
# Test the workflow works
workflow-cli --project test-workflow --mode [mode] --step 1

# Verify rule distribution
workflow-cli --project test-workflow --mode [mode] --step 1 | wc -l
workflow-cli --project test-workflow --next | wc -l

# Check for errors
python3 test_workflow_cli.py
```

## Creating New Workflows

### 1. Define the Workflow Purpose

- When should this workflow be used?
- What type of tasks does it handle?
- How does it differ from existing workflows?

### 2. Identify the Core Steps

```yaml
steps:
  1. Announce Mode & Git Setup (combine when logical)
  2. Gather Context/Setup
  3-N. Main workflow steps
  N+1. Clean Up Environment
  N+2. Final Verification
  N+3. Branch Management (always last)
```

### 3. Distribute Rules Appropriately

- **Start with minimal global rules** (2-4 sections max)
- **Add step-specific rules where they're used**
- **Include emergency procedures for critical workflows**
- **Integrate batch operation examples in planning steps where relevant**
- **Add automation tool guidance if workflow requires it**
- **Emphasize autonomous completion with 2FA as only exception**

### 4. Add Quick Reference

Keep it minimal - only the most essential items:

```yaml
quick_reference:
  essential_commands:
    - "workflow-cli --project [name] --next"
    - "workflow-cli --project [name] --clean"
```

## Quality Checklist

Before deploying a workflow, verify:

### ✅ Structure
- [ ] Uses clean YAML format
- [ ] Has meaningful step titles
- [ ] Each step is actionable
- [ ] Emergency procedures included if needed

### ✅ Global Rules
- [ ] 2-4 global rule sections maximum
- [ ] Keep each section concise (5-7 items max)
- [ ] Only truly universal principles
- [ ] No step-specific guidance in global rules
- [ ] All critical safety rules included
- [ ] Include automation tool hierarchy when needed

### ✅ Step Distribution
- [ ] Step-specific rules moved to appropriate steps
- [ ] No external file dependencies
- [ ] Each step is self-contained
- [ ] Rules appear where they're actually needed

### ✅ Testing
- [ ] YAML syntax is valid
- [ ] Workflow-cli can parse the file
- [ ] All steps are accessible
- [ ] Test suite passes

## Removing Redundancy

### Rule Placement Analysis

Before creating or updating workflows, map out when rules are first needed:

```
Step 1: Announce Mode          → No rules needed
Step 2: Setup Git             → Git rules needed here
Step 3: Research Context      → File operations, API keys needed here  
Step 4: Plan                  → Planning rules needed here
Step 5: Testing Setup         → Testing rules needed here
Step 6: Implementation        → CLI development rules needed here
Step 7: Test Execution        → Uses Step 5 testing rules
Step 8: Validation           → Uses Step 3 file rules, Step 5 testing rules
```

### Redundancy Elimination Checklist

For each rule, ask:
- [ ] **When is this rule first needed?** → Place it there
- [ ] **Is this rule already covered elsewhere?** → Remove duplication  
- [ ] **Does this rule apply to all steps?** → Consider making it global
- [ ] **Can later steps reference earlier rules?** → Use references instead of repetition

### Reference Pattern

Instead of duplicating rules, use references:

```yaml
# Step 3: Define the rules
- number: 3
  title: "Setup Foundation"
  content: |
    **File Operations (for all subsequent steps):**
    - NEVER rename __init__.py files
    - Don't rename config files
    - Check existing files before creating new ones

# Step 6: Reference earlier rules
- number: 6
  title: "Implement Features"  
  content: |
    Implementation guidelines (follow File Operations from Step 3):
    
    **CLI Tool Specific Rules:**
    - Test with real data, not just help commands
    - Create wrapper scripts for Node.js tools
```

## Task Completion Philosophy

### Autonomous Completion

Workflows should emphasize autonomous task completion:

1. **Never Give Up** - AI must find a way to complete the entire todo list
2. **2FA Exception** - Only acceptable reason to ask for help
3. **Tool Escalation Path**:
   - Check existing tools (CLI tools, MCP tools)
   - Official APIs (preferred)
   - Selenium browser (for auth/setup/unsupported features)
   - Screenshot-cli (for debugging/exploration)
   - Desktop-automation-cli (last resort)

### Todo File Management

Replace traditional learning files with project-specific todo files:

1. **File Format**: `todos/YYYYMMDD-[project-name]-todo.md`
2. **Status Emojis**:
   - ✅ Task completed
   - 🕒 Task pending (not ❌ which implies failure)
   - 🔥 BREAKTHROUGH: Log solutions to difficult problems
3. **Purpose**: Track progress and capture learnings to avoid repeated mistakes

### Automation Tool Hierarchy

Workflows should provide clear escalation paths:

1. **Check existing tools**:
   - Look for CLI tools in the codebase
   - Check available MCP tools and resources
2. **Official APIs** (always preferred)
3. **Selenium/Browser automation** (for auth, setup, unsupported features)
4. **Screenshot tools** (for debugging/exploration)
5. **Desktop automation** (last resort)

### CLI Tool Development Strategy

When new CLI tools are needed:
- Spawn a new agent with dev mode workflow
- Add CLI development as a task in the main todo list
- Keep task execution separate from tool development

## Common Anti-Patterns to Avoid

### ❌ Rule Duplication Across Steps
```yaml
# DON'T: Same rules in multiple steps
- number: 3
  content: "Never rename config files"
- number: 6  
  content: "Never rename config files"
- number: 8
  content: "Never rename config files"

# DO: Rules appear once when first needed
- number: 3
  content: "File Operations (for all steps): Never rename config files"
- number: 6
  content: "Implementation (see Step 3 for file rules): [specific implementation rules]"
```

### ❌ Global Rule Overload
```yaml
# DON'T: 50+ global rules
global_rules:
  - file_operations: [20 rules]
  - testing: [15 rules] 
  - git: [10 rules]
  - cli_development: [12 rules]

# DO: Minimal global rules, rest step-specific
global_rules:
  - core_principles: [5 essential principles]
  - critical_safety: [3 never-do rules]
```

### ❌ External Dependencies
```yaml
# DON'T: References to external files
content: |
  Check additional_rules.md for guidelines
  See LEARNINGS.md for patterns

# DO: Self-contained workflows
content: |
  Search existing implementations before proceeding:
  1. Check codebase for patterns
  2. Look in todos/ for previous learnings
```

### ❌ Vague Steps
```yaml
# DON'T: Unclear actions
- title: "Do the work"
  content: "Complete the task as needed"

# DO: Specific actions  
- title: "Implement API Client"
  content: |
    1. Create client class with error handling
    2. Implement authentication
    3. Add request/response validation
    4. Write integration tests
```

### ❌ Step Overload
```yaml
# DON'T: 100+ lines per step with everything
content: |
  [Massive wall of text with every possible rule]

# DO: Focused step-specific guidance
content: |
  **Rules for this step:** [only rules needed here]
  **Actions:** [specific actions]
  **References:** [point to earlier steps for shared rules]
```

### ❌ Redundant Workflow Components
```yaml
# DON'T: Unnecessary sections
workflow_checklist:
  before_starting: [duplicate of steps]
  during_development: [duplicate of steps]
  
# DON'T: Verbose reference sections  
commit_prefixes:
  - prefix: "feat"
    description: "New feature"
  [... 10 more entries]

# DO: Minimal, essential references only
quick_reference:
  essential_commands:
    - "workflow-cli --project [name] --next"
```

## Maintenance

### Regular Review
- Monitor which rules are frequently needed across steps
- Look for opportunities to consolidate or clarify
- Remove outdated or unused guidance

### User Feedback Integration  
- When users provide feedback about workflows
- Update the specific step where the issue occurred
- Avoid adding to global rules unless truly universal

### Version Control
- Keep workflows in git for change tracking
- Document major changes in commit messages
- Test changes before deploying


---

*This guide should be the definitive reference for creating effective, focused workflows that help AI assistants stay on task without information overload.*