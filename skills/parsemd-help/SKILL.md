---
name: parsemd-help
description: >
  Quick-reference card for all parsemd commands and supported formats.
  Trigger: /parsemd-help, "parsemd help", "what parsemd commands", "how do I use parsemd".
---

# parsemd Help

Display this reference card. One-shot — output only, do not persist anything.

## Commands

| Command | Does |
|---------|------|
| `/parsemd <file>` | Convert binary doc → inject markdown into context |
| `/parsemd-save <file>` | Convert → inject + save `.md` to current directory |
| `/parsemd-help` | This card |

> **Plugin install** (namespaced): prefix with `/parsemd:` (e.g., `/parsemd:parsemd`)
> **Standalone install**: bare commands (e.g., `/parsemd`)

## Flags

| Flag | Effect |
|------|--------|
| `--no-cache` | Skip session cache for this call |
| `--output <path>` | Save converted markdown to custom path |

## Path Formats

```
/parsemd ~/docs/report.pdf
/parsemd @"~/My Docs/Q4 Report.pdf"
/parsemd /tmp/export.docx
```

## Supported Formats

| Category | Extensions |
|----------|------------|
| Documents | `.docx` `.pdf` `.pptx` `.ppt` `.xlsx` `.xls` `.epub` |
| Archives | `.zip` |
| Images | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.tiff` (via Claude vision) |
| Audio | `.wav` `.mp3` `.m4a` (requires markitdown LLM client) |
| Web / Data | `.html` `.csv` `.json` |

Text files (`.txt`, `.md`, `.py`, etc.) — use `@` directly.

## Examples

```
/parsemd report.pdf
/parsemd-save ~/docs/notes.docx
/parsemd a.pdf compare with /parsemd b.docx
/parsemd report.pdf --no-cache
```

Docs: https://github.com/ayastaga/parsemd
