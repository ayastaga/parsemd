'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cache = require('../hooks/lib/cache');

test('sessionCacheFile is in tmpdir and namespaced', () => {
  const fp = cache.sessionCacheFile('abc-123');
  assert.equal(path.dirname(fp), os.tmpdir());
  assert.match(path.basename(fp), /^parsemd-cache-abc-123\.json$/);
});

test('save + load round-trips', () => {
  const fp = path.join(os.tmpdir(), `parsemd-cache-test-${process.pid}.json`);
  try {
    cache.save(fp, { 'a:1': 'hello' });
    assert.deepEqual(cache.load(fp), { 'a:1': 'hello' });
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('load returns {} for missing file', () => {
  assert.deepEqual(cache.load('/no/such/file/at/all'), {});
});

test('key returns null for missing file', () => {
  assert.equal(cache.key('/no/such/file/at/all'), null);
});

test('key includes mtime', () => {
  const fp = path.join(os.tmpdir(), `parsemd-cache-keytest-${process.pid}`);
  fs.writeFileSync(fp, 'x');
  try {
    const k = cache.key(fp);
    assert.match(k, new RegExp(`^${fp.replace(/\//g, '\\/')}:\\d`));
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('gcStale removes only old parsemd-cache files', () => {
  const oldFile = path.join(os.tmpdir(), `parsemd-cache-old-${process.pid}.json`);
  const newFile = path.join(os.tmpdir(), `parsemd-cache-new-${process.pid}.json`);
  const unrelated = path.join(os.tmpdir(), `unrelated-${process.pid}.json`);
  fs.writeFileSync(oldFile, '{}');
  fs.writeFileSync(newFile, '{}');
  fs.writeFileSync(unrelated, '{}');
  const past = (Date.now() - 25 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(oldFile, past, past);
  try {
    cache.gcStale();
    assert.equal(fs.existsSync(oldFile), false, 'old parsemd cache should be removed');
    assert.equal(fs.existsSync(newFile), true, 'fresh parsemd cache should remain');
    assert.equal(fs.existsSync(unrelated), true, 'unrelated tmp file should remain');
  } finally {
    for (const f of [oldFile, newFile, unrelated]) try { fs.unlinkSync(f); } catch (_) {}
  }
});

test('hashKey returns 64-hex sha256', () => {
  const fp = path.join(os.tmpdir(), `parsemd-hashkey-${process.pid}.txt`);
  fs.writeFileSync(fp, 'hello world');
  try {
    const h = cache.hashKey(fp);
    assert.match(h, /^[a-f0-9]{64}$/);
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('project cache write/read round-trips and creates .gitignore', () => {
  const tmpDir = path.join(os.tmpdir(), `parsemd-pcache-test-${process.pid}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const sha = 'a'.repeat(64);
    cache.writeProjectCache(tmpDir, sha, '# Hello\n\nWorld');
    const got = cache.readProjectCache(tmpDir, sha);
    assert.equal(got, '# Hello\n\nWorld');
    const gi = fs.readFileSync(path.join(tmpDir, '.parsemd', '.gitignore'), 'utf8');
    assert.ok(gi.includes('cache/'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('readProjectCache misses return null', () => {
  const tmpDir = path.join(os.tmpdir(), `parsemd-pcache-miss-${process.pid}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    assert.equal(cache.readProjectCache(tmpDir, 'b'.repeat(64)), null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
