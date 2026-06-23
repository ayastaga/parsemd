'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load, DEFAULTS } = require('../hooks/lib/settings');

function tmpSettings(content) {
  const fp = path.join(os.tmpdir(), `parsemd-settings-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(fp, content, 'utf8');
  return fp;
}

test('returns defaults when file missing', () => {
  const cfg = load('/no/such/settings.json');
  assert.deepEqual(cfg, { ...DEFAULTS });
});

test('returns defaults when file malformed', () => {
  const fp = tmpSettings('not-json-{]');
  try {
    const cfg = load(fp);
    assert.deepEqual(cfg, { ...DEFAULTS });
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('reads plugins.parsemd subkey and merges with defaults', () => {
  const fp = tmpSettings(JSON.stringify({
    other: 'ignored',
    plugins: { parsemd: { projectCache: true, urlTimeoutMs: 60000 } },
  }));
  try {
    const cfg = load(fp);
    assert.equal(cfg.projectCache, true);
    assert.equal(cfg.urlTimeoutMs, 60000);
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('absent subkey falls back to defaults', () => {
  const fp = tmpSettings(JSON.stringify({ plugins: { other: {} } }));
  try {
    const cfg = load(fp);
    assert.equal(cfg.projectCache, false);
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});
