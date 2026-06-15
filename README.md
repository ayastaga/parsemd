<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/page-facing-up_1f4c4.png" width="120" />
</p>

<h1 align="center">parsemd</h1>

<p align="center">
  <strong>parse binary docs into Claude context with /parsemd</strong>
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
  <a href="#supported-formats">Formats</a>
</p>

---

## What It Does

Claude Code can read plain text files natively using the `@` symbol — but it can't open PDFs, Word docs, PowerPoints, spreadsheets, or images. **parsemd bridges that gap.**

Type `/parsemd` followed by a file path, and the plugin automatically converts the file to markdown and feeds it directly into Claude's context — no copy-pasting, no manual conversion, no extra steps.

```
/parsemd ~/docs/report.pdf
```

That's it. Claude can now read, summarize, reference, and reason about the document as if it were plain text.

**Why it exists:** Binary formats are completely opaque to Claude. Without this plugin, you'd need to manually convert every PDF or DOCX before Claude could help with it. parsemd automates that conversion invisibly, before Claude even sees your message.

Powered by Microsoft's [markitdown](https://github.com/microsoft/markitdown).

## How It Works

When you send a message with `/parsemd`, this happens before Claude ever sees it:

1. A background hook intercepts the message
2. It finds the file path in your message
3. Converts the file to markdown using `markitdown`
4. Injects that markdown into Claude's context invisibly

Claude then receives your original message plus the full document content — as if you'd pasted it in manually.

You'll see a confirmation line:

```
Parsed: report.pdf → markdown (4,231 chars). Injected into context.
```

The hook only runs when your message contains `/parse`, so there's no overhead on regular messages.

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

<details>
<summary>Manual standalone setup</summary>

**1. Install markitdown:**

```bash
pip install 'markitdown[all]'
```

**2. Download hook script:**

```bash
mkdir -p ~/.claude/hooks
curl -fsSL https://raw.githubusercontent.com/ayastaga/parsemd/main/hooks/parsemd-hook.js \
  -o ~/.claude/hooks/parsemd-hook.js
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
            "command": "node \"/Users/YOU/.claude/hooks/parsemd-hook.js\"",
            "timeout": 35
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

Save to a specific path:

```
/parsemd ~/docs/report.pdf --output ~/notes/report.md
```

### Multiple files at once

```
/parsemd ~/docs/a.pdf compare with /parsemd ~/docs/b.docx
```

Both are converted in parallel and injected together. Running the same file again in the same session uses a cache — no redundant re-conversion.

### Get help

```
/parsemd-help
```

### What does NOT trigger conversion

```
use template.docx as reference format
```

No `/parsemd` in the message → nothing happens. Claude sees the message as-is.

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

---

## License

MIT
