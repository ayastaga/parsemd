'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_DIR = os.tmpdir();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function sessionCacheFile(sessionId) {
  return path.join(CACHE_DIR, `parsemd-cache-${sessionId || 'default'}.json`);
}

function load(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

function save(file, cache) {
  try {
    fs.writeFileSync(file, JSON.stringify(cache), 'utf8');
  } catch (_) {}
}

function key(filePath) {
  try {
    return `${filePath}:${fs.statSync(filePath).mtimeMs}`;
  } catch (_) {
    return null;
  }
}

function gcStale() {
  const now = Date.now();
  let entries;
  try {
    entries = fs.readdirSync(CACHE_DIR);
  } catch (_) {
    return;
  }
  for (const name of entries) {
    if (!name.startsWith('parsemd-cache-') || !name.endsWith('.json')) continue;
    const full = path.join(CACHE_DIR, name);
    try {
      const st = fs.statSync(full);
      if (now - st.mtimeMs > CACHE_TTL_MS) fs.unlinkSync(full);
    } catch (_) {}
  }
}

module.exports = {
  sessionCacheFile, load, save, key, gcStale,
  CACHE_DIR, CACHE_TTL_MS,
};
