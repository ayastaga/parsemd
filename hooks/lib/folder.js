'use strict';

const fs = require('fs');
const path = require('path');
const { ParseError } = require('./util');

const SKIP_DIRS = new Set(['.parsemd', 'node_modules', '.git', '__pycache__', '.DS_Store']);
const MAX_FOLDER_FILES = 50;

const { SUPPORTED_EXTENSIONS } = require('./engine');

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + re + '$', 'i');
}

function matchesAny(name, patterns) {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some(p => globToRegex(p).test(name));
}

function scanFolder(dirPath, { depth = Infinity, include = null, exclude = null } = {}) {
  dirPath = path.resolve(dirPath);

  if (!fs.existsSync(dirPath)) {
    throw new ParseError('DIR_NOT_FOUND', `directory not found: ${dirPath}`);
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new ParseError('NOT_A_DIRECTORY', `not a directory: ${dirPath}`);
  }

  const includePatterns = include ? (Array.isArray(include) ? include : include.split(',')) : null;
  const excludePatterns = exclude ? (Array.isArray(exclude) ? exclude : exclude.split(',')) : null;

  const results = [];

  function walk(dir, currentDepth) {
    if (currentDepth > depth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(fullPath, currentDepth + 1);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      if (includePatterns && !matchesAny(entry.name, includePatterns)) continue;
      if (excludePatterns && matchesAny(entry.name, excludePatterns)) continue;

      results.push(fullPath);
    }
  }

  walk(dirPath, 0);
  results.sort();

  const warning = results.length > MAX_FOLDER_FILES
    ? `Found ${results.length} files, capped at ${MAX_FOLDER_FILES}. Use --include to filter.`
    : null;

  return {
    files: results.slice(0, MAX_FOLDER_FILES),
    total: results.length,
    warning,
  };
}

module.exports = { scanFolder, globToRegex, MAX_FOLDER_FILES };
