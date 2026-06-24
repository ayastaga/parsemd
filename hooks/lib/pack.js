'use strict';

const fs = require('fs');
const path = require('path');
const { ParseError } = require('./util');

function packsDir(cwd) {
  return path.join(cwd, '.parsemd', 'packs');
}

function ensurePacksGitignore(cwd) {
  const giPath = path.join(cwd, '.parsemd', '.gitignore');
  try {
    const existing = fs.readFileSync(giPath, 'utf8');
    if (!existing.includes('packs/')) {
      fs.writeFileSync(giPath, existing.trimEnd() + '\npacks/\n', 'utf8');
    }
  } catch (_) {
    fs.writeFileSync(giPath, 'packs/\n', 'utf8');
  }
}

function createPack(cwd, name, results) {
  const dir = path.join(packsDir(cwd), name);
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  let totalChars = 0;

  const files = results.map(r => {
    const chars = r.markdown.length;
    totalChars += chars;
    return {
      basename: path.basename(r.filename),
      path: r.source,
      sha256: r.sha256,
      chars,
    };
  });

  const manifest = {
    name,
    created: now,
    updated: now,
    files,
    totalChars,
  };

  // If pack already exists, preserve original created date
  const manifestPath = path.join(dir, 'manifest.json');
  try {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (prev.created) manifest.created = prev.created;
  } catch (_) {}

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const bundle = results
    .map(r => `## Content of ${path.basename(r.filename)}\n\n${r.markdown}`)
    .join('\n\n---\n\n');
  fs.writeFileSync(path.join(dir, 'bundle.md'), bundle, 'utf8');

  ensurePacksGitignore(cwd);

  return { name, fileCount: results.length, totalChars };
}

function loadPack(cwd, name) {
  const dir = path.join(packsDir(cwd), name);
  const manifestPath = path.join(dir, 'manifest.json');
  const bundlePath = path.join(dir, 'bundle.md');

  if (!fs.existsSync(manifestPath)) {
    throw new ParseError('PACK_NOT_FOUND', `Pack "${name}" not found`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const markdown = fs.readFileSync(bundlePath, 'utf8');

  return { markdown, manifest };
}

function listPacks(cwd) {
  const dir = packsDir(cwd);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }

  const packs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(dir, entry.name, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      packs.push({
        name: manifest.name,
        fileCount: manifest.files.length,
        totalChars: manifest.totalChars,
        updated: manifest.updated,
      });
    } catch (_) {}
  }

  return packs;
}

module.exports = { createPack, loadPack, listPacks, packsDir };
