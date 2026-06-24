'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectLowText,
  replacePageSections,
  buildPixelDirective,
  isRenderAvailable,
  LOW_TEXT_THRESHOLD,
} = require('../hooks/lib/pixel');

// Helper: build a page section with exactly N non-whitespace chars of content
function makePageMd(pageNum, contentChars) {
  const body = 'x'.repeat(contentChars);
  return `<!-- page:${pageNum} -->\n${body}\n`;
}

test('detectLowText returns empty for text-rich pages', () => {
  const md = makePageMd(1, 200) + makePageMd(2, 150);
  const result = detectLowText(md, 2);
  assert.deepStrictEqual(result, []);
});

test('detectLowText identifies pages under threshold', () => {
  const md = makePageMd(1, 200) + makePageMd(2, 10) + makePageMd(3, 5);
  const result = detectLowText(md, 3);
  assert.deepStrictEqual(result, [2, 3]);
});

test('detectLowText handles document with no page anchors', () => {
  const md = 'Just some plain text without any anchors.';
  const result = detectLowText(md, 1);
  assert.deepStrictEqual(result, []);
});

test('detectLowText handles single page', () => {
  const md = makePageMd(1, 10);
  const result = detectLowText(md, 1);
  assert.deepStrictEqual(result, [1]);
});

test('replacePageSections replaces only low-text pages, preserves text-rich', () => {
  const richContent = 'x'.repeat(200);
  const md = `<!-- page:1 -->\n${richContent}\n<!-- page:2 -->\nshort\n<!-- page:3 -->\n${richContent}\n`;

  const lowTextPages = [2];
  const rendered = [{ page: 2, imagePath: '/tmp/p2.png' }];

  const result = replacePageSections(md, lowTextPages, rendered);

  // Page 1 rich content preserved
  assert.match(result, /<!-- page:1 -->/);
  assert.ok(result.includes(richContent));

  // Page 2 replaced with pixel directive
  assert.match(result, /<!-- page:2 \[PIXEL FALLBACK\] -->/);
  assert.match(result, /\/tmp\/p2\.png/);

  // Page 3 rich content preserved
  assert.match(result, /<!-- page:3 -->/);
});

test('replacePageSections handles no anchors', () => {
  const md = 'No anchors here, just plain markdown.';
  const result = replacePageSections(md, [], []);
  assert.equal(result, md);
});

test('buildPixelDirective includes page number and image path', () => {
  const directive = buildPixelDirective(7, '/tmp/scan-p7.png');
  assert.match(directive, /page:7/);
  assert.match(directive, /PIXEL FALLBACK/);
  assert.match(directive, /\/tmp\/scan-p7\.png/);
  assert.match(directive, /Page 7/);
});

test('isRenderAvailable returns boolean without throwing', () => {
  const result = isRenderAvailable();
  assert.equal(typeof result, 'boolean');
});
