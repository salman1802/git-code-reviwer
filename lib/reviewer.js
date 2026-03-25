#!/usr/bin/env node

/**
 * Git Code Reviewer — Core Reviewer
 * Runs AI-powered code review on staged git diffs.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { COLORS, getGitRoot, loadEnv, globToRegex } = require('./utils');

// ── Load .env from project root ──

loadEnv();

// ── Config ──

const DEFAULT_CONFIG = {
  provider: 'openai',
  model: 'gpt-4o',
  blockOnSeverity: 'critical',
  maxDiffLines: 2000,
  skipPatterns: ['*.lock', '*.min.js', 'dist/*', 'build/*', 'node_modules/*', '*.map'],
  apiBaseUrl: null,
  cacheTimeout: 3600000,
  rules: {
    security: true,
    performance: true,
    codeQuality: true,
    bestPractices: true,
    secretsDetection: true
  }
};

function findConfigPath() {
  const projectRoot = getGitRoot() || process.cwd();

  const projectConfig = path.join(projectRoot, '.git-code-reviewer.json');
  if (fs.existsSync(projectConfig)) return projectConfig;

  const packageConfig = path.join(__dirname, '..', 'config', 'config.json');
  if (fs.existsSync(packageConfig)) return packageConfig;

  return null;
}

function loadConfig() {
  const configPath = findConfigPath();
  if (!configPath) return DEFAULT_CONFIG;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      rules: { ...DEFAULT_CONFIG.rules, ...(userConfig.rules || {}) }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ── CLI flags ──

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getFlagValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

// ── Severity levels ──

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

function severityIndex(sev) {
  return SEVERITY_ORDER.indexOf((sev || '').toLowerCase());
}

function shouldBlock(issues, threshold) {
  const threshIdx = severityIndex(threshold);
  if (threshIdx < 0) return false; // 'never' or invalid = never block
  return issues.some(i => severityIndex(i.severity) >= threshIdx);
}

// ── Diff helpers ──

function getStagedDiff() {
  try {
    return execSync('git diff --cached', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch {
    return '';
  }
}

function filterDiff(diff, skipPatterns) {
  const lines = diff.split('\n');
  const filtered = [];
  let skipping = false;
  let currentFileLines = [];
  let currentFileDeleteOnly = false;

  function flushFile() {
    if (!currentFileDeleteOnly) {
      filtered.push(...currentFileLines);
    }
    currentFileLines = [];
    currentFileDeleteOnly = false;
  }

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      flushFile();

      const match = line.match(/b\/(.+)$/);
      const file = match ? match[1] : '';

      skipping = (skipPatterns || []).some(pattern => {
        const regex = globToRegex(pattern);
        return regex.test(file) || regex.test(path.basename(file));
      });
    }

    if (line.startsWith('deleted file mode')) {
      currentFileDeleteOnly = true;
    }

    if (!skipping) {
      currentFileLines.push(line);
    }
  }
  flushFile();

  return filtered.join('\n');
}

function extractFilesFromDiff(diff) {
  const files = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) files.push(match[1]);
    }
  }
  return files;
}

function truncateDiff(diff, maxLines) {
  const lines = diff.split('\n');
  if (lines.length <= maxLines) return diff;
  return lines.slice(0, maxLines).join('\n') + `\n\n... (truncated ${lines.length - maxLines} lines)`;
}

// ── Caching ──

function getCachePath() {
  const gitRoot = getGitRoot();
  if (!gitRoot) return null;
  return path.join(gitRoot, '.git', 'git-code-reviewer-cache.json');
}

function readCache(diffHash, timeout) {
  const cachePath = getCachePath();
  if (!cachePath) return null;

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(raw);
    if (cache.hash === diffHash && (Date.now() - cache.timestamp) < timeout) {
      return cache.result;
    }
  } catch {
    // Cache miss or corrupt
  }
  return null;
}

function writeCache(diffHash, result) {
  const cachePath = getCachePath();
  if (!cachePath) return;

  try {
    fs.writeFileSync(cachePath, JSON.stringify({
      hash: diffHash,
      result,
      timestamp: Date.now()
    }, null, 2));
  } catch {
    // Non-critical, ignore
  }
}

// ── AI Review ──

function getApiKey(provider) {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || null;
    case 'gemini':
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    default:
      return process.env.OPENAI_API_KEY || null;
  }
}

function getApiKeyEnvName(provider) {
  switch (provider) {
    case 'anthropic': return 'ANTHROPIC_API_KEY';
    case 'gemini': return 'GEMINI_API_KEY';
    default: return 'OPENAI_API_KEY';
  }
}

async function reviewWithOpenAI(diff, config) {
  const apiKey = getApiKey('openai');
  if (!apiKey) return null;

  const enabledRules = Object.entries(config.rules)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const prompt = buildPrompt(diff, enabledRules);

  const baseUrl = config.apiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are an expert code reviewer focused on security, performance, and code quality. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return parseAIResponse(data.choices[0].message.content);
}

async function reviewWithAnthropic(diff, config) {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) return null;

  const enabledRules = Object.entries(config.rules)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const prompt = buildPrompt(diff, enabledRules);

  const baseUrl = config.apiBaseUrl || 'https://api.anthropic.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ],
      system: 'You are an expert code reviewer focused on security, performance, and code quality. Respond ONLY with valid JSON.'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return parseAIResponse(data.content[0].text);
}

async function reviewWithGemini(diff, config) {
  const apiKey = getApiKey('gemini');
  if (!apiKey) return null;

  const enabledRules = Object.entries(config.rules)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const prompt = buildPrompt(diff, enabledRules);
  const systemPrompt = 'You are an expert code reviewer focused on security, performance, and code quality. Respond ONLY with valid JSON.';

  const baseUrl = config.apiBaseUrl || 'https://generativelanguage.googleapis.com';
  const model = config.model || 'gemini-2.0-flash';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return parseAIResponse(text);
}

function buildPrompt(diff, enabledRules) {
  const ruleDescriptions = {
    secretsDetection: 'SECRETS DETECTION: Look for API keys, tokens, passwords, connection strings, private keys, or any credentials that should not be committed.',
    security: 'SECURITY: Check for SQL injection, XSS, path traversal, command injection, auth bypass, insecure deserialization, SSRF, and other OWASP Top 10 vulnerabilities.',
    performance: 'PERFORMANCE: Identify N+1 queries, blocking async calls, unnecessary large allocations, missing indexes, inefficient loops, and memory leaks.',
    codeQuality: 'CODE QUALITY: Flag missing error handling, dead/unreachable code, high cyclomatic complexity, and unclear logic.',
    bestPractices: 'BEST PRACTICES: Check for missing input validation, sensitive data in logs, missing rate limits, hardcoded values that should be configurable.'
  };

  const activeRules = enabledRules
    .map(r => ruleDescriptions[r])
    .filter(Boolean)
    .join('\n');

  return `Review the following git diff for issues. This is a pre-commit review of STAGED changes.

IMPORTANT DIFF CONTEXT:
- Lines starting with "+" are NEWLY ADDED code — review these thoroughly for bugs, secrets, and vulnerabilities.
- Lines starting with "-" are REMOVED code — check if removing them breaks security checks, error handling, auth guards, or critical functionality.
- Lines without +/- prefix are unchanged context lines.
- Entirely deleted files are excluded from this diff — only modified and new files are shown.

Focus on these categories:

${activeRules}

For each issue found, provide:
- severity: "critical", "high", "medium", or "low"
- category: one of [${enabledRules.join(', ')}]
- file: the affected file path
- line: approximate line number (from the diff)
- message: clear, actionable description of the issue

Respond with ONLY this JSON structure (no markdown, no code fences):
{
  "score": <number 0-100>,
  "summary": "<one-line summary>",
  "issues": [
    {
      "severity": "<critical|high|medium|low>",
      "category": "<category>",
      "file": "<file path>",
      "line": <line number or null>,
      "message": "<description>"
    }
  ]
}

If no issues are found, return: {"score": 100, "summary": "No issues found.", "issues": []}

GIT DIFF:
${diff}`;
}

function parseAIResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.max(0, Math.min(100, parsed.score || 0)),
      summary: parsed.summary || '',
      issues: (parsed.issues || []).map(i => ({
        severity: (i.severity || 'low').toLowerCase(),
        category: i.category || 'unknown',
        file: i.file || 'unknown',
        line: i.line || null,
        message: i.message || ''
      }))
    };
  } catch {
    return { score: 50, summary: 'Could not parse AI response.', issues: [] };
  }
}

// ── Display ──

function severityColor(sev) {
  switch (sev) {
    case 'critical': return COLORS.red;
    case 'high': return COLORS.magenta;
    case 'medium': return COLORS.yellow;
    case 'low': return COLORS.cyan;
    default: return COLORS.dim;
  }
}

function severityIcon(sev) {
  switch (sev) {
    case 'critical': return '\u2718';
    case 'high': return '!';
    case 'medium': return '\u26A0';
    case 'low': return '\u2022';
    default: return ' ';
  }
}

function renderScoreBar(score) {
  const filled = Math.round(score / 100 * 30);
  const empty = 30 - filled;
  let color = COLORS.green;
  if (score < 50) color = COLORS.red;
  else if (score < 75) color = COLORS.yellow;

  return `  ${color}${'\u2588'.repeat(filled)}${COLORS.dim}${'\u2591'.repeat(empty)}${COLORS.reset}  ${COLORS.bold}${score}/100${COLORS.reset}`;
}

function printHeader(branch, diffLines) {
  console.log('');
  console.log(`${COLORS.cyan}\u2554${'='.repeat(46)}\u2557${COLORS.reset}`);
  console.log(`${COLORS.cyan}\u2551${COLORS.reset}${COLORS.bold}         Git Code Reviewer                    ${COLORS.reset}${COLORS.cyan}\u2551${COLORS.reset}`);
  console.log(`${COLORS.cyan}\u255A${'='.repeat(46)}\u255D${COLORS.reset}`);
  console.log('');
  console.log(`  Branch : ${COLORS.bold}${branch}${COLORS.reset}`);
  console.log(`  Changes: ~${diffLines} diff lines`);
  console.log('');
}

function printResult(result, config) {
  console.log(`  ${'─'.repeat(44)}`);
  console.log(`  ${COLORS.bold}Review Score${COLORS.reset}`);
  console.log(renderScoreBar(result.score));
  console.log(`  ${COLORS.dim}${result.summary}${COLORS.reset}`);
  console.log('');

  if (result.issues.length === 0) {
    console.log(`  ${COLORS.green}\u2713 No blocking issues found.${COLORS.reset}`);
  } else {
    const grouped = {};
    for (const issue of result.issues) {
      if (!grouped[issue.severity]) grouped[issue.severity] = [];
      grouped[issue.severity].push(issue);
    }

    for (const sev of ['critical', 'high', 'medium', 'low']) {
      if (!grouped[sev]) continue;
      console.log(`  ${severityColor(sev)}${COLORS.bold}${sev.toUpperCase()} (${grouped[sev].length})${COLORS.reset}`);
      for (const issue of grouped[sev]) {
        const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
        console.log(`    ${severityColor(sev)}${severityIcon(sev)}${COLORS.reset} ${COLORS.dim}[${issue.category}]${COLORS.reset} ${loc}`);
        console.log(`      ${issue.message}`);
      }
      console.log('');
    }
  }

  const blocked = shouldBlock(result.issues, config.blockOnSeverity);

  if (blocked) {
    console.log(`  ${COLORS.bgRed}${COLORS.white}${COLORS.bold} \u2718 COMMIT BLOCKED ${COLORS.reset} Issues at or above "${config.blockOnSeverity}" severity found.`);
    console.log(`  ${COLORS.dim}Fix the issues above and try again, or bypass with: git commit --no-verify${COLORS.reset}`);
  } else {
    console.log(`  ${COLORS.bgGreen}${COLORS.white}${COLORS.bold} \u2713 AI Review Passed ${COLORS.reset}${COLORS.green} Committing...${COLORS.reset}`);
  }
  console.log('');

  return blocked;
}

// ── Spinner ──

function createSpinner(text) {
  const frames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
  let i = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r  ${COLORS.cyan}${frames[i % frames.length]}${COLORS.reset}  ${text}`);
    i++;
  }, 80);
  return {
    stop(finalText) {
      clearInterval(interval);
      process.stderr.write(`\r  ${finalText}\n`);
    }
  };
}

// ── Main ──

async function main() {
  const config = loadConfig();
  const jsonMode = hasFlag('--json');
  const dryRun = hasFlag('--dry-run');
  const noCache = hasFlag('--no-cache');
  const outputPath = getFlagValue('--output');

  // Get current branch
  let branch;
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    branch = 'unknown';
  }

  // Get staged diff
  let diff = getStagedDiff();

  if (!diff || !diff.trim()) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: 'No staged changes to review.' }));
    } else {
      console.log(`\n  ${COLORS.dim}Git Code Reviewer: No staged changes to review.${COLORS.reset}\n`);
    }
    process.exit(0);
  }

  // Filter and truncate
  diff = filterDiff(diff, config.skipPatterns);
  const diffLineCount = diff.split('\n').length;
  const files = extractFilesFromDiff(diff);
  diff = truncateDiff(diff, config.maxDiffLines);

  // ── Dry run mode ──
  if (dryRun) {
    if (jsonMode) {
      console.log(JSON.stringify({
        dryRun: true,
        config: {
          provider: config.provider,
          model: config.model,
          blockOnSeverity: config.blockOnSeverity,
          maxDiffLines: config.maxDiffLines,
          apiBaseUrl: config.apiBaseUrl || null,
          rules: config.rules
        },
        diff: {
          lineCount: diffLineCount,
          fileCount: files.length,
          files
        },
        apiKeySet: !!getApiKey(config.provider)
      }, null, 2));
    } else {
      printHeader(branch, diffLineCount);
      console.log(`  ${COLORS.bold}Dry Run — No API call will be made${COLORS.reset}\n`);
      console.log(`  Provider       : ${COLORS.bold}${config.provider}${COLORS.reset}`);
      console.log(`  Model          : ${COLORS.bold}${config.model}${COLORS.reset}`);
      console.log(`  Block on       : ${COLORS.bold}${config.blockOnSeverity}${COLORS.reset}`);
      console.log(`  Max diff lines : ${config.maxDiffLines}`);
      if (config.apiBaseUrl) {
        console.log(`  API base URL   : ${config.apiBaseUrl}`);
      }
      console.log('');

      const enabledRules = Object.entries(config.rules).filter(([, v]) => v).map(([k]) => k);
      console.log(`  ${COLORS.bold}Active rules:${COLORS.reset} ${enabledRules.join(', ')}`);
      console.log('');

      console.log(`  ${COLORS.bold}Files to review (${files.length}):${COLORS.reset}`);
      for (const file of files) {
        console.log(`    ${COLORS.dim}•${COLORS.reset} ${file}`);
      }
      console.log('');

      console.log(`  Diff lines     : ${diffLineCount}`);

      const apiKey = getApiKey(config.provider);
      if (apiKey) {
        ok(`${getApiKeyEnvName(config.provider)} is set (${apiKey.substring(0, 7)}...)`);
      } else {
        fail(`${getApiKeyEnvName(config.provider)} is not set`);
      }
      console.log('');
    }
    process.exit(0);
  }

  // ── Normal review mode ──

  if (!jsonMode) {
    printHeader(branch, diffLineCount);
  }

  // Check API key
  const apiKey = getApiKey(config.provider);

  if (!apiKey) {
    const envVar = getApiKeyEnvName(config.provider);
    if (jsonMode) {
      console.log(JSON.stringify({ error: `${envVar} not set. Skipping AI review.` }));
    } else {
      console.log(`  ${COLORS.yellow}\u26A0 ${envVar} not set — skipping AI review.${COLORS.reset}`);
      console.log(`  ${COLORS.dim}Set it in your .env file or shell profile to enable review.${COLORS.reset}\n`);
    }
    process.exit(0);
  }

  // Check cache
  const diffHash = crypto.createHash('sha256').update(diff).digest('hex');
  if (!noCache) {
    const cached = readCache(diffHash, config.cacheTimeout);
    if (cached) {
      if (jsonMode) {
        const blocked = shouldBlock(cached.issues, config.blockOnSeverity);
        console.log(JSON.stringify({
          ...cached,
          blocked,
          cached: true,
          provider: config.provider,
          model: config.model
        }, null, 2));
        process.exit(blocked ? 1 : 0);
      } else {
        console.log(`  ${COLORS.cyan}\u2139${COLORS.reset}  ${COLORS.dim}Using cached review (same staged changes)${COLORS.reset}\n`);
        const blocked = printResult(cached, config);
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify({ ...cached, blocked, cached: true, provider: config.provider, model: config.model }, null, 2));
          console.log(`  ${COLORS.dim}Report saved to ${outputPath}${COLORS.reset}\n`);
        }
        process.exit(blocked ? 1 : 0);
      }
    }
  }

  const modelLabel = config.model.includes('claude') ? 'Claude'
    : config.model.includes('gemini') ? 'Gemini'
    : config.model;
  const spinner = jsonMode ? null : createSpinner(`Running AI code review with ${modelLabel}...`);

  try {
    let result;
    if (config.provider === 'anthropic') {
      result = await reviewWithAnthropic(diff, config);
    } else if (config.provider === 'gemini') {
      result = await reviewWithGemini(diff, config);
    } else {
      result = await reviewWithOpenAI(diff, config);
    }

    if (!result) {
      if (spinner) spinner.stop(`${COLORS.yellow}\u26A0 No API key — skipping review.${COLORS.reset}`);
      if (jsonMode) console.log(JSON.stringify({ error: 'No API key available.' }));
      process.exit(0);
    }

    // Write cache
    writeCache(diffHash, result);

    if (spinner) spinner.stop(`${COLORS.green}\u2713 Review complete.${COLORS.reset}`);

    const blocked = shouldBlock(result.issues, config.blockOnSeverity);

    if (jsonMode) {
      console.log(JSON.stringify({
        ...result,
        blocked,
        cached: false,
        provider: config.provider,
        model: config.model
      }, null, 2));
    } else {
      console.log('');
      printResult(result, config);
    }

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify({
        ...result,
        blocked,
        cached: false,
        provider: config.provider,
        model: config.model
      }, null, 2));
      if (!jsonMode) {
        console.log(`  ${COLORS.dim}Report saved to ${outputPath}${COLORS.reset}\n`);
      }
    }

    process.exit(blocked ? 1 : 0);

  } catch (error) {
    if (spinner) spinner.stop(`${COLORS.yellow}\u26A0 AI review failed.${COLORS.reset}`);
    if (jsonMode) {
      console.log(JSON.stringify({ error: error.message }));
    } else {
      console.log(`  ${COLORS.dim}${error.message}${COLORS.reset}`);
      console.log(`  ${COLORS.dim}Allowing commit to proceed.${COLORS.reset}\n`);
    }
    process.exit(0); // Don't block on API failure
  }
}

module.exports = { main };

// Run directly if executed as a script
if (require.main === module) {
  main();
}
