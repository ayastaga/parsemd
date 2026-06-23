# Privacy Policy

**Last updated:** June 21, 2026

## Overview

parsemd is a Claude Code plugin that converts binary documents into markdown. This policy describes how the plugin handles data.

## Data Collection

parsemd does not collect, store, or transmit personal data over a network. The plugin has no backend, no analytics, and no telemetry.

## How It Works

When you run `/parsemd`, the plugin:

1. Reads the file you specify from your local filesystem.
2. Runs Microsoft's [markitdown](https://github.com/microsoft/markitdown) as a subprocess to convert the file to markdown. The subprocess is sandboxed where the operating system supports it (see `SECURITY.md`).
3. Injects the resulting markdown into your Claude Code session as additional context.

All conversion is local. Nothing leaves your device.

**Images** are routed through your in-session Claude via the native `Read` tool rather than through markitdown — no external LLM client, no API key required. The image bytes stay local; Claude reads them from disk as it does any other file in your session.

**Audio** is not yet routed through Claude (planned for Phase 4). If you (or markitdown) are configured to call an external LLM for audio transcription, the audio file may be sent to that provider. parsemd does not configure this and does not pass credentials.

## Caching

parsemd writes a per-session cache to your operating system's temporary directory:

- **Path:** `$TMPDIR/parsemd-cache-<session-id>.json` (typically `/tmp/...` on macOS/Linux).
- **Contents:** keys of `file-path:mtime`, values are the converted markdown string.
- **Lifetime:** the file is not deleted at session end. Entries are pruned automatically when older than 24 hours, on every hook run.
- **Per-invocation disable:** pass `--no-cache` to skip both reads and writes for that call.

The cache is local-only. It is not encrypted. Treat it as you would any other temporary file: it may contain sensitive document text. If you parse sensitive material, run with `--no-cache`, or clean up `/tmp/parsemd-cache-*.json` manually.

A future opt-in **project-local cache** (planned for version 1.2.0) will store SHA256-keyed entries at `<cwd>/.parsemd/cache/` with an auto-generated `.gitignore`. Off by default.

## Sandboxing

The markitdown subprocess is run inside an OS-level sandbox where supported (`sandbox-exec` on macOS, `bwrap` or `firejail` on Linux). Network access is denied to the subprocess. File writes are restricted. Disable with `PARSEMD_SANDBOX=off`. See `SECURITY.md` for details.

## Third-Party Tools

- **markitdown** (Microsoft) — local subprocess used for conversion. See [Microsoft's privacy policy](https://privacy.microsoft.com/en-us/privacystatement).
- **In-session Claude** — handles image vision via Claude Code's native `Read` tool. Subject to Anthropic's Privacy Policy (linked below).
- **Optional audio LLM clients** (only if you opt in) — see your chosen provider's policy.

## Claude Code Context

Content injected into your Claude Code session is subject to [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy). parsemd does not control how Anthropic processes session data.

## Contact

Open an issue at [github.com/ayastaga/parsemd](https://github.com/ayastaga/parsemd/issues).
