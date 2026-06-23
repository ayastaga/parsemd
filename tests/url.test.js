'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const { isUrl, download } = require('../hooks/lib/url');

test('isUrl detects http and https', () => {
  assert.equal(isUrl('https://example.com/x.pdf'), true);
  assert.equal(isUrl('http://example.com'), true);
  assert.equal(isUrl('/tmp/x.pdf'), false);
  assert.equal(isUrl('~/x.pdf'), false);
  assert.equal(isUrl(undefined), false);
});

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('download saves file to tmpdir and reports size', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.end(Buffer.from('%PDF-1.4 fake'));
  });
  try {
    const { port } = server.address();
    const r = await download(`http://127.0.0.1:${port}/x.pdf`, { timeout: 4000 });
    try {
      assert.ok(fs.existsSync(r.path));
      assert.equal(r.size, 13);
      assert.match(r.path, /\.pdf$/);
    } finally {
      try { fs.unlinkSync(r.path); } catch (_) {}
    }
  } finally {
    server.close();
  }
});

test('download rejects on 404', async () => {
  const server = await startServer((req, res) => { res.writeHead(404); res.end(); });
  try {
    const { port } = server.address();
    await assert.rejects(
      download(`http://127.0.0.1:${port}/missing.pdf`, { timeout: 4000 }),
      err => err.code === 'HTTP_ERROR' && err.status === 404,
    );
  } finally {
    server.close();
  }
});

test('download infers ext from content-type when path has none', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  try {
    const { port } = server.address();
    const r = await download(`http://127.0.0.1:${port}/data`, { timeout: 4000 });
    try {
      assert.match(r.path, /\.json$/);
    } finally {
      try { fs.unlinkSync(r.path); } catch (_) {}
    }
  } finally {
    server.close();
  }
});
