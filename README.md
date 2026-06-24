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
  <a href="#why-parsemd">Why parsemd</a> •
  <a href="#what-it-does">What It Does</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#install">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-formats">Formats</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## Why parsemd

Claude can read more file types every month. GUI Claude lets you drag and drop PDFs. So why does parsemd exist?

**File conversion is commodity. Context engineering is not.**

Reading a file is step one. The hard problems come after: How do you feed a 200-page PDF to an agent without blowing its context window? How do you reference just pages 12–15 of a contract? How do you keep a sensitive document from leaving your machine? How do you avoid re-converting the same 50-page report ten times in one session?

parsemd solves these problems. It's the layer between your documents and Claude's context — handling not just *what* goes in, but *how much*, *which parts*, and *how safely*.

<table>
<tr><td><strong>Slice</strong></td><td>Extract specific pages, sections, headings, or sheets — inject only what matters, not the whole document</td></tr>
<tr><td><strong>Budget</strong></td><td>Cap injected content at a token limit (<code>--budget 20k</code>) — critical for agentic workflows where every token counts</td></tr>
<tr><td><strong>Privacy</strong></td><td>Files never leave your machine. Conversion runs in an OS-level sandbox with network denied — no uploads, no cloud</td></tr>
<tr><td><strong>Cache</strong></td><td>Session and project-level caching (SHA256-keyed). Reference the same document 10 times, convert it once</td></tr>
<tr><td><strong>Programmable</strong></td><td>Runs as a hook — agents and skills can invoke parsemd without human interaction. No GUI, no drag-and-drop required</td></tr>
</table>

## What It Does

parsemd converts binary documents (DOCX, PPTX, XLSX, PDF, EPUB, images, audio, archives) into structured markdown with page/slide/sheet anchors, then injects the result into Claude's context — sliced, budgeted, cached, and sandboxed.

```
/parsemd ~/docs/report.docx
/parsemd report.pdf --pages 12-15 --budget 10k
/parsemd slides.pptx --section "Q4 Revenue"
```

Powered by Microsoft's [markitdown](https://github.com/microsoft/markitdown).

## How It Works

When you send a message containing `/parsemd <file>`, this happens before Claude ever sees it:

1. A `UserPromptSubmit` hook scans your prompt (skipping fenced code blocks and inline backticks) for `/parse*` invocations.
2. If the path is an HTTP(S) URL, the file is downloaded to a temp location (30s timeout, 100 MiB limit, 5 redirect max). The temp file is deleted after conversion.
3. For each file, `markitdown` is invoked as a sandboxed subprocess (macOS `sandbox-exec`, Linux `bwrap`/`firejail` where available) with network denied. The subprocess has a 5-minute timeout.
4. The resulting markdown is annotated with page/slide/sheet anchors (`<!-- page:N -->`, `<!-- slide:N -->`, `<!-- sheet:Name -->`) for structured formats.
5. A `[parsemd]` provenance header is prepended, recording the source path, engine version, SHA256 hash, timestamp, and page/slide/sheet count.
6. Image files are routed directly to Claude's native vision via the `Read` tool — markitdown is not invoked for images.
7. If slicing flags are present (`--pages`, `--section`, `--heading`, `--sheet`, `--head`, `--tail`), the markdown is sliced before injection.
8. If a `--budget` flag is present, the output is capped at the specified token count (chars/4).
9. The combined markdown is cached (per-session in `$TMPDIR`, or opt-in per-project at `<cwd>/.parsemd/cache/`) and injected into Claude's context, capped at 250 000 characters total across all files in the prompt.

You see a one-line summary with a first-heading preview:

```
Parsed: report.pdf → markdown (4,231 chars, 12 pages) "Quarterly Revenue Analysis". Injected into context.
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
for f in parsemd-hook.js lib/util.js lib/sandbox.js lib/engine.js lib/cache.js lib/parse-cmd.js lib/settings.js lib/url.js lib/provenance.js lib/anchors.js lib/slice.js lib/budget.js; do
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

### Parse from a URL

Pass an HTTP or HTTPS URL directly. The file is downloaded to a temp location, converted, and the temp file is deleted:

```
/parsemd https://example.com/report.pdf
/parsemd https://arxiv.org/pdf/2401.12345.pdf
```

The URL must end in a recognized file extension, or the server must return a recognized Content-Type header. Download is limited to 100 MiB with a 30-second timeout and at most 5 redirects.

### Save the converted markdown

Save to current working directory:

```
/parsemd-save ~/docs/report.pdf
```

Save to a specific path (works with both `/parsemd` and `/parsemd-save`):

```
/parsemd-save ~/docs/report.pdf --output ~/notes/report.md
```

### Slice a document

Extract specific parts of a document instead of injecting the full content:

```
/parsemd report.pdf --pages 1-5
/parsemd report.pdf --pages 3,7,12-15
/parsemd slides.pptx --pages 1-3
/parsemd report.pdf --section "Risk Factors"
/parsemd report.pdf --heading 2
/parsemd spreadsheet.xlsx --sheet Revenue
/parsemd spreadsheet.xlsx --sheet 0,2
/parsemd report.pdf --head 500
/parsemd report.pdf --tail 200
/parsemd report.pdf --head 500 --tail 200
/parsemd report.pdf --budget 20k
```

Slicing flags can be combined. The order of application is: `--pages`/`--sheet` first, then `--section`, then `--heading`, then `--head`/`--tail`, then `--budget`.

The `--budget` flag caps output at N tokens (where 1 token = 4 characters). Accepts `k` and `m` suffixes: `--budget 20k` means 20,000 tokens (80,000 characters).

### Summarize a document

Claude reads the parsed document and produces a maximally compressed summary, preserving key facts, numbers, dates, and citations:

```
/parsemd-summarize report.pdf
```

No budget is applied — Claude compacts using its own reasoning. The summary uses your in-session Claude.

### Compare two documents

Claude reads both parsed documents and produces a structured comparison with citations:

```
/parsemd-diff old.docx /parsemd-diff new.docx
```

Differences are listed as additions, removals, and changes, grouped by topic or section.

### Skip the cache for sensitive files

```
/parsemd ~/secrets/contract.pdf --no-cache
```

This skips both the read and the write of the on-disk session cache.

### Project-local cache (opt-in)

By default, parsemd caches conversions per-session in `$TMPDIR`. You can opt in to a project-local cache that persists across sessions and is keyed by file SHA256. Enable it in `~/.claude/settings.json`:

```json
{
  "plugins": {
    "parsemd": {
      "projectCache": true
    }
  }
}
```

When enabled, cached markdown is stored at `<cwd>/.parsemd/cache/<sha256>.md`. A `.gitignore` is created automatically inside `.parsemd/` to keep cache files out of version control. The project cache is checked after the session cache, so if both contain a hit, the session cache wins.

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

**Audio is not yet routed through Claude.** As of version 1.3, audio files (`.wav`, `.mp3`, `.m4a`) still fall back to markitdown's transcription path. parsemd does not configure an LLM client for you. If markitdown produces no text, parsemd surfaces an `AUDIO_NOT_SUPPORTED` error. In-session-Claude audio routing is planned for Phase 4 — until then, transcribe externally (e.g. with a local Whisper build) and `/parsemd` the resulting `.txt`.

---

## Security & Privacy

- Markitdown is run as a **sandboxed subprocess** (macOS `sandbox-exec`, Linux `bwrap`/`firejail`) with network denied. Disable with `PARSEMD_SANDBOX=off`.
- The hook caps total injected content per prompt at **250 000 characters** across all files.
- A `[parsemd]` **provenance header** is prepended to every injection, recording source path, engine version, SHA256 hash, and timestamp.
- URL downloads are limited to **100 MiB**, **30 seconds**, and **5 redirects**. Temp files are deleted after conversion.
- Cache is on-disk at `$TMPDIR/parsemd-cache-<session>.json`. Opt-in project cache at `<cwd>/.parsemd/cache/`. See [`PRIVACY.md`](PRIVACY.md).
- Path traversal is intentionally not guarded. See [`SECURITY.md`](SECURITY.md).

---

## Roadmap

parsemd's trajectory: from file converter → context engineering layer. Each phase is additive — no existing commands are removed or renamed.

- **1.1 (done)** — sandboxed parser, categorized errors, 5-min timeout, on-disk session cache with 24h GC, tightened matcher (skips code blocks), `--no-cache` flag, total-context budget, image routing through in-session Claude.
- **1.2 (done)** — `[parsemd]` provenance header on every injection, page/slide/sheet anchors (`<!-- page:N -->` etc.), HTTP(S) URL input, opt-in project-local cache at `<cwd>/.parsemd/cache/` (SHA256-keyed, auto-`.gitignore`), first-heading preview in summary line, engine version detect, engine seam (`markitdown` default).
- **1.3 (done)** — slicing (`--pages`, `--section`, `--heading`, `--sheet`, `--head`, `--tail`), token budgeting (`--budget 20k`), `/parsemd-summarize` (Claude compacts maximally), `/parsemd-diff` (Claude compares two docs with citations).
- **1.4 (current)** — folder ingestion (`/parsemd-folder`), knowledge packs (`/parsemd-pack`), incremental updates (manifest-based change detection), semantic extraction via TF-IDF scoring (`/parsemd-relevant`), audio routing through in-session Claude, hybrid pixel fallback for visually complex pages (charts, scanned PDFs — requires `poppler-utils`).
- **1.5 (planned)** — embedding-based semantic retrieval, multi-document knowledge graphs, streaming ingestion for large corpora, visual diff for slide decks.

---

## License

MIT
