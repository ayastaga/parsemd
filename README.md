# claude-markitdown

A Claude Code plugin that converts binary documents (DOCX, PDF, PPTX, XLSX, images, audio) into markdown and injects the content into Claude's context on demand.

Claude Code's built-in `@` file referencing handles text files natively. This plugin fills the gap for binary formats that `@` cannot read.

Powered by Microsoft's [markitdown](https://github.com/microsoft/markitdown).

## Usage

```
/parse ~/docs/report.pdf
```

→ Converts and injects into context. Claude can then answer questions about it.

```
/parse ~/docs/report.docx --output
```

→ Converts, injects into context, and saves `report.md` alongside the source file.

```
/parse ~/docs/report.docx -o ~/notes/report-notes.md
```

→ Converts, injects into context, and saves to a custom path.

```
/parse ~/docs/a.pdf compare with /parse ~/docs/b.pdf
```

→ Multiple files in one message — both converted and injected.

### What does NOT trigger conversion

```
use template.docx as reference format
```

No `/parse` trigger → no conversion. Claude processes the message as-is.

## Supported formats

| Category  | Extensions                                           |
| --------- | ---------------------------------------------------- |
| Documents | `.docx` `.pdf` `.pptx` `.ppt` `.xlsx` `.xls` `.epub` |
| Archives  | `.zip`                                               |
| Images    | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.tiff`          |
| Audio     | `.wav` `.mp3` `.m4a`                                 |

Text files (`.txt`, `.md`, `.py`, `.csv`, etc.) are intentionally excluded — Claude Code's `@` already handles those natively.

## Installation

### Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Node.js (any modern version)
- Python 3.10+ with pip

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/ayastaga/claude-markitdown/main/install.sh | bash
```

The installer will:

1. Check for Node.js (required)
2. Install `markitdown` via pip if not found
3. Patch `~/.claude/settings.json` to register and enable the plugin

Restart Claude Code after installing.

### Manual installation

**1. Install markitdown:**

```bash
pip install 'markitdown[all]'
```

**2. Add to `~/.claude/settings.json`:**

```json
{
  "extraKnownMarketplaces": {
    "claude-markitdown": {
      "source": {
        "source": "github",
        "repo": "ayastaga/claude-markitdown"
      }
    }
  },
  "enabledPlugins": {
    "claude-markitdown@claude-markitdown": true
  }
}
```

Restart Claude Code.

## How it works

The plugin registers a `UserPromptSubmit` hook. On every message, the hook scans for `/parse <path>` patterns before Claude sees the prompt. Matching files are converted via `markitdown` and injected as `additionalContext` — Claude receives clean markdown, never the raw binary.

A brief system message confirms conversion: `Parsed: report.pdf → markdown (4,231 chars). Injected into context.`

## License

MIT
