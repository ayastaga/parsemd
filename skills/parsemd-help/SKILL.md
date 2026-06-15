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
| `/parsemd <file> --output <path>` | Convert → inject + save to custom path |
| `/parsemd-help` | This card |

> **Plugin install** (namespaced): use `/parsemd:parsemd`, `/parsemd:parsemd-save`, `/parsemd:parsemd-help`
> **Standalone install**: use `/parsemd`, `/parsemd-save`, `/parsemd-help`

File path can use `@"..."` syntax or a plain path:
```
/parsemd @"report.pdf"
/parsemd ~/docs/report.pdf
/parsemd ~/docs/report.pdf --output ~/notes/report.md
```

## Supported Formats

| Category | Extensions |
|----------|------------|
| Documents | `.docx` `.pdf` `.pptx` `.ppt` `.xlsx` `.xls` `.epub` |
| Archives | `.zip` |
| Images | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.tiff` |
| Audio | `.wav` `.mp3` `.m4a` |
| Web / Data | `.html` `.csv` `.json` |

Text files (`.txt`, `.md`, `.py`, etc.) — use `@` directly, Claude Code handles those natively.

## Multiple files

```
/parsemd a.pdf and /parsemd b.docx
```

Both converted and injected in one message — processed in parallel. Repeated files within a session are served from cache (no re-conversion).

Docs: https://github.com/ayastaga/parsemd
