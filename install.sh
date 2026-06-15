#!/usr/bin/env bash
# parsemd installer for Claude Code
#
# Plugin install (namespaced /parsemd:parsemd):
#   curl -fsSL https://raw.githubusercontent.com/ayastaga/parsemd/main/install.sh | bash
#
# Standalone install (bare /parsemd):
#   curl -fsSL https://raw.githubusercontent.com/ayastaga/parsemd/main/install.sh | bash -s -- --standalone

set -euo pipefail

REPO="ayastaga/parsemd"
RAW="https://raw.githubusercontent.com/${REPO}/main"
MARKETPLACE_NAME="parsemd"
PLUGIN_KEY="parsemd@parsemd"
STANDALONE=false

for arg in "$@"; do
  [[ "$arg" == "--standalone" ]] && STANDALONE=true
done

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[parsemd]${NC} $*"; }
warn()  { echo -e "${YELLOW}[parsemd]${NC} $*"; }
error() { echo -e "${RED}[parsemd]${NC} $*" >&2; }

# ── Prerequisites ─────────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org and re-run."
  exit 1
fi

if ! command -v claude &>/dev/null; then
  error "Claude Code CLI not found. Install from https://claude.ai/code and re-run."
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

info "markitdown $(markitdown --version 2>/dev/null || echo '(version unknown)') — OK"

# ── Install ───────────────────────────────────────────────────────────────────

if [[ "$STANDALONE" == true ]]; then
  # Standalone: bare /parsemd command, no plugin namespace
  HOOK_DIR="$HOME/.claude/hooks"
  CMD_DIR="$HOME/.claude/commands"
  SETTINGS="$HOME/.claude/settings.json"

  mkdir -p "$HOOK_DIR" "$CMD_DIR"

  # Symlink if running from a cloned repo; download snapshot if curl-piped
  SCRIPT_DIR=""
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || true
  fi
  HOOK_SRC="${SCRIPT_DIR}/hooks/parsemd-hook.js"

  if [[ -n "$SCRIPT_DIR" && -f "$HOOK_SRC" ]]; then
    info "Symlinking hook from repo (updates apply automatically)..."
    ln -sf "$HOOK_SRC" "${HOOK_DIR}/parsemd-hook.js"
  else
    info "Downloading hook script..."
    curl -fsSL "${RAW}/hooks/parsemd-hook.js" -o "${HOOK_DIR}/parsemd-hook.js"
    warn "Snapshot installed. Re-run ./install.sh --standalone from a cloned repo for auto-updates."
  fi

  info "Adding /parsemd command..."
  printf -- '---\ndescription: Parse binary documents into markdown context\n---\n\n/parse $ARGUMENTS\n' \
    > "${CMD_DIR}/parsemd.md"

  # Merge hook into settings.json
  info "Registering hook in ${SETTINGS}..."
  if [[ ! -f "$SETTINGS" ]]; then
    echo '{}' > "$SETTINGS"
  fi
  HOOK_CMD="node \"${HOOK_DIR}/parsemd-hook.js\""
  # Use node to safely merge — avoids clobbering existing hooks
  node - "$SETTINGS" "$HOOK_CMD" <<'EOF'
const fs = require('fs');
const [,, settingsPath, hookCmd] = process.argv;
const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
s.hooks = s.hooks || {};
s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || [];
const entry = { matcher: '/parse', hooks: [{ type: 'command', command: hookCmd, timeout: 35 }] };
if (!s.hooks.UserPromptSubmit.some(e => e.hooks && e.hooks.some(h => h.command === hookCmd))) {
  s.hooks.UserPromptSubmit.push(entry);
}
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
EOF

  info "Done. Restart Claude Code."
  info ""
  info "Usage: /parsemd ~/path/to/file.pdf"

else
  # Plugin install: namespaced /parsemd:parsemd
  info "Registering marketplace '${MARKETPLACE_NAME}'..."
  claude plugin marketplace add "github:${REPO}" 2>/dev/null \
    && info "Marketplace registered." \
    || warn "Marketplace already registered or failed — continuing."

  info "Installing plugin '${PLUGIN_KEY}'..."
  claude plugin install "${PLUGIN_KEY}" \
    && info "Plugin installed." \
    || { error "Plugin install failed. Run: claude plugin install ${PLUGIN_KEY}"; exit 1; }

  info "Done. Restart Claude Code."
  info ""
  info "Usage: /parsemd:parsemd ~/path/to/file.pdf"
  info "Help:  /parsemd:help"
fi
