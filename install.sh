#!/usr/bin/env bash
# claude-markitdown installer for Claude Code
#
# One line:
#   curl -fsSL https://raw.githubusercontent.com/ayastaga/claude-markitdown/main/install.sh | bash

set -euo pipefail

REPO="ayastaga/claude-markitdown"
SETTINGS="$HOME/.claude/settings.json"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()    { echo -e "${GREEN}[claude-markitdown]${NC} $*"; }
warn()    { echo -e "${YELLOW}[claude-markitdown]${NC} $*"; }
error()   { echo -e "${RED}[claude-markitdown]${NC} $*" >&2; }

# ── Prerequisites ────────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org and re-run."
  exit 1
fi

if ! command -v markitdown &>/dev/null; then
  warn "markitdown not found. Installing..."
  if command -v pip3 &>/dev/null; then
    pip3 install 'markitdown[all]'
  elif command -v pip &>/dev/null; then
    pip install 'markitdown[all]'
  else
    error "pip not found. Install Python + pip, then run: pip install 'markitdown[all]'"
    exit 1
  fi
  if ! command -v markitdown &>/dev/null; then
    error "markitdown installed but not in PATH. Add Python bin to PATH and re-run."
    exit 1
  fi
fi

info "markitdown $(markitdown --version 2>/dev/null || echo 'found') — OK"

# ── Patch settings.json ──────────────────────────────────────────────────────

if [[ ! -f "$SETTINGS" ]]; then
  mkdir -p "$(dirname "$SETTINGS")"
  echo '{}' > "$SETTINGS"
fi

python3 - "$SETTINGS" "$REPO" <<'PYEOF'
import json, sys, pathlib

settings_path = pathlib.Path(sys.argv[1])
repo = sys.argv[2]

with open(settings_path) as f:
    settings = json.load(f)

# Extract marketplace key from repo slug (part after /)
marketplace_key = repo.split('/')[-1]
plugin_key = f"{marketplace_key}@{marketplace_key}"

settings.setdefault('extraKnownMarketplaces', {})[marketplace_key] = {
    'source': {'source': 'github', 'repo': repo}
}
settings.setdefault('enabledPlugins', {})[plugin_key] = True

with open(settings_path, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print(f"Registered marketplace '{marketplace_key}' and enabled plugin '{plugin_key}'")
PYEOF

info "Patched $SETTINGS"
info "Done. Restart Claude Code for the hook to take effect."
info ""
info "Usage:"
info "  /parse ~/path/to/file.pdf             — inject into context"
info "  /parse ~/path/to/file.docx --output   — inject + save .md alongside"
info "  /parse ~/path/to/file.docx -o out.md  — inject + save to custom path"
