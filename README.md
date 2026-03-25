# Git Code Reviewer

**AI-Powered Pre-Commit Code Reviewer**

[![npm version](https://img.shields.io/npm/v/git-code-reviewer.svg)](https://www.npmjs.com/package/git-code-reviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

Automatically review your staged changes for security vulnerabilities, performance issues, code quality problems, and best practice violations before every commit. Powered by OpenAI (GPT-4o), Anthropic (Claude), or Google Gemini.

---

## What It Does

Git Code Reviewer installs a pre-commit hook that sends your staged diff to an AI model for analysis. It catches problems before they reach your codebase.

| Feature | Description |
|---|---|
| **Secrets Detection** | Catches API keys, tokens, passwords, and credentials before they get committed |
| **Security Analysis** | Identifies SQL injection, XSS, path traversal, command injection, SSRF, and OWASP Top 10 vulnerabilities |
| **Performance Review** | Flags N+1 queries, blocking async calls, memory leaks, and inefficient patterns |
| **Code Quality** | Detects missing error handling, dead code, high complexity, and unclear logic |
| **Best Practices** | Checks for missing input validation, sensitive data in logs, hardcoded values, and missing rate limits |
| **Smart Diff Filtering** | Skips lock files, minified files, build artifacts, and entirely deleted files |
| **Configurable Blocking** | Choose which severity level blocks commits (critical, high, medium, low, or never) |
| **Multi-Provider** | Works with OpenAI (GPT-4o), Anthropic (Claude), or Google Gemini |
| **Review Caching** | Avoids duplicate API calls when retrying with the same staged changes |
| **CI/CD Ready** | `--json` output for pipeline integration, `--output` for report export |
| **Custom API Base URL** | Use OpenAI-compatible proxies or local LLMs (Ollama, LM Studio) |
| **Zero Dependencies** | Uses native Node.js `fetch` and `child_process` — nothing to install |

---

## Quick Start

### One-command setup (no install needed)

```bash
npx git-code-reviewer install
```

### Global install

```bash
npm install -g git-code-reviewer
cd your-project
git-code-reviewer install
```

That's it. Set your API key, and every `git commit` will be reviewed automatically.

---

## Installation

### 1. Install the package

```bash
# Global (recommended for personal use)
npm install -g git-code-reviewer

# Local (recommended for team projects)
npm install --save-dev git-code-reviewer
```

### 2. Install the pre-commit hook

```bash
git-code-reviewer install
```

### 3. Set your API key

Create a `.env` file in your project root (see `.env.example`):

```env
# For OpenAI (default)
OPENAI_API_KEY=sk-...

# For Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# For Google Gemini
GEMINI_API_KEY=...
```

Or set it in your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export OPENAI_API_KEY=sk-...
```

### 4. (Optional) Customize config

```bash
git-code-reviewer init
```

This creates `.git-code-reviewer.json` in your project root. Edit it to change the provider, model, rules, or blocking severity.

---

## CLI Commands

| Command | Description |
|---|---|
| `git-code-reviewer install` | Install the pre-commit hook in the current repo |
| `git-code-reviewer uninstall` | Remove the pre-commit hook (restores backup if one exists) |
| `git-code-reviewer status` | Show hook status, config, and API key availability |
| `git-code-reviewer review` | Manually run AI review on currently staged changes |
| `git-code-reviewer init` | Copy default config to `.git-code-reviewer.json` |
| `git-code-reviewer help` | Show help and usage information |
| `git-code-reviewer --version` | Show the package version |

### Review Options

| Flag | Description |
|---|---|
| `--json` | Output results as structured JSON (for CI/CD pipelines) |
| `--dry-run` | Preview config, files, and diff stats without calling the AI |
| `--no-cache` | Skip cached results and force a fresh AI review |
| `--output <file>` | Save review results to a JSON file |

**Examples:**

```bash
# Standard review
git add .
git-code-reviewer review

# JSON output for CI/CD
git-code-reviewer review --json

# Preview what will be reviewed
git-code-reviewer review --dry-run

# Save report to file
git-code-reviewer review --output report.json

# Force fresh review (skip cache)
git-code-reviewer review --no-cache
```

---

## Configuration

Create `.git-code-reviewer.json` in your project root (or run `git-code-reviewer init`):

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "blockOnSeverity": "critical",
  "maxDiffLines": 2000,
  "apiBaseUrl": null,
  "cacheTimeout": 3600000,
  "skipPatterns": ["*.lock", "*.min.js", "dist/*", "build/*", "node_modules/*", "*.map"],
  "rules": {
    "security": true,
    "performance": true,
    "codeQuality": true,
    "bestPractices": true,
    "secretsDetection": true
  }
}
```

### Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | string | `"openai"` | AI provider: `"openai"`, `"anthropic"`, or `"gemini"` |
| `model` | string | `"gpt-4o"` | Model name (e.g., `"gpt-4o"`, `"claude-sonnet-4-20250514"`, `"gemini-2.0-flash"`) |
| `blockOnSeverity` | string | `"critical"` | Block commits at this severity or above. Options: `"critical"`, `"high"`, `"medium"`, `"low"`, `"never"` |
| `maxDiffLines` | number | `2000` | Maximum diff lines to send to AI (larger diffs are truncated) |
| `apiBaseUrl` | string | `null` | Custom API base URL for proxies or local LLMs (e.g., `"http://localhost:11434"` for Ollama) |
| `cacheTimeout` | number | `3600000` | Cache expiry time in milliseconds (default: 1 hour). Set to `0` to disable caching |
| `skipPatterns` | array | See above | Glob patterns for files to skip (`*` matches one level, `**` matches recursively) |
| `rules.security` | boolean | `true` | Enable OWASP / vulnerability scanning |
| `rules.performance` | boolean | `true` | Enable performance issue detection |
| `rules.codeQuality` | boolean | `true` | Enable code quality checks |
| `rules.bestPractices` | boolean | `true` | Enable best practice validation |
| `rules.secretsDetection` | boolean | `true` | Enable secrets and credential detection |

### Using with Local LLMs

You can use Git Code Reviewer with OpenAI-compatible local LLMs:

```json
{
  "provider": "openai",
  "model": "llama3",
  "apiBaseUrl": "http://localhost:11434"
}
```

This works with Ollama, LM Studio, vLLM, or any server that exposes an OpenAI-compatible API.

---

## Bypass and Common Scenarios

| Scenario | Solution |
|---|---|
| Skip review for a single commit | `git commit --no-verify -m "message"` |
| Skip review for a merge commit | `git merge --no-verify` |
| Temporarily disable the hook | `git-code-reviewer uninstall` |
| Re-enable the hook | `git-code-reviewer install` |
| API key not set | Review is skipped gracefully (commit proceeds) |
| API call fails | Review is skipped gracefully (commit proceeds) |
| No staged changes | Review is skipped (nothing to review) |
| Large diff exceeds limit | Diff is truncated to `maxDiffLines` and reviewed |
| Same changes, retry commit | Cached result is used (no API call) |
| Force fresh review | `git-code-reviewer review --no-cache` |

---

## Team Setup

To use Git Code Reviewer across your team:

1. Add it as a dev dependency:

```bash
npm install --save-dev git-code-reviewer
```

2. Add a setup script to `package.json`:

```json
{
  "scripts": {
    "prepare": "git-code-reviewer install"
  }
}
```

The `prepare` script runs automatically after `npm install`, so every team member gets the hook installed when they set up the project.

3. Commit the config file:

```bash
git-code-reviewer init
git add .git-code-reviewer.json
git commit -m "Add AI code reviewer config"
```

4. Each team member sets their own API key in `.env` (make sure `.env` is in `.gitignore`).

---

## CI/CD Integration

Use the `--json` flag to integrate with CI/CD pipelines:

```bash
# In your CI script
npx git-code-reviewer review --json > review.json

# Or save directly
npx git-code-reviewer review --output review.json
```

The JSON output includes:

```json
{
  "score": 85,
  "summary": "Minor issues found.",
  "issues": [
    {
      "severity": "medium",
      "category": "security",
      "file": "src/api.js",
      "line": 42,
      "message": "User input is not sanitized before use in query."
    }
  ],
  "blocked": false,
  "cached": false,
  "provider": "openai",
  "model": "gpt-4o"
}
```

---

## How It Works

1. You run `git commit`
2. The pre-commit hook intercepts the commit
3. `git diff --cached` captures only staged changes
4. Entirely deleted files are excluded (no new code to review)
5. The diff is filtered (skip patterns) and truncated if needed
6. If the same diff was reviewed recently, the cached result is used
7. Otherwise, the diff is sent to your configured AI provider with security-focused prompts
8. The AI returns a score (0-100) and a list of issues with severity levels
9. Issues are displayed with color-coded output and a visual score bar
10. If any issue meets or exceeds `blockOnSeverity`, the commit is blocked
11. You fix the issues and commit again, or bypass with `--no-verify`

---

## Requirements

- Node.js 18+ (uses native `fetch`)
- Git
- An API key for OpenAI, Anthropic, or Google Gemini

---

## License

MIT License - Copyright (c) 2026 Salman Ansari

Built by **Salman Ansari**.
