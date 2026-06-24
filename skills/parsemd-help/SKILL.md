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
| `/parsemd-summarize <file>` | Convert → Claude compacts maximally (no budget) |
| `/parsemd-diff <file1> ... <file2>` | Convert two docs → Claude compares with citations |
| `/parsemd-folder <dir>` | Convert all supported files in a directory |
| `/parsemd-pack <dir> --name <n>` | Create a knowledge pack bundle |
| `/parsemd-pack <name>` | Load a previously created pack |
| `/parsemd-relevant <file>` | Extract only query-relevant sections (TF-IDF scoring) |
| `/parsemd-help` | This card |

> **Plugin install** (namespaced): prefix with `/parsemd:` (e.g., `/parsemd:parsemd`)
> **Standalone install**: bare commands (e.g., `/parsemd`)

## Slicing Flags

| Flag | Effect |
|------|--------|
| `--pages 1-3,5` | Keep only specified page/slide ranges |
| `--section "Risk Factors"` | Extract a named section and its subsections |
| `--heading 2` | Extract all sections at heading level N |
| `--sheet Revenue` | Keep only named or indexed sheets |
| `--budget 20k` | Cap output at N tokens (chars/4). Accepts k/m suffix |
| `--head 500` | Keep first N tokens |
| `--tail 500` | Keep last N tokens |

## General Flags

| Flag | Effect |
|------|--------|
| `--no-cache` | Skip session cache for this call |
| `--output <path>` | Save converted markdown to custom path |
| `--depth N` | Max directory recursion depth (folder mode) |
| `--include *.pdf` | Include glob filter (folder mode) |
| `--exclude draft_*` | Exclude glob filter (folder mode) |
| `--name <pack>` | Knowledge pack name (pack mode) |
| `--query "text"` | Explicit query for semantic extraction (relevant mode) |

## Path Formats

```
/parsemd ~/docs/report.pdf
/parsemd @"~/My Docs/Q4 Report.pdf"
/parsemd /tmp/export.docx
/parsemd https://example.com/report.pdf
```

## Supported Formats

| Category | Extensions |
|----------|------------|
| Documents | `.docx` `.pdf` `.pptx` `.ppt` `.xlsx` `.xls` `.epub` |
| Archives | `.zip` |
| Images | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.tiff` (via Claude vision) |
| Audio | `.wav` `.mp3` `.m4a` (routed to Claude — may require external transcription) |
| Web / Data | `.html` `.csv` `.json` |

Text files (`.txt`, `.md`, `.py`, etc.) — use `@` directly.

## Examples

```
/parsemd report.pdf
/parsemd-save ~/docs/notes.docx
/parsemd a.pdf compare with /parsemd b.docx
/parsemd report.pdf --no-cache
/parsemd https://example.com/report.pdf
/parsemd report.pdf --pages 1-5
/parsemd report.pdf --section "Risk Factors"
/parsemd spreadsheet.xlsx --sheet Revenue
/parsemd report.pdf --budget 20k
/parsemd report.pdf --head 500 --tail 200
/parsemd-summarize report.pdf
/parsemd-diff old.docx /parsemd-diff new.docx
/parsemd-folder ~/docs/ --depth 1 --include *.pdf
/parsemd-pack ~/docs/ --name onboarding
/parsemd-pack onboarding
what are the risk factors? /parsemd-relevant report.pdf
```

Docs: https://github.com/ayastaga/parsemd
