'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

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

function hashKey(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_) {
    return null;
  }
}

function projectCacheDir(sessionCwd) {
  return path.join(sessionCwd, '.parsemd', 'cache');
}

function ensureGitignoreEntry(sessionCwd, entry) {
  const parsemdDir = path.join(sessionCwd, '.parsemd');
  fs.mkdirSync(parsemdDir, { recursive: true });
  const giPath = path.join(parsemdDir, '.gitignore');
  try {
    const existing = fs.readFileSync(giPath, 'utf8');
    if (!existing.includes(entry)) {
      fs.writeFileSync(giPath, existing.trimEnd() + '\n' + entry + '\n', 'utf8');
    }
  } catch (_) {
    fs.writeFileSync(giPath, entry + '\n', 'utf8');
  }
}

function ensureProjectCache(sessionCwd) {
  const dir = projectCacheDir(sessionCwd);
  fs.mkdirSync(dir, { recursive: true });
  ensureGitignoreEntry(sessionCwd, 'cache/');
  return dir;
}

function readProjectCache(sessionCwd, sha) {
  if (!sha) return null;
  const fp = path.join(projectCacheDir(sessionCwd), sha + '.md');
  try {
    return fs.readFileSync(fp, 'utf8');
  } catch (_) {
    return null;
  }
}

function writeProjectCache(sessionCwd, sha, markdown) {
  if (!sha) return;
  const dir = ensureProjectCache(sessionCwd);
  fs.writeFileSync(path.join(dir, sha + '.md'), markdown, 'utf8');
}

module.exports = {
  sessionCacheFile, load, save, key, gcStale,
  hashKey, projectCacheDir, ensureProjectCache, ensureGitignoreEntry, readProjectCache, writeProjectCache,
  CACHE_DIR, CACHE_TTL_MS,
};
