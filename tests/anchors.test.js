'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { annotate } = require('../hooks/lib/anchors');

test('pdf form-feed splits into numbered pages', () => {
  const md = 'page-1-text\fpage-2-text\fpage-3-text';
  const out = annotate('/x.pdf', md);
  assert.equal(out.format, 'pdf');
  assert.equal(out.pageCount, 3);
  assert.match(out.markdown, /<!-- page:1 -->/);
  assert.match(out.markdown, /<!-- page:2 -->/);
  assert.match(out.markdown, /<!-- page:3 -->/);
});

test('pdf without form-feeds emits no anchors', () => {
  const md = 'just some text without page breaks';
  const out = annotate('/x.pdf', md);
  assert.equal(out.pageCount, null);
  assert.ok(!out.markdown.includes('<!-- page:'));
});

test('pptx normalizes Slide number comments', () => {
  const md = '<!-- Slide number: 1 -->\ntitle\n<!-- Slide number: 2 -->\nbody';
  const out = annotate('/x.pptx', md);
  assert.equal(out.format, 'pptx');
  assert.equal(out.pageCount, 2);
  assert.match(out.markdown, /<!-- slide:1 -->/);
  assert.match(out.markdown, /<!-- slide:2 -->/);
});

test('xlsx anchors sheet headings', () => {
  const md = '## Sheet1\nfoo\n\n## Q4Data\nbar';
  const out = annotate('/x.xlsx', md);
  assert.equal(out.format, 'xlsx');
  assert.equal(out.pageCount, 2);
  assert.match(out.markdown, /<!-- sheet:Sheet1 -->\n## Sheet1/);
  assert.match(out.markdown, /<!-- sheet:Q4Data -->\n## Q4Data/);
});

test('docx passes through with format label', () => {
  const out = annotate('/x.docx', '# Heading\n\nbody');
  assert.equal(out.format, 'docx');
  assert.equal(out.pageCount, null);
  assert.equal(out.markdown, '# Heading\n\nbody');
});

test('unknown extensions still classified', () => {
  const out = annotate('/x.html', '<h1>hi</h1>');
  assert.equal(out.format, 'html');
});
