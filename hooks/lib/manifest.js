'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function manifestDir(cwd) {
  return path.join(cwd, '.parsemd', 'manifests');
}

function manifestKey(contextId) {
  return crypto.createHash('sha256').update(contextId).digest('hex').slice(0, 16);
}

function manifestPath(cwd, contextId) {
  return path.join(manifestDir(cwd), manifestKey(contextId) + '.json');
}

function readFileManifest(cwd, contextId) {
  const fp = manifestPath(cwd, contextId);
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (_) {
    return { context: contextId, updated: null, files: {} };
  }
}

function writeFileManifest(cwd, contextId, manifest) {
  const dir = manifestDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  manifest.context = contextId;
  manifest.updated = new Date().toISOString();
  fs.writeFileSync(manifestPath(cwd, contextId), JSON.stringify(manifest, null, 2), 'utf8');
}

function fileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function detectChanges(cwd, contextId, currentFiles) {
  const manifest = readFileManifest(cwd, contextId);
  const old = manifest.files || {};
  const oldPaths = new Set(Object.keys(old));

  const added = [];
  const changed = [];
  const unchanged = [];
  const removed = [];

  for (const fp of currentFiles) {
    if (!oldPaths.has(fp)) {
      added.push(fp);
      continue;
    }
    oldPaths.delete(fp);

    // Fast path: check mtime first
    const stat = fs.statSync(fp);
    const mtime = stat.mtimeMs;
    if (old[fp].mtime === mtime) {
      unchanged.push(fp);
      continue;
    }

    // Slow path: check hash
    const hash = fileHash(fp);
    if (hash === old[fp].sha256) {
      unchanged.push(fp);
    } else {
      changed.push(fp);
    }
  }

  // Remaining oldPaths are removed
  for (const fp of oldPaths) {
    removed.push(fp);
  }

  return { added, changed, removed, unchanged };
}

function buildManifestEntry(filePath, sha256, chars) {
  const stat = fs.statSync(filePath);
  return {
    sha256,
    mtime: stat.mtimeMs,
    chars: chars || 0,
  };
}

module.exports = {
  readFileManifest,
  writeFileManifest,
  detectChanges,
  buildManifestEntry,
  manifestPath,
  fileHash,
};
