#!/usr/bin/env node

/**
 * Git Code Reviewer — Shared Utilities
 * Common helpers used by both the CLI and the core reviewer.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── ANSI Colors ──

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

// ── CLI formatters ──

const ok = (msg) => console.log(`  ${COLORS.green}\u2713${COLORS.reset}  ${msg}`);
const warn = (msg) => console.log(`  ${COLORS.yellow}\u26A0${COLORS.reset}  ${msg}`);
const fail = (msg) => console.log(`  ${COLORS.red}\u2718${COLORS.reset}  ${msg}`);

// ── Git helpers ──

function getGitRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

// ── Environment loading ──

function loadEnv() {
  const projectRoot = getGitRoot() || process.cwd();

  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ── Glob-to-regex conversion ──

function globToRegex(pattern) {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // skip trailing slash after **
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
    i++;
  }
  return new RegExp('^' + re + '$');
}

module.exports = { COLORS, ok, warn, fail, getGitRoot, loadEnv, globToRegex };
