# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-25

### Added
- **Google Gemini provider** — use `"provider": "gemini"` with `GEMINI_API_KEY`
- **Custom API base URL** — `apiBaseUrl` config for OpenAI-compatible proxies and local LLMs (Ollama, LM Studio)
- **Review caching** — avoids duplicate API calls when retrying with same staged changes
- **`--json` flag** — machine-readable JSON output for CI/CD integration
- **`--dry-run` flag** — preview config, files, and diff stats without calling the AI
- **`--output <file>` flag** — save review results to a JSON file
- **`--no-cache` flag** — force a fresh review, bypassing the cache
- **`--version` / `-v` flag** — display the package version
- **`.env.example`** — template for required environment variables
- **`CHANGELOG.md`** — version history

### Fixed
- **Config deep merge** — partial `rules` in `.git-code-reviewer.json` no longer overwrites unspecified rules
- **Glob pattern matching** — dots are now escaped, `*` matches within one directory level, `**` matches recursively

### Changed
- Extracted shared utilities (`COLORS`, `loadEnv`, `getGitRoot`, `globToRegex`) into `lib/utils.js` to eliminate code duplication
- `status` command now shows Gemini API key status
- `install` command now mentions Gemini in the API key setup instructions
- Updated help text with new flags and options

## [1.0.0] - 2026-03-20

### Added
- Initial release
- AI-powered pre-commit code review with OpenAI and Anthropic
- Security, performance, code quality, best practices, and secrets detection
- Configurable severity-based commit blocking
- Smart diff filtering (skip patterns, deleted files, truncation)
- CLI commands: `install`, `uninstall`, `status`, `review`, `init`, `help`
- Zero dependencies — uses only Node.js 18+ built-ins
