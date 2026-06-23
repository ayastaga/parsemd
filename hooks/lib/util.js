'use strict';

const path = require('path');
const os = require('os');

function expandPath(fp) {
  if (!fp) return fp;
  if (/^https?:\/\//i.test(fp)) return fp;
  const clean = fp.replace(/^@/, '');
  if (clean.startsWith('~/')) return path.join(os.homedir(), clean.slice(2));
  if (clean === '~') return os.homedir();
  return path.resolve(clean);
}

function stripCodeBlocks(text) {
  if (!text) return text;
  return text
    .replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]+`/g, m => m.replace(/[^\n]/g, ' '));
}

class ParseError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail || '';
  }
}

module.exports = { expandPath, stripCodeBlocks, ParseError };
