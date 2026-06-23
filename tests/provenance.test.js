'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashFile, buildHeader } = require('../hooks/lib/provenance');

test('hashFile returns 64-hex sha256', () => {
  const fp = path.join(os.tmpdir(), `parsemd-prov-${process.pid}.txt`);
  fs.writeFileSync(fp, 'hello');
  try {
    const h = hashFile(fp);
    assert.match(h, /^[a-f0-9]{64}$/);
  } finally {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
});

test('hashFile returns null for missing file', () => {
  assert.equal(hashFile('/no/such/file/at/all'), null);
});

test('buildHeader includes Source / Engine / Converted', () => {
  const out = buildHeader({
    source: '/tmp/x.pdf',
    engine: 'markitdown',
    engineVersion: '0.1.6',
    sha256: 'a'.repeat(64),
    chars: 12345,
    pages: 4,
    format: 'pdf',
  });
  assert.match(out, /^\[parsemd\]/);
  assert.match(out, /Source: \/tmp\/x\.pdf/);
  assert.match(out, /Engine: markitdown 0\.1\.6/);
  assert.match(out, /Converted: \d{4}-\d{2}-\d{2}T/);
  assert.match(out, /SHA256: a{16}…/);
  assert.match(out, /4 pages \| 12,345 chars/);
  assert.match(out, /---\n$/);
});

test('buildHeader labels slides for pptx and sheets for xlsx', () => {
  const ppt = buildHeader({ source: 'x.pptx', engine: 'markitdown', chars: 10, pages: 7, format: 'pptx' });
  assert.match(ppt, /7 slides/);
  const xls = buildHeader({ source: 'x.xlsx', engine: 'markitdown', chars: 10, pages: 3, format: 'xlsx' });
  assert.match(xls, /3 sheets/);
});

test('buildHeader records URL fetch line', () => {
  const out = buildHeader({
    source: 'https://example.com/x.pdf',
    viaUrl: 'https://example.com/x.pdf',
    engine: 'markitdown',
    engineVersion: '0.1.6',
    chars: 1,
  });
  assert.match(out, /Fetched: https:\/\/example\.com\/x\.pdf/);
});
