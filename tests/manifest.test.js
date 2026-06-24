'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  readFileManifest,
  writeFileManifest,
  detectChanges,
  buildManifestEntry,
  manifestPath,
  fileHash,
} = require('../hooks/lib/manifest');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('readFileManifest returns empty for missing manifest', () => {
  const tmp = makeTmpDir();
  try {
    const m = readFileManifest(tmp, 'no-such-context');
    assert.equal(m.context, 'no-such-context');
    assert.equal(m.updated, null);
    assert.deepEqual(m.files, {});
  } finally {
    rmrf(tmp);
  }
});

test('writeFileManifest + readFileManifest round-trips', () => {
  const tmp = makeTmpDir();
  try {
    const ctx = 'round-trip-ctx';
    const manifest = {
      files: {
        '/fake/a.pdf': { sha256: 'aaa', mtime: 100, chars: 50 },
      },
    };
    writeFileManifest(tmp, ctx, manifest);
    const loaded = readFileManifest(tmp, ctx);
    assert.equal(loaded.context, ctx);
    assert.ok(loaded.updated);
    assert.equal(loaded.files['/fake/a.pdf'].sha256, 'aaa');
    assert.equal(loaded.files['/fake/a.pdf'].mtime, 100);
    assert.equal(loaded.files['/fake/a.pdf'].chars, 50);
  } finally {
    rmrf(tmp);
  }
});

test('detectChanges identifies added files', () => {
  const tmp = makeTmpDir();
  try {
    const fp = path.join(tmp, 'new.txt');
    fs.writeFileSync(fp, 'hello');
    const result = detectChanges(tmp, 'add-ctx', [fp]);
    assert.deepEqual(result.added, [fp]);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.unchanged, []);
    assert.deepEqual(result.removed, []);
  } finally {
    rmrf(tmp);
  }
});

test('detectChanges identifies changed files', () => {
  const tmp = makeTmpDir();
  try {
    const fp = path.join(tmp, 'doc.txt');
    fs.writeFileSync(fp, 'original');
    const sha = fileHash(fp);
    const stat = fs.statSync(fp);

    const manifest = {
      files: {
        [fp]: { sha256: sha, mtime: stat.mtimeMs - 1000, chars: 8 },
      },
    };
    writeFileManifest(tmp, 'change-ctx', manifest);

    // Rewrite with different content
    fs.writeFileSync(fp, 'modified');

    const result = detectChanges(tmp, 'change-ctx', [fp]);
    assert.deepEqual(result.changed, [fp]);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.unchanged, []);
    assert.deepEqual(result.removed, []);
  } finally {
    rmrf(tmp);
  }
});

test('detectChanges identifies unchanged files (same mtime)', () => {
  const tmp = makeTmpDir();
  try {
    const fp = path.join(tmp, 'stable.txt');
    fs.writeFileSync(fp, 'same');
    const sha = fileHash(fp);
    const stat = fs.statSync(fp);

    const manifest = {
      files: {
        [fp]: { sha256: sha, mtime: stat.mtimeMs, chars: 4 },
      },
    };
    writeFileManifest(tmp, 'unchanged-ctx', manifest);

    const result = detectChanges(tmp, 'unchanged-ctx', [fp]);
    assert.deepEqual(result.unchanged, [fp]);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.removed, []);
  } finally {
    rmrf(tmp);
  }
});

test('detectChanges identifies removed files', () => {
  const tmp = makeTmpDir();
  try {
    const manifest = {
      files: {
        '/gone/file.pdf': { sha256: 'xyz', mtime: 999, chars: 10 },
      },
    };
    writeFileManifest(tmp, 'remove-ctx', manifest);

    const result = detectChanges(tmp, 'remove-ctx', []);
    assert.deepEqual(result.removed, ['/gone/file.pdf']);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.unchanged, []);
  } finally {
    rmrf(tmp);
  }
});

test('mtime fast-path skips hash check for unchanged file', () => {
  const tmp = makeTmpDir();
  try {
    const fp = path.join(tmp, 'fast.txt');
    fs.writeFileSync(fp, 'content');
    const stat = fs.statSync(fp);

    // Store with matching mtime but bogus hash -- fast path should still mark unchanged
    const manifest = {
      files: {
        [fp]: { sha256: 'bogus-hash-never-matches', mtime: stat.mtimeMs, chars: 7 },
      },
    };
    writeFileManifest(tmp, 'fast-ctx', manifest);

    const result = detectChanges(tmp, 'fast-ctx', [fp]);
    assert.deepEqual(result.unchanged, [fp]);
    assert.deepEqual(result.changed, []);
  } finally {
    rmrf(tmp);
  }
});

test('manifestPath produces deterministic path for same contextId', () => {
  const tmp = makeTmpDir();
  try {
    const p1 = manifestPath(tmp, 'ctx-abc');
    const p2 = manifestPath(tmp, 'ctx-abc');
    assert.equal(p1, p2);

    const p3 = manifestPath(tmp, 'ctx-different');
    assert.notEqual(p1, p3);
  } finally {
    rmrf(tmp);
  }
});
