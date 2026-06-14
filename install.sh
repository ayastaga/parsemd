#!/usr/bin/env bash
# claude-markitdown installer for Claude Code
#
# One line:
#   curl -fsSL https://raw.githubusercontent.com/ayastaga/claude-markitdown/main/install.sh | bash

set -euo pipefail

REPO="ayastaga/claude-markitdown"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()    { echo -e "${GREEN}[claude-markitdown]${NC} $*"; }
warn()    { echo -e "${YELLOW}[claude-markitdown]${NC} $*"; }
error()   { echo -e "${RED}[claude-markitdown]${NC} $*" >&2; }

# ── Prerequisites ────────────────────────────────────────────────────────────

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

info "markitdown $(markitdown --version 2>/dev/null || echo 'found') — OK"

# ── Register marketplace + install plugin via Claude Code CLI ─────────────────
# Using `claude plugin` commands instead of patching settings.json directly so
# that Claude Code resolves its own config path — works correctly inside dev
# containers, Docker, and other environments where $HOME may differ from the
# Claude Code host config location.

MARKETPLACE_KEY="${REPO##*/}"  # claude-markitdown
PLUGIN_KEY="${MARKETPLACE_KEY}@${MARKETPLACE_KEY}"

info "Registering marketplace '${MARKETPLACE_KEY}'..."
claude plugin marketplace add "github:${REPO}" 2>/dev/null \
  && info "Marketplace registered." \
  || warn "Marketplace already registered or failed — continuing."

info "Installing plugin '${PLUGIN_KEY}'..."
claude plugin install "${PLUGIN_KEY}" \
  && info "Plugin installed." \
  || { error "Plugin install failed. Run: claude plugin install ${PLUGIN_KEY}"; exit 1; }

info "Done. Restart Claude Code for the plugin to take effect."
info ""
info "Usage:"
info "  /parse ~/path/to/file.pdf             — inject into context"
info "  /parse ~/path/to/file.docx --output   — inject + save .md alongside"
info "  /parse ~/path/to/file.docx -o out.md  — inject + save to custom path"
