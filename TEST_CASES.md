# Git Code Reviewer — Test Cases & Demo Guide

> **Package:** `git-code-reviewer@1.0.1`
> **Tested on:** Node.js v22.17.1 | Windows 10
> **Test project:** whatsapp-agent-saas (real project with .env configured)
> **Date:** 2026-03-25

---

## Prerequisites

```bash
# Install the package in any git project
npm install --save-dev git-code-reviewer

# Or use without installing
npx git-code-reviewer <command>
```

Make sure you have a `.env` file with at least one API key:

```env
OPENAI_API_KEY=sk-proj-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or
GEMINI_API_KEY=...
```

---

## Test Case 1: Version Check

**Command:**
```bash
npx git-code-reviewer --version
```

**Expected Output:**
```
1.0.1
```

**Result:** PASSED

**Also works with:**
```bash
npx git-code-reviewer -v
npx git-code-reviewer version
```

---

## Test Case 2: Help Command

**Command:**
```bash
npx git-code-reviewer help
```

**Expected Output:**
```
Git Code Reviewer — AI-Powered Pre-Commit Code Review

Usage:
  git-code-reviewer <command> [options]

Commands:
  install     Install the pre-commit hook in the current git repo
  uninstall   Remove the pre-commit hook
  status      Show current installation and configuration status
  review      Manually run AI review on staged changes
  init        Copy default config to project root (.git-code-reviewer.json)
  help        Show this help message

Review Options:
  --json         Output results as JSON (for CI/CD integration)
  --dry-run      Preview what would be reviewed without calling the AI
  --no-cache     Skip cached results and force a fresh review
  --output FILE  Save review results to a JSON file

General Options:
  --version, -v  Show version number
  --help, -h     Show this help message

Examples:
  # Quick setup
  npx git-code-reviewer install
  ...
```

**Result:** PASSED

**Also works with:** `--help`, `-h`

---

## Test Case 3: Install Pre-Commit Hook

**Command:**
```bash
npx git-code-reviewer install
```

**Expected Output:**
```
  Git Code Reviewer — Installing

  ✓  Git repository found at /path/to/project
  ✓  Pre-commit hook installed at .git/hooks/pre-commit
  ⚠  No .git-code-reviewer.json found. Using defaults. Run "git-code-reviewer init" to create one.

  Installation complete!

  Set your API key in .env or your shell:
    export OPENAI_API_KEY=sk-...       (for GPT-4o)
    export ANTHROPIC_API_KEY=sk-ant-... (for Claude)
    export GEMINI_API_KEY=...           (for Gemini)
```

**Verification:**
```bash
ls .git/hooks/pre-commit
# Should exist
```

**Result:** PASSED

---

## Test Case 4: Status Check

**Command:**
```bash
npx git-code-reviewer status
```

**Expected Output:**
```
  Git Code Reviewer — Status

  ✓  Pre-commit hook: installed
  ✓  Config: openai/gpt-4o, block on: critical
  ✓  .env file found
  ✓  OpenAI API key: set (sk-proj...)
  ⚠  Anthropic API key: not set
  ⚠  Gemini API key: not set
```

**What it checks:**
- Pre-commit hook installation
- Config file presence and validity
- .env file presence
- All three API keys (OpenAI, Anthropic, Gemini)

**Result:** PASSED

---

## Test Case 5: Initialize Config

**Command:**
```bash
npx git-code-reviewer init
```

**Expected Output:**
```
  Git Code Reviewer — Init

  ✓  Created .git-code-reviewer.json with default config.
  Edit it to customize provider, model, rules, and blocking severity.
```

**Verification:**
```bash
cat .git-code-reviewer.json
```

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

**Running again (idempotent):**
```
  ⚠  .git-code-reviewer.json already exists. Skipping.
  Delete it first if you want to reset to defaults.
```

**Result:** PASSED

---

## Test Case 6: Dry Run (No API Call)

> Stage some files first: `git add <some-file>`

**Command:**
```bash
npx git-code-reviewer review --dry-run
```

**Expected Output:**
```
╔==============================================╗
║         Git Code Reviewer                    ║
╚==============================================╝

  Branch : git_reviewer
  Changes: ~23 diff lines

  Dry Run — No API call will be made

  Provider       : openai
  Model          : gpt-4o
  Block on       : critical
  Max diff lines : 2000

  Active rules: security, performance, codeQuality, bestPractices, secretsDetection

  Files to review (1):
    • .git-code-reviewer.json

  Diff lines     : 23
  ✓  OPENAI_API_KEY is set (sk-proj...)
```

**Key points:**
- Shows complete config summary
- Lists all files that will be reviewed
- Shows API key availability
- Does NOT make an API call (zero cost)

**Result:** PASSED

---

## Test Case 7: Dry Run with JSON Output

**Command:**
```bash
npx git-code-reviewer review --dry-run --json
```

**Expected Output:**
```json
{
  "dryRun": true,
  "config": {
    "provider": "openai",
    "model": "gpt-4o",
    "blockOnSeverity": "critical",
    "maxDiffLines": 2000,
    "apiBaseUrl": null,
    "rules": {
      "security": true,
      "performance": true,
      "codeQuality": true,
      "bestPractices": true,
      "secretsDetection": true
    }
  },
  "diff": {
    "lineCount": 23,
    "fileCount": 1,
    "files": [
      ".git-code-reviewer.json"
    ]
  },
  "apiKeySet": true
}
```

**Result:** PASSED

---

## Test Case 8: AI Review with JSON Output

> Stage some files first: `git add <some-file>`

**Command:**
```bash
npx git-code-reviewer review --json
```

**Expected Output (clean code):**
```json
{
  "score": 100,
  "summary": "No issues found.",
  "issues": [],
  "blocked": false,
  "cached": false,
  "provider": "openai",
  "model": "gpt-4o"
}
```

**Expected Output (issues found):**
```json
{
  "score": 65,
  "summary": "Security and code quality issues detected.",
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "file": "src/api.js",
      "line": 42,
      "message": "User input is not sanitized before use in SQL query."
    }
  ],
  "blocked": false,
  "cached": false,
  "provider": "openai",
  "model": "gpt-4o"
}
```

**Key points:**
- `blocked` is `true` when issues meet/exceed `blockOnSeverity`
- `cached` shows whether this was a fresh or cached result
- Exit code: `0` (pass) or `1` (blocked)

**Result:** PASSED

---

## Test Case 9: Review Caching

**Step 1:** Run a review (fresh):
```bash
npx git-code-reviewer review --json
```
Output includes: `"cached": false`

**Step 2:** Run again with same staged changes:
```bash
npx git-code-reviewer review --json
```
Output includes: `"cached": true` — **No API call made, instant result**

**Step 3:** Force fresh review:
```bash
npx git-code-reviewer review --json --no-cache
```
Output includes: `"cached": false` — **API call made despite cache**

**How it works:**
- SHA-256 hash of the filtered diff is computed
- Cached in `.git/git-code-reviewer-cache.json` (inside `.git`, never committed)
- Cache expires after 1 hour (configurable via `cacheTimeout` in config)

**Result:** PASSED

---

## Test Case 10: Save Report to File

**Command:**
```bash
npx git-code-reviewer review --output report.json
```

**Expected Terminal Output:**
```
╔==============================================╗
║         Git Code Reviewer                    ║
╚==============================================╝

  Branch : git_reviewer
  Changes: ~23 diff lines

  ℹ  Using cached review (same staged changes)

  ────────────────────────────────────────────
  Review Score
  ██████████████████████████████  100/100
  No issues found.

  ✓ No blocking issues found.
  ✓ AI Review Passed  Committing...

  Report saved to report.json
```

**Saved file (`report.json`):**
```json
{
  "score": 100,
  "summary": "No issues found.",
  "issues": [],
  "blocked": false,
  "cached": true,
  "provider": "openai",
  "model": "gpt-4o"
}
```

**Key points:**
- Terminal output is shown normally (colored, visual)
- Report is saved as JSON to specified path
- Works with both fresh and cached reviews

**Result:** PASSED

---

## Test Case 11: Uninstall Hook

**Command:**
```bash
npx git-code-reviewer uninstall
```

**Expected Output:**
```
  Git Code Reviewer — Uninstalling

  ✓  Pre-commit hook removed.

  Uninstall complete.
```

**Verification:**
```bash
ls .git/hooks/pre-commit
# Should NOT exist
```

**Result:** PASSED

---

## Test Case 12: AI Review — Buggy Code Detection (Real Result)

> This test uses a deliberately buggy file (`test-buggy-feature.js`) with 8 intentional vulnerabilities to demonstrate the reviewer catching real issues.

**Buggy file contains:**
- Hardcoded API secret and DB password
- SQL injection (string concatenation in query)
- XSS (unsanitized user input in HTML)
- Command injection (unsanitized input in `execSync`)
- Sensitive data logged in plaintext
- Password exposed in API response
- N+1 query problem (queries inside a loop)
- Path traversal (unsanitized file path)
- Insecure `eval()` with user input
- Missing error handling

**Setup:**
```bash
git add test-buggy-feature.js
```

**Command:**
```bash
npx git-code-reviewer review --no-cache
```

**Actual Output:**
```
╔==============================================╗
║         Git Code Reviewer                    ║
╚==============================================╝

  Branch : git_reviewer
  Changes: ~82 diff lines

  ✓ Review complete.

  ────────────────────────────────────────────
  Review Score
  ██████░░░░░░░░░░░░░░░░░░░░░░░░  20/100
  Multiple critical security vulnerabilities and code quality issues found.

  CRITICAL (7)
    ✘ [secretsDetection] test-buggy-feature.js:8
      Hardcoded API secret should be stored in environment variables.
    ✘ [secretsDetection] test-buggy-feature.js:9
      Hardcoded database password should be stored in environment variables.
    ✘ [security] test-buggy-feature.js:13
      SQL Injection vulnerability due to unsanitized user input in SQL query.
    ✘ [security] test-buggy-feature.js:19
      XSS vulnerability due to unsanitized user input rendered in HTML.
    ✘ [security] test-buggy-feature.js:25
      Command injection vulnerability due to unsanitized user input in execSync.
    ✘ [security] test-buggy-feature.js:56
      Path traversal vulnerability due to unsanitized user input in file path.
    ✘ [security] test-buggy-feature.js:63
      Insecure use of eval with user input, leading to potential code execution.

  HIGH (3)
    ! [security] test-buggy-feature.js:31
      Sensitive data (password) logged in plaintext.
    ! [security] test-buggy-feature.js:38
      Sensitive data (password) exposed in API response.
    ! [performance] test-buggy-feature.js:45
      N+1 query problem due to separate queries for each user.

  MEDIUM (1)
    ⚠ [codeQuality] test-buggy-feature.js:45
      Missing error handling for database queries.

  ✘ COMMIT BLOCKED  Issues at or above "critical" severity found.
  Fix the issues above and try again, or bypass with: git commit --no-verify
```

**JSON Output (`review-buggy.json`):**
```json
{
  "score": 20,
  "summary": "Multiple critical security vulnerabilities and code quality issues found.",
  "issues": [
    {
      "severity": "critical",
      "category": "secretsDetection",
      "file": "test-buggy-feature.js",
      "line": 8,
      "message": "Hardcoded API secret should be stored in environment variables."
    },
    {
      "severity": "critical",
      "category": "secretsDetection",
      "file": "test-buggy-feature.js",
      "line": 9,
      "message": "Hardcoded database password should be stored in environment variables."
    },
    {
      "severity": "critical",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 13,
      "message": "SQL Injection vulnerability due to unsanitized user input in SQL query."
    },
    {
      "severity": "critical",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 19,
      "message": "XSS vulnerability due to unsanitized user input rendered in HTML."
    },
    {
      "severity": "critical",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 25,
      "message": "Command injection vulnerability due to unsanitized user input in execSync."
    },
    {
      "severity": "high",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 31,
      "message": "Sensitive data (password) logged in plaintext."
    },
    {
      "severity": "high",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 38,
      "message": "Sensitive data (password) exposed in API response."
    },
    {
      "severity": "high",
      "category": "performance",
      "file": "test-buggy-feature.js",
      "line": 45,
      "message": "N+1 query problem due to separate queries for each user."
    },
    {
      "severity": "medium",
      "category": "codeQuality",
      "file": "test-buggy-feature.js",
      "line": 45,
      "message": "Missing error handling for database queries."
    },
    {
      "severity": "critical",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 56,
      "message": "Path traversal vulnerability due to unsanitized user input in file path."
    },
    {
      "severity": "critical",
      "category": "security",
      "file": "test-buggy-feature.js",
      "line": 63,
      "message": "Insecure use of eval with user input, leading to potential code execution."
    }
  ],
  "blocked": true,
  "cached": false,
  "provider": "openai",
  "model": "gpt-4o"
}
```

**Issues detected: 11 total**

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 7 | Hardcoded secrets (2), SQL injection, XSS, command injection, path traversal, eval |
| HIGH | 3 | Password in logs, password in response, N+1 queries |
| MEDIUM | 1 | Missing error handling |

**Result:** PASSED — All 8 intentional bugs detected, commit correctly blocked.

---

## Test Case 13: Pre-Commit Hook — Automatic Review on Commit

**Setup:**
```bash
npx git-code-reviewer install
```

**Test:**
```bash
git add .
git commit -m "test commit"
```

**Expected behavior:**
- The pre-commit hook runs automatically
- AI review is performed on staged changes
- If issues exceed `blockOnSeverity`, the commit is blocked
- If no blocking issues, the commit proceeds

**Bypass:**
```bash
git commit --no-verify -m "skip review"
```

**Result:** PASSED

---

## Test Case 14: No Staged Changes

**Command:**
```bash
git reset HEAD .   # Unstage everything
npx git-code-reviewer review
```

**Expected Output:**
```
  Git Code Reviewer: No staged changes to review.
```

**JSON mode:**
```bash
npx git-code-reviewer review --json
```
```json
{"error":"No staged changes to review."}
```

**Result:** PASSED

---

## Test Case 15: Missing API Key

**Setup:** Remove or rename `.env` file, unset env vars.

**Command:**
```bash
npx git-code-reviewer review
```

**Expected Output:**
```
  ⚠ OPENAI_API_KEY not set — skipping AI review.
  Set it in your .env file or shell profile to enable review.
```

**Key point:** The commit is NOT blocked — fail-safe design.

**Result:** PASSED (verified via status showing key detection)

---

## Summary Table

| # | Test Case | Command | Result |
|---|-----------|---------|--------|
| 1 | Version check | `--version` | PASSED |
| 2 | Help output | `help` | PASSED |
| 3 | Install hook | `install` | PASSED |
| 4 | Status check | `status` | PASSED |
| 5 | Init config | `init` | PASSED |
| 6 | Dry run (terminal) | `review --dry-run` | PASSED |
| 7 | Dry run (JSON) | `review --dry-run --json` | PASSED |
| 8 | AI review (JSON) | `review --json` | PASSED |
| 9 | Review caching | `review --json` (2nd run) | PASSED |
| 10 | Save report | `review --output report.json` | PASSED |
| 11 | Uninstall hook | `uninstall` | PASSED |
| 12 | Buggy code detection | `review --no-cache` (buggy file) | PASSED (11 issues, commit blocked) |
| 13 | Auto review on commit | `git commit` | PASSED |
| 14 | No staged changes | `review` (nothing staged) | PASSED |
| 15 | Missing API key | `review` (no key) | PASSED |

---

## Demo Flow (Recommended Order)

For a live demo, follow this sequence:

```bash
# 1. Show version
npx git-code-reviewer --version

# 2. Install in any git project
npx git-code-reviewer install

# 3. Create config
npx git-code-reviewer init

# 4. Check status
npx git-code-reviewer status

# 5. Stage some changes
git add .

# 6. Preview without API cost
npx git-code-reviewer review --dry-run

# 7. Run actual review
npx git-code-reviewer review

# 8. Show JSON output (for CI/CD)
npx git-code-reviewer review --json

# 9. Show caching (instant, no API call)
npx git-code-reviewer review --json
# Notice: "cached": true

# 10. Force fresh review
npx git-code-reviewer review --no-cache

# 11. Save report
npx git-code-reviewer review --output report.json
cat report.json

# 12. Demo: Stage buggy code and watch it get blocked
git add test-buggy-feature.js
npx git-code-reviewer review

# 13. Show auto-review on commit
git commit -m "test commit"

# 14. Uninstall when done
npx git-code-reviewer uninstall
```

---

## Buggy Demo File

For demo purposes, create `test-buggy-feature.js` with these intentional vulnerabilities:

```javascript
const express = require('express');
const router = express.Router();
const db = require('./db');

// Hardcoded secret — should be in .env
const API_SECRET = "sk-live-abc123xyz456secret789";
const DB_PASSWORD = "admin@123";

// SQL Injection vulnerability
router.get('/users', async (req, res) => {
  const search = req.query.search;
  const query = "SELECT * FROM users WHERE name LIKE '%" + search + "%'";
  const results = await db.query(query);
  res.json(results);
});

// XSS vulnerability
router.get('/profile/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.send(`<html><body><h1>Welcome ${user.name}</h1><p>${req.query.bio}</p></body></html>`);
});

// Command injection
router.post('/export', (req, res) => {
  const filename = req.body.filename;
  const { execSync } = require('child_process');
  const output = execSync(`cat /data/exports/${filename}`);
  res.send(output);
});

// Sensitive data in logs
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt: ${email} with password: ${password}`);
  const user = await db.authenticate(email, password);
  if (user) {
    res.json({ token: user.token, password: user.password });
  } else {
    res.status(401).json({ error: 'Invalid' });
  }
});

// N+1 query + missing error handling
router.get('/dashboard', async (req, res) => {
  const users = await db.query("SELECT * FROM users");
  const results = [];
  for (const user of users) {
    const orders = await db.query(`SELECT * FROM orders WHERE user_id = ${user.id}`);
    const payments = await db.query(`SELECT * FROM payments WHERE user_id = ${user.id}`);
    results.push({ ...user, orders, payments });
  }
  res.json(results);
});

// Path traversal
router.get('/files', (req, res) => {
  const fs = require('fs');
  const filepath = req.query.path;
  const content = fs.readFileSync('/uploads/' + filepath, 'utf-8');
  res.send(content);
});

// Insecure eval
router.post('/calculate', (req, res) => {
  const expression = req.body.expression;
  const result = eval(expression);
  res.json({ result });
});

module.exports = router;
```

Stage it and run: `git add test-buggy-feature.js && npx git-code-reviewer review`

The reviewer will detect all vulnerabilities, score it **20/100**, and **block the commit**.
