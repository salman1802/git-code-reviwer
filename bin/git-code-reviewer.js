#!/usr/bin/env node

/**
 * Git Code Reviewer — CLI
 * AI-powered pre-commit code review tool.
 *
 * Usage:
 *   git-code-reviewer install     Install the pre-commit hook
 *   git-code-reviewer uninstall   Remove the pre-commit hook
 *   git-code-reviewer status      Check installation status
 *   git-code-reviewer review      Manually run AI review on staged changes
 *   git-code-reviewer init        Copy default config to project root
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { COLORS, ok, warn, fail, getGitRoot, loadEnv } = require('../lib/utils');

// ── Pre-commit hook content ──

const PRE_COMMIT_HOOK = `#!/bin/sh
# Git Code Reviewer — Pre-commit hook
# AI-powered code review before every commit
# Bypass with: git commit --no-verify

# Check if node is available
if ! command -v node >/dev/null 2>&1; then
  echo "  [Git Code Reviewer] Node.js not found. Skipping AI review."
  exit 0
fi

# Try npx (works for global installs)
if command -v npx >/dev/null 2>&1; then
  npx git-code-reviewer review
  exit $?
fi

# Fallback: try local node_modules
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_BIN="$PROJECT_ROOT/node_modules/.bin/git-code-reviewer"

if [ -f "$LOCAL_BIN" ]; then
  "$LOCAL_BIN" review
  exit $?
fi

echo "  [Git Code Reviewer] Could not find git-code-reviewer. Skipping AI review."
exit 0
`;

// ── Commands ──

function install() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}  Git Code Reviewer — Installing${COLORS.reset}\n`);

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    fail('Not a git repository. Run this from inside a git project.');
    process.exit(1);
  }

  ok(`Git repository found at ${gitRoot}`);

  // Install pre-commit hook
  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const existingHook = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf-8') : '';

  if (existingHook && !existingHook.includes('Git Code Reviewer')) {
    // Backup existing hook
    const backupPath = hookPath + '.backup';
    fs.writeFileSync(backupPath, existingHook);
    warn('Existing pre-commit hook backed up to .git/hooks/pre-commit.backup');
  }

  fs.writeFileSync(hookPath, PRE_COMMIT_HOOK);
  try {
    execSync(`chmod +x "${hookPath}"`);
  } catch {
    // Windows — chmod not available, that's fine
  }
  ok('Pre-commit hook installed at .git/hooks/pre-commit');

  // Check for config
  const configPath = path.join(gitRoot, '.git-code-reviewer.json');
  if (fs.existsSync(configPath)) {
    ok('Config found at .git-code-reviewer.json');
  } else {
    warn('No .git-code-reviewer.json found. Using defaults. Run "git-code-reviewer init" to create one.');
  }

  console.log(`\n${COLORS.green}${COLORS.bold}  Installation complete!${COLORS.reset}`);
  console.log(`\n  ${COLORS.dim}Set your API key in .env or your shell:${COLORS.reset}`);
  console.log(`    export OPENAI_API_KEY=sk-...       ${COLORS.dim}(for GPT-4o)${COLORS.reset}`);
  console.log(`    export ANTHROPIC_API_KEY=sk-ant-... ${COLORS.dim}(for Claude)${COLORS.reset}`);
  console.log(`    export GEMINI_API_KEY=...           ${COLORS.dim}(for Gemini)${COLORS.reset}\n`);
}

function uninstall() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}  Git Code Reviewer — Uninstalling${COLORS.reset}\n`);

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    fail('Not a git repository.');
    process.exit(1);
  }

  const hookPath = path.join(gitRoot, '.git', 'hooks', 'pre-commit');

  if (fs.existsSync(hookPath)) {
    const content = fs.readFileSync(hookPath, 'utf-8');
    if (content.includes('Git Code Reviewer')) {
      fs.unlinkSync(hookPath);
      ok('Pre-commit hook removed.');

      // Restore backup if exists
      const backupPath = hookPath + '.backup';
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, hookPath);
        ok('Previous pre-commit hook restored from backup.');
      }
    } else {
      warn('Pre-commit hook exists but was not installed by Git Code Reviewer. Skipping.');
    }
  } else {
    warn('No pre-commit hook found.');
  }

  console.log(`\n${COLORS.green}  Uninstall complete.${COLORS.reset}\n`);
}

function status() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}  Git Code Reviewer — Status${COLORS.reset}\n`);

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    fail('Not a git repository.');
    process.exit(1);
  }

  // Check hook
  const hookPath = path.join(gitRoot, '.git', 'hooks', 'pre-commit');
  if (fs.existsSync(hookPath)) {
    const content = fs.readFileSync(hookPath, 'utf-8');
    if (content.includes('Git Code Reviewer')) {
      ok('Pre-commit hook: installed');
    } else {
      warn('Pre-commit hook: exists but not Git Code Reviewer');
    }
  } else {
    fail('Pre-commit hook: not installed');
  }

  // Check config
  const configPath = path.join(gitRoot, '.git-code-reviewer.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      ok(`Config: ${config.provider}/${config.model}, block on: ${config.blockOnSeverity}`);
    } catch {
      warn('Config: exists but invalid JSON');
    }
  } else {
    warn('Config: using defaults (run "git-code-reviewer init" to customize)');
  }

  // Check .env
  const envPath = path.join(gitRoot, '.env');
  if (fs.existsSync(envPath)) {
    ok('.env file found');
  } else {
    warn('.env file not found (API keys can also be set as environment variables)');
  }

  // Load .env for key checks
  loadEnv();

  // Check API keys
  if (process.env.OPENAI_API_KEY) {
    ok(`OpenAI API key: set (${process.env.OPENAI_API_KEY.substring(0, 7)}...)`);
  } else {
    warn('OpenAI API key: not set');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    ok(`Anthropic API key: set (${process.env.ANTHROPIC_API_KEY.substring(0, 7)}...)`);
  } else {
    warn('Anthropic API key: not set');
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    ok(`Gemini API key: set (${geminiKey.substring(0, 7)}...)`);
  } else {
    warn('Gemini API key: not set');
  }

  console.log('');
}

function init() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}  Git Code Reviewer — Init${COLORS.reset}\n`);

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    fail('Not a git repository.');
    process.exit(1);
  }

  const destPath = path.join(gitRoot, '.git-code-reviewer.json');

  if (fs.existsSync(destPath)) {
    warn('.git-code-reviewer.json already exists. Skipping.');
    console.log(`  ${COLORS.dim}Delete it first if you want to reset to defaults.${COLORS.reset}\n`);
    return;
  }

  const defaultConfigPath = path.join(__dirname, '..', 'config', 'config.json');
  if (!fs.existsSync(defaultConfigPath)) {
    fail('Default config not found in package.');
    process.exit(1);
  }

  fs.copyFileSync(defaultConfigPath, destPath);
  ok('Created .git-code-reviewer.json with default config.');
  console.log(`  ${COLORS.dim}Edit it to customize provider, model, rules, and blocking severity.${COLORS.reset}\n`);
}

function review() {
  // Delegate to the core reviewer
  const { main } = require('../lib/reviewer');
  main();
}

function showHelp() {
  console.log(`
  ${COLORS.bold}Git Code Reviewer${COLORS.reset} — AI-Powered Pre-Commit Code Review

  ${COLORS.bold}Usage:${COLORS.reset}
    git-code-reviewer <command> [options]

  ${COLORS.bold}Commands:${COLORS.reset}
    install     Install the pre-commit hook in the current git repo
    uninstall   Remove the pre-commit hook
    status      Show current installation and configuration status
    review      Manually run AI review on staged changes
    init        Copy default config to project root (.git-code-reviewer.json)
    help        Show this help message

  ${COLORS.bold}Review Options:${COLORS.reset}
    --json         Output results as JSON (for CI/CD integration)
    --dry-run      Preview what would be reviewed without calling the AI
    --no-cache     Skip cached results and force a fresh review
    --output FILE  Save review results to a JSON file

  ${COLORS.bold}General Options:${COLORS.reset}
    --version, -v  Show version number
    --help, -h     Show this help message

  ${COLORS.bold}Examples:${COLORS.reset}
    ${COLORS.dim}# Quick setup${COLORS.reset}
    npx git-code-reviewer install

    ${COLORS.dim}# Customize settings${COLORS.reset}
    npx git-code-reviewer init

    ${COLORS.dim}# Run review manually${COLORS.reset}
    git add .
    npx git-code-reviewer review

    ${COLORS.dim}# Review with JSON output for CI${COLORS.reset}
    npx git-code-reviewer review --json

    ${COLORS.dim}# Preview without API call${COLORS.reset}
    npx git-code-reviewer review --dry-run

    ${COLORS.dim}# Bypass review for a single commit${COLORS.reset}
    git commit --no-verify -m "hotfix"

  ${COLORS.bold}More info:${COLORS.reset} https://github.com/salman1802/git-code-reviewer
`);
}

// ── CLI Entry ──

const command = process.argv[2];

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'status':
    status();
    break;
  case 'review':
    review();
    break;
  case 'init':
    init();
    break;
  case 'version':
  case '--version':
  case '-v': {
    const pkg = require('../package.json');
    console.log(pkg.version);
    break;
  }
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    showHelp();
    break;
}
