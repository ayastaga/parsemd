'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { expandPath, stripCodeBlocks, ParseError } = require('../hooks/lib/util');

test('expandPath strips leading @', () => {
  assert.equal(expandPath('@/tmp/x.pdf'), '/tmp/x.pdf');
});

test('expandPath expands ~/...', () => {
  assert.equal(expandPath('~/foo.pdf'), path.join(os.homedir(), 'foo.pdf'));
});

test('expandPath resolves relative', () => {
  const got = expandPath('foo.pdf');
  assert.equal(path.isAbsolute(got), true);
});

test('stripCodeBlocks removes fenced block content', () => {
  const out = stripCodeBlocks('a\n```\n/parsemd x.pdf\n```\nb');
  assert.ok(!out.includes('/parsemd'));
  assert.match(out, /^a/);
  assert.match(out, /b$/);
});

test('stripCodeBlocks removes inline backticks', () => {
  const out = stripCodeBlocks('use `/parsemd x.pdf` here');
  assert.ok(!out.includes('/parsemd'));
});

test('stripCodeBlocks preserves text length characters where possible', () => {
  const input = 'a `bb` c';
  const out = stripCodeBlocks(input);
  assert.equal(out.length, input.length);
});

test('ParseError carries code + detail', () => {
  const e = new ParseError('FOO', 'bar', 'detail');
  assert.equal(e.code, 'FOO');
  assert.equal(e.message, 'bar');
  assert.equal(e.detail, 'detail');
});

test('expandPath leaves http URLs untouched', () => {
  assert.equal(expandPath('http://example.com/report.pdf'), 'http://example.com/report.pdf');
});

test('expandPath leaves https URLs untouched', () => {
  assert.equal(expandPath('https://cdn.example.com/doc.docx'), 'https://cdn.example.com/doc.docx');
});
