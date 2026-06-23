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
HOOK_TIMEOUT=320
LIB_FILES=("util.js" "sandbox.js" "engine.js" "cache.js" "parse-cmd.js" "settings.js" "url.js" "provenance.js" "anchors.js")
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
  HOOK_DIR="$HOME/.claude/hooks/parsemd"
  CMD_DIR="$HOME/.claude/commands"
  SETTINGS="$HOME/.claude/settings.json"

  mkdir -p "$HOOK_DIR/lib" "$CMD_DIR"

  SCRIPT_DIR=""
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || true
  fi
  HOOK_SRC="${SCRIPT_DIR}/hooks/parsemd-hook.js"

  if [[ -n "$SCRIPT_DIR" && -f "$HOOK_SRC" ]]; then
    info "Symlinking hook from repo (updates apply automatically)..."
    ln -sf "$HOOK_SRC" "${HOOK_DIR}/parsemd-hook.js"
    mkdir -p "${HOOK_DIR}/lib"
    for f in "${LIB_FILES[@]}"; do
      ln -sf "${SCRIPT_DIR}/hooks/lib/${f}" "${HOOK_DIR}/lib/${f}"
    done
  else
    info "Downloading hook scripts..."
    curl -fsSL "${RAW}/hooks/parsemd-hook.js" -o "${HOOK_DIR}/parsemd-hook.js"
    for f in "${LIB_FILES[@]}"; do
      curl -fsSL "${RAW}/hooks/lib/${f}" -o "${HOOK_DIR}/lib/${f}"
    done
    warn "Snapshot installed. Re-run ./install.sh --standalone from a cloned repo for auto-updates."
  fi

  info "Adding /parsemd command..."
  printf -- '---\ndescription: Parse binary documents into markdown context\n---\n\n/parse $ARGUMENTS\n' \
    > "${CMD_DIR}/parsemd.md"

  info "Registering hook in ${SETTINGS}..."
  if [[ ! -f "$SETTINGS" ]]; then
    echo '{}' > "$SETTINGS"
  fi
  HOOK_CMD="node \"${HOOK_DIR}/parsemd-hook.js\""

  HOOK_CMD="$HOOK_CMD" HOOK_TIMEOUT="$HOOK_TIMEOUT" SETTINGS_PATH="$SETTINGS" node <<'EOF'
const fs = require('fs');
const settingsPath = process.env.SETTINGS_PATH;
const hookCmd = process.env.HOOK_CMD;
const timeout = Number(process.env.HOOK_TIMEOUT) || 320;

const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
s.hooks = s.hooks || {};
s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit || [];

const existing = [];
for (const e of s.hooks.UserPromptSubmit) {
  if (!e || !Array.isArray(e.hooks)) continue;
  for (const h of e.hooks) {
    if (typeof h.command !== 'string') continue;
    if (/parsemd-hook\.js|CLAUDE_PLUGIN_ROOT.*parsemd/.test(h.command)) existing.push(h.command);
  }
}

if (existing.some(c => c !== hookCmd)) {
  console.error('\n[parsemd] WARNING: Detected another parsemd hook already registered:');
  for (const c of existing) console.error('  ' + c);
  console.error('  Multiple registrations cause double-fire on /parse. Remove the other entry from settings.json or aborting may be safer.\n');
}

let updated = false;
for (const e of s.hooks.UserPromptSubmit) {
  if (!e || !Array.isArray(e.hooks)) continue;
  for (const h of e.hooks) {
    if (h.command === hookCmd) { h.timeout = timeout; updated = true; }
  }
}
if (!updated) {
  s.hooks.UserPromptSubmit.push({
    matcher: '/parse',
    hooks: [{ type: 'command', command: hookCmd, timeout }],
  });
}
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
EOF

  info "Done. Restart Claude Code."
  info ""
  info "Usage: /parsemd ~/path/to/file.pdf"

else
  if [[ -f "$HOME/.claude/settings.json" ]]; then
    if node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const h=(s.hooks&&s.hooks.UserPromptSubmit)||[];const found=h.some(e=>(e.hooks||[]).some(x=>/parsemd-hook\.js/.test(x.command||'')));process.exit(found?0:1)" "$HOME/.claude/settings.json" 2>/dev/null; then
      warn "Detected a standalone parsemd hook in ~/.claude/settings.json."
      warn "Installing the plugin alongside it will cause double-fire on /parse."
      warn "Remove the standalone hook entry first, or run: ./install.sh --standalone to upgrade it in place."
      exit 1
    fi
  fi

  info "Registering marketplace '${MARKETPLACE_NAME}'..."
  claude plugin marketplace add "${REPO}" 2>/dev/null \
    && info "Marketplace registered." \
    || warn "Marketplace already registered or failed — continuing."

  info "Installing plugin '${PLUGIN_KEY}'..."
  claude plugin install "${PLUGIN_KEY}" \
    && info "Plugin installed." \
    || { error "Plugin install failed. Run: claude plugin install ${PLUGIN_KEY}"; exit 1; }

  info "Done. Restart Claude Code."
  info ""
  info "Usage: /parsemd:parsemd ~/path/to/file.pdf"
  info "Help:  /parsemd:parsemd-help"
fi
