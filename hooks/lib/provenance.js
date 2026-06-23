'use strict';

const fs = require('fs');
const crypto = require('crypto');

function hashFile(filePath) {
  try {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(filePath));
    return h.digest('hex');
  } catch (_) {
    return null;
  }
}

function unitLabel(format) {
  switch (format) {
    case 'pptx': return 'slides';
    case 'xlsx': return 'sheets';
    default: return 'pages';
  }
}

function buildHeader({ source, engine, engineVersion, sha256, chars, pages, format, viaUrl }) {
  const lines = ['[parsemd]'];
  if (source) lines.push(`Source: ${source}`);
  if (viaUrl) lines.push(`Fetched: ${viaUrl}`);
  const engineLine = engineVersion ? `${engine} ${engineVersion}` : engine;
  lines.push(`Engine: ${engineLine}`);
  lines.push(`Converted: ${new Date().toISOString()}`);
  if (sha256) lines.push(`SHA256: ${sha256.slice(0, 16)}…`);
  const counts = [];
  if (pages) counts.push(`${pages} ${unitLabel(format)}`);
  if (chars != null) counts.push(`${chars.toLocaleString()} chars`);
  if (counts.length) lines.push(counts.join(' | '));
  lines.push('---', '');
  return lines.join('\n');
}

module.exports = { hashFile, buildHeader, unitLabel };
