<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/page-facing-up_1f4c4.png" width="120" />
</p>

<h1 align="center">parsemd</h1>

<p align="center">
  <strong>document context engineering for Claude Code</strong>
</p>

<p align="center">
  <a href="https://github.com/ayastaga/parsemd/stargazers"><img src="https://img.shields.io/github/stars/ayastaga/parsemd?style=flat&color=yellow" alt="Stars"></a>
  <a href="https://github.com/ayastaga/parsemd/commits/main"><img src="https://img.shields.io/github/last-commit/ayastaga/parsemd?style=flat" alt="Last Commit"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="License"></a>
</p>

<p align="center">
  <a href="#what-it-does">What It Does</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#install">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-formats">Formats</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## What It Does

Claude Code reads plain-text files natively via `@`, and recent versions can also open simple PDFs. **parsemd handles the rest** — DOCX, PPTX, XLSX, EPUB, archives, audio, and images — and turns them into markdown Claude can reason about. It wraps the conversion in an OS-level sandbox, applies categorized error handling, enforces a total context budget, and routes images through Claude's native vision.

```
/parsemd ~/docs/report.docx
```

Claude can now read, summarize, reference, and reason about the document as if you'd pasted it in.

**Why it exists.** The set of formats Claude can ingest natively grows over time, but the surrounding workflow — keeping conversions safe, cacheable, and within token budget — does not get solved by adding more native readers. parsemd is the layer between your files and your Claude context.

Powered by Microsoft's [markitdown](https://github.com/microsoft/markitdown).

## How It Works

When you send a message containing `/parsemd <file>`, this happens before Claude ever sees it:

1. A `UserPromptSubmit` hook scans your prompt (skipping fenced code blocks and inline backticks) for `/parse*` invocations.
2. For each file, `markitdown` is invoked as a sandboxed subprocess (macOS `sandbox-exec`, Linux `bwrap`/`firejail` where available) with network denied. The subprocess has a 5-minute timeout.
3. Image files are routed directly to Claude's native vision via the `Read` tool — markitdown is not invoked for images.
4. The combined markdown is cached (per-session in `$TMPDIR`) and injected into Claude's context, capped at 250 000 characters total across all files in the prompt.

You see a one-line summary:

```
Parsed: report.pdf → markdown (4,231 chars). Injected into context.
```

The hook only runs on prompts containing a `/parse*` token; regular messages have no overhead.

---

## Install

Requires Node.js, Python 3 with pip, and the `claude` CLI.

### Plugin install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ayastaga/parsemd/main/install.sh | bash
```

Commands are namespaced after install: `/parsemd:parsemd`, `/parsemd:parsemd-save`, `/parsemd:parsemd-help`.

Or step by step:

```bash
pip install 'markitdown[all]'
claude plugin marketplace add ayastaga/parsemd
claude plugin install parsemd@parsemd
```

Restart Claude Code after installing.

### Standalone install (bare `/parsemd`)

No namespace prefix — commands are just `/parsemd`, `/parsemd-save`, `/parsemd-help`.

```bash
curl -fsSL https://raw.githubusercontent.com/ayastaga/parsemd/main/install.sh | bash -s -- --standalone
```

Or clone and run locally (hook stays symlinked — repo updates apply immediately):

```bash
git clone https://github.com/ayastaga/parsemd.git
cd parsemd
./install.sh --standalone
```

The installer refuses to register the standalone hook if it detects the plugin-mode hook is already active, to avoid double-fire.

<details>
<summary>Manual standalone setup</summary>

**1. Install markitdown:**

```bash
pip install 'markitdown[all]'
```

**2. Download hook script:**

```bash
mkdir -p ~/.claude/hooks/parsemd ~/.claude/hooks/parsemd/lib
for f in parsemd-hook.js lib/util.js lib/sandbox.js lib/engine.js lib/cache.js lib/parse-cmd.js; do
  curl -fsSL "https://raw.githubusercontent.com/ayastaga/parsemd/main/hooks/$f" \
    -o "$HOME/.claude/hooks/parsemd/$f"
done
```

**3. Add `/parsemd` command:**

```bash
mkdir -p ~/.claude/commands
printf -- '---\ndescription: Parse binary documents into markdown context\n---\n\n/parse $ARGUMENTS\n' \
  > ~/.claude/commands/parsemd.md
```

**4. Register hook in `~/.claude/settings.json`:**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "/parse",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/Users/YOU/.claude/hooks/parsemd/parsemd-hook.js\"",
            "timeout": 320
          }
        ]
      }
    ]
  }
}
```

Replace `/Users/YOU` with your actual home directory path. Restart Claude Code.

</details>

---

## Usage

> **Note:** Examples below use standalone (bare `/parsemd`) syntax. Plugin install users prefix with the namespace: `/parsemd:parsemd` instead of `/parsemd`.

### Basic — read a file

Just type `/parsemd` and the path. Claude receives the full document content:

```
/parsemd ~/docs/report.pdf
/parsemd ~/docs/notes.docx
/parsemd ~/desktop/slides.pptx
```

### Path formats

All three forms work the same way:

```
/parsemd ~/docs/report.pdf
/parsemd @~/docs/report.pdf
/parsemd @"~/docs/report.pdf"
```

Use quotes for paths with spaces:

```
/parsemd @"~/My Documents/Q4 Report.pdf"
```

Absolute path:

```
/parsemd /tmp/export.docx
```

### Save the converted markdown

Save to current working directory:

```
/parsemd-save ~/docs/report.pdf
```

Save to a specific path (works with both `/parsemd` and `/parsemd-save`):

```
/parsemd-save ~/docs/report.pdf --output ~/notes/report.md
```

### Skip the cache for sensitive files

```
/parsemd ~/secrets/contract.pdf --no-cache
```

This skips both the read and the write of the on-disk session cache.

### Multiple files at once

```
/parsemd ~/docs/a.pdf compare with /parsemd ~/docs/b.docx
```

Both are converted in parallel and injected together. If their combined size exceeds 250 000 characters, parsemd proportionally truncates each file. Running the same file again in the same session uses a cache — no redundant re-conversion.

### Get help

```
/parsemd-help
```

### What does NOT trigger conversion

These are intentionally ignored:

```
use template.docx as reference format
```

— no `/parsemd` in the message.

````
```
/parsemd foo.pdf
```
````

— inside a fenced code block.

```
the `/parsemd foo.pdf` syntax
```

— inside inline backticks.

```
/parse my workflow
```

— `my workflow` is not a valid filename (no recognized extension).

---

## Supported Formats

| Category   | Extensions                                            |
| ---------- | ----------------------------------------------------- |
| Documents  | `.docx` `.pdf` `.pptx` `.ppt` `.xlsx` `.xls` `.epub` |
| Archives   | `.zip`                                                |
| Images     | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.tiff`           |
| Audio      | `.wav` `.mp3` `.m4a`                                  |
| Web / Data | `.html` `.csv` `.json`                                |

Plain text files (`.txt`, `.md`, `.py`, etc.) don't need this plugin — use Claude Code's built-in `@` directly.

**Images route through your in-session Claude — no API keys required.** When you `/parsemd photo.png`, parsemd does not invoke markitdown. Instead it instructs Claude to open the image via the native `Read` tool, which uses Claude's own vision. You do not need `MARKITDOWN_LLM_CLIENT`, `OPENAI_API_KEY`, or any other credential.

**Audio is not yet routed through Claude.** As of version 1.1, audio files (`.wav`, `.mp3`, `.m4a`) still fall back to markitdown's transcription path. parsemd does not configure an LLM client for you. If markitdown produces no text, parsemd surfaces an `AUDIO_NOT_SUPPORTED` error. In-session-Claude audio routing is planned for Phase 4 — until then, transcribe externally (e.g. with a local Whisper build) and `/parsemd` the resulting `.txt`.

---

## Security & Privacy

- Markitdown is run as a **sandboxed subprocess** (macOS `sandbox-exec`, Linux `bwrap`/`firejail`) with network denied. Disable with `PARSEMD_SANDBOX=off`.
- The hook caps total injected content per prompt at **250 000 characters** across all files.
- Cache is on-disk at `$TMPDIR/parsemd-cache-<session>.json`. See [`PRIVACY.md`](PRIVACY.md).
- Path traversal is intentionally not guarded. See [`SECURITY.md`](SECURITY.md).

---

## Roadmap

parsemd is evolving from a file-conversion utility into a document context-engineering layer. Each phase is additive — no existing commands are removed or renamed.

- **1.1 (current)** — sandboxed parser, categorized errors, 5-min timeout, on-disk session cache with 24h GC, tightened matcher (skips code blocks), `--no-cache` flag, total-context budget, image routing through in-session Claude.
- **1.2 (planned)** — `[parsemd]` provenance header on every injection, page/slide/sheet anchors (`<!-- page:N -->` etc.), HTTP(S) URL input, opt-in project-local cache at `<cwd>/.parsemd/cache/` (SHA256-keyed, auto-`.gitignore`), first-heading preview in summary line, engine seam (`markitdown` default).
- **1.3 (planned)** — slicing (`--pages`, `--section`, `--heading`, `--sheet`, `--head`, `--tail`), token budgeting (`--budget 20k`), `/parsemd-summarize` (Claude compacts maximally), `/parsemd-diff` (Claude compares two docs with citations).
- **1.4 (planned)** — folder ingestion (`/parsemd-folder`), knowledge packs (`/parsemd-pack`), incremental updates, semantic extraction via in-session Claude (`/parsemd-relevant`), audio routing through in-session Claude.

---

## License

MIT
