'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applySlicing, sliceByPages, sliceBySheet,
  sliceBySection, sliceByHeadingLevel, sliceHeadTail, parseRanges,
} = require('../hooks/lib/slice');

test('parseRanges handles single, comma-separated, and ranges', () => {
  const r = parseRanges('1,3,5-7');
  assert.deepEqual([...r].sort((a, b) => a - b), [1, 3, 5, 6, 7]);
});

test('sliceByPages extracts numbered page anchors', () => {
  const md = '<!-- page:1 -->\nPage1\n\n<!-- page:2 -->\nPage2\n\n<!-- page:3 -->\nPage3';
  const out = sliceByPages(md, '2');
  assert.match(out, /Page2/);
  assert.ok(!out.includes('Page1'));
  assert.ok(!out.includes('Page3'));
});

test('sliceByPages handles range', () => {
  const md = '<!-- page:1 -->\nA\n\n<!-- page:2 -->\nB\n\n<!-- page:3 -->\nC\n\n<!-- page:4 -->\nD';
  const out = sliceByPages(md, '2-3');
  assert.match(out, /B/);
  assert.match(out, /C/);
  assert.ok(!out.includes('\nA'));
  assert.ok(!out.includes('\nD'));
});

test('sliceByPages works with slide anchors', () => {
  const md = '<!-- slide:1 -->\nSlide1\n\n<!-- slide:2 -->\nSlide2\n\n<!-- slide:3 -->\nSlide3';
  const out = sliceByPages(md, '1,3');
  assert.match(out, /Slide1/);
  assert.match(out, /Slide3/);
  assert.ok(!out.includes('Slide2'));
});

test('sliceByPages returns full markdown if no anchors', () => {
  const md = 'no anchors here';
  assert.equal(sliceByPages(md, '1-3'), md);
});

test('sliceBySheet selects by name', () => {
  const md = '<!-- sheet:Revenue -->\n## Revenue\ndata1\n\n<!-- sheet:Costs -->\n## Costs\ndata2';
  const out = sliceBySheet(md, 'Revenue');
  assert.match(out, /data1/);
  assert.ok(!out.includes('data2'));
});

test('sliceBySheet selects by index', () => {
  const md = '<!-- sheet:A -->\ndata-A\n\n<!-- sheet:B -->\ndata-B\n\n<!-- sheet:C -->\ndata-C';
  const out = sliceBySheet(md, '0,2');
  assert.match(out, /data-A/);
  assert.match(out, /data-C/);
  assert.ok(!out.includes('data-B'));
});

test('sliceBySection extracts matching section + subsections', () => {
  const md = '# Intro\nIntro text\n\n## Risk Factors\nRisk text\n\n### Sub risk\nMore\n\n## Financials\nMoney';
  const out = sliceBySection(md, 'Risk');
  assert.match(out, /Risk Factors/);
  assert.match(out, /Sub risk/);
  assert.ok(!out.includes('Financials'));
  assert.ok(!out.includes('Intro text'));
});

test('sliceBySection returns full if no match', () => {
  const md = '# Heading\nText';
  assert.equal(sliceBySection(md, 'nonexistent'), md);
});

test('sliceByHeadingLevel extracts only specified level', () => {
  const md = '# H1\nTop\n\n## First\nA\n\n### Sub\nB\n\n## Second\nC\n\n# Another H1\nD';
  const out = sliceByHeadingLevel(md, 2);
  assert.match(out, /First/);
  assert.match(out, /Second/);
  assert.ok(!out.includes('# H1'));
  assert.ok(!out.includes('Another H1'));
});

test('sliceHeadTail head only', () => {
  const md = 'a'.repeat(100);
  const out = sliceHeadTail(md, 10, null);
  assert.equal(out.length, 40);
});

test('sliceHeadTail tail only', () => {
  const md = 'a'.repeat(100);
  const out = sliceHeadTail(md, null, 10);
  assert.equal(out.length, 40);
});

test('sliceHeadTail both with truncation marker', () => {
  const md = 'a'.repeat(200);
  const out = sliceHeadTail(md, 10, 10);
  assert.match(out, /\[…truncated…\]/);
  assert.ok(out.length < 200);
});

test('applySlicing chains multiple filters', () => {
  const md = '<!-- page:1 -->\n# Intro\nA\n\n<!-- page:2 -->\n# Details\nB\n\n<!-- page:3 -->\n# End\nC';
  const out = applySlicing(md, { pages: '2-3', section: 'Details' });
  assert.match(out, /Details/);
  assert.ok(!out.includes('Intro'));
  assert.ok(!out.includes('End'));
});
