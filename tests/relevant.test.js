'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crudeStem, tokenize, extractQuery, extractSections,
  scoreSections, selectSections, buildTOC, buildRelevantOutput,
  extractRelevant,
  STOP_WORDS, FULL_INJECT_THRESHOLD, MIN_SECTIONS,
} = require('../hooks/lib/relevant');

/* ---------- tokenize ---------------------------------------------- */

test('tokenize removes stop words', () => {
  const tokens = tokenize('the quick brown fox jumps over the lazy dog');
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('over'));
  assert.ok(tokens.length > 0);
  // 'quick', 'brown', 'fox', 'jump', 'lazi', 'dog' (stemmed forms)
});

test('tokenize applies crude stemming', () => {
  const tokens = tokenize('running quickly beautiful');
  // 'running' -> stem removes -ing -> 'runn'
  assert.ok(tokens.some(t => t === 'runn'));
  // 'quickly' -> stem removes -ly -> 'quick'
  assert.ok(tokens.some(t => t === 'quick'));
});

/* ---------- crudeStem --------------------------------------------- */

test('crudeStem handles -tion suffix', () => {
  // 'operation' matches -ation first (longest suffix wins), giving 'oper'
  assert.equal(crudeStem('operation'), 'oper');
  // 'production' -> -tion suffix, gives 'produc'
  assert.equal(crudeStem('production'), 'produc');
});

test('crudeStem handles -ation suffix', () => {
  assert.equal(crudeStem('investigation'), 'investig');
});

test('crudeStem handles -ing suffix', () => {
  assert.equal(crudeStem('running'), 'runn');
});

test('crudeStem handles -ed suffix', () => {
  assert.equal(crudeStem('jumped'), 'jump');
});

test('crudeStem handles -ly suffix', () => {
  assert.equal(crudeStem('quickly'), 'quick');
});

test('crudeStem handles -s suffix', () => {
  assert.equal(crudeStem('systems'), 'system');
});

test('crudeStem does not strip if remaining stem < 3 chars', () => {
  // 'bed' has length 3, suffix -ed would leave 'b' (length 1) -> must not strip
  assert.equal(crudeStem('bed'), 'bed');
  // 'us' is too short to match any suffix anyway
  assert.equal(crudeStem('us'), 'us');
});

/* ---------- extractSections (headings) ---------------------------- */

test('extractSections splits by headings correctly', () => {
  const md = [
    '# Introduction',
    'Intro text here.',
    '',
    '## Chapter One',
    'Chapter one content.',
    '',
    '## Chapter Two',
    'Chapter two content.',
    '',
    '### Subsection A',
    'Sub content.',
  ].join('\n');

  const sections = extractSections(md);
  // Should have at least 4 sections: Intro, Chapter One, Chapter Two, Subsection A
  assert.ok(sections.length >= 4);
  assert.ok(sections.some(s => s.heading === 'Introduction'));
  assert.ok(sections.some(s => s.heading === 'Chapter One'));
  assert.ok(sections.some(s => s.heading === 'Chapter Two'));
  assert.ok(sections.some(s => s.heading === 'Subsection A'));
});

test('extractSections tracks parent hierarchy for headings', () => {
  const md = [
    '# Top',
    'Top text.',
    '',
    '## Child',
    'Child text.',
    '',
    '### Grandchild',
    'Grandchild text.',
  ].join('\n');

  const sections = extractSections(md);
  const child = sections.find(s => s.heading === 'Child');
  const grandchild = sections.find(s => s.heading === 'Grandchild');
  const top = sections.find(s => s.heading === 'Top');

  assert.ok(child);
  assert.ok(grandchild);
  assert.equal(child.parentId, top.id);
  assert.equal(grandchild.parentId, child.id);
});

/* ---------- extractSections (page anchors) ------------------------ */

test('extractSections falls back to page anchors when <3 headings', () => {
  const md = [
    '<!-- page:1 -->',
    'First page content.',
    '',
    '<!-- page:2 -->',
    'Second page content.',
    '',
    '<!-- page:3 -->',
    'Third page content.',
  ].join('\n');

  const sections = extractSections(md);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].heading, 'Page 1');
  assert.equal(sections[1].heading, 'Page 2');
  assert.equal(sections[2].heading, 'Page 3');
  assert.deepEqual(sections[0].pageAnchors, [1]);
});

/* ---------- extractSections (paragraphs) -------------------------- */

test('extractSections falls back to paragraph chunks for flat text', () => {
  // create text with no headings and no page anchors, >800 chars
  const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
  const md = (para.repeat(30) + '\n\n').repeat(5);

  const sections = extractSections(md);
  assert.ok(sections.length >= 2, `Expected >=2 chunks, got ${sections.length}`);
  assert.ok(sections[0].heading.startsWith('Chunk'));
});

/* ---------- scoreSections ----------------------------------------- */

test('scoreSections scores higher for sections with more query overlap', () => {
  const sections = extractSections([
    '# Introduction',
    'General overview of the system.',
    '',
    '## Database Architecture',
    'The database uses PostgreSQL with advanced indexing and replication.',
    '',
    '## User Interface',
    'The UI is built with React components.',
  ].join('\n'));

  const scores = scoreSections(sections, 'database architecture indexing');

  const dbIdx = sections.findIndex(s => s.heading === 'Database Architecture');
  const uiIdx = sections.findIndex(s => s.heading === 'User Interface');
  assert.ok(dbIdx >= 0);
  assert.ok(uiIdx >= 0);
  assert.ok(scores[dbIdx] > scores[uiIdx],
    `DB section (${scores[dbIdx]}) should score higher than UI (${scores[uiIdx]})`);
});

test('scoreSections heading bonus works', () => {
  // Two sections, one has the query term in the heading, the other only in body
  const sections = [
    {
      id: 0, heading: 'Security', headingLevel: 2, parentId: null,
      text: '## Security\nSome content about access control.',
      body: 'Some content about access control.',
      pageAnchors: [], charCount: 60, startOffset: 0, endOffset: 60,
    },
    {
      id: 1, heading: 'Overview', headingLevel: 2, parentId: null,
      text: '## Overview\nSome content about security measures.',
      body: 'Some content about security measures.',
      pageAnchors: [], charCount: 60, startOffset: 60, endOffset: 120,
    },
  ];

  const scores = scoreSections(sections, 'security');
  // Section 0 has "security" in heading -> should get heading bonus
  assert.ok(scores[0] > scores[1],
    `Heading match (${scores[0]}) should beat body-only (${scores[1]})`);
});

test('scoreSections parent propagation increases parent score', () => {
  const sections = [
    {
      id: 0, heading: 'Parent', headingLevel: 1, parentId: null,
      text: '# Parent\nGeneral content.',
      body: 'General content.',
      pageAnchors: [], charCount: 30, startOffset: 0, endOffset: 30,
    },
    {
      id: 1, heading: 'Child', headingLevel: 2, parentId: 0,
      text: '## Child\nVery detailed information about machine learning algorithms.',
      body: 'Very detailed information about machine learning algorithms.',
      pageAnchors: [], charCount: 70, startOffset: 30, endOffset: 100,
    },
  ];

  const scoresWithChild = scoreSections(sections, 'machine learning algorithms');

  // parent should have received propagation from child
  // score parent without propagation: compute manually or just check parent > 0
  assert.ok(scoresWithChild[0] > 0,
    'Parent should have non-zero score from child propagation');
});

/* ---------- selectSections ---------------------------------------- */

test('selectSections returns min 2 sections', () => {
  const sections = [
    { id: 0, heading: 'A', headingLevel: 1, parentId: null, text: 'A', body: 'A', pageAnchors: [], charCount: 10, startOffset: 0, endOffset: 10 },
    { id: 1, heading: 'B', headingLevel: 1, parentId: null, text: 'B', body: 'B', pageAnchors: [], charCount: 10, startOffset: 10, endOffset: 20 },
    { id: 2, heading: 'C', headingLevel: 1, parentId: null, text: 'C', body: 'C', pageAnchors: [], charCount: 10, startOffset: 20, endOffset: 30 },
  ];

  // give only section 0 a score, rest are 0 -> threshold filters them
  const scores = [1.0, 0.0, 0.0];
  const selected = selectSections(sections, scores, 30000);
  assert.ok(selected.length >= MIN_SECTIONS,
    `Expected at least ${MIN_SECTIONS} sections, got ${selected.length}`);
});

test('selectSections respects budget limit', () => {
  // each section is 5000 chars, budget is 3000 tokens = 12000 chars
  const sections = [];
  const scores = [];
  for (let i = 0; i < 10; i++) {
    sections.push({
      id: i, heading: `Section ${i}`, headingLevel: 1, parentId: null,
      text: 'x'.repeat(5000), body: 'x'.repeat(5000),
      pageAnchors: [], charCount: 5000,
      startOffset: i * 5000, endOffset: (i + 1) * 5000,
    });
    scores.push(1.0 - i * 0.08);
  }
  // normalize
  const max = Math.max(...scores);
  for (let i = 0; i < scores.length; i++) scores[i] /= max;

  const selected = selectSections(sections, scores, 3000);
  // should include fewer than all 10
  assert.ok(selected.length < 10, `Expected <10 sections, got ${selected.length}`);
  // total chars of selected should be roughly within budget (allowing context window)
  const totalChars = selected.reduce((sum, i) => sum + sections[i].charCount, 0);
  // context window may overshoot slightly, but not by more than 2x
  assert.ok(totalChars <= 3000 * 4 * 2,
    `Total chars ${totalChars} should be within reasonable range of budget`);
});

test('selectSections includes context window neighbors', () => {
  const sections = [];
  const scores = [];
  for (let i = 0; i < 10; i++) {
    sections.push({
      id: i, heading: `S${i}`, headingLevel: 1, parentId: null,
      text: 'x'.repeat(100), body: 'x'.repeat(100),
      pageAnchors: [], charCount: 100,
      startOffset: i * 100, endOffset: (i + 1) * 100,
    });
    scores.push(0);
  }
  // only section 5 scores high
  scores[0] = 0.2; // intro always included
  scores[5] = 1.0;

  const selected = selectSections(sections, scores, 30000);
  // should include section 5 and neighbors 4 and 6
  assert.ok(selected.includes(5), 'Should include high-scoring section 5');
  assert.ok(selected.includes(4), 'Should include context neighbor 4');
  assert.ok(selected.includes(6), 'Should include context neighbor 6');
});

test('selectSections output is in document order', () => {
  const sections = [];
  const scores = [];
  for (let i = 0; i < 8; i++) {
    sections.push({
      id: i, heading: `S${i}`, headingLevel: 1, parentId: null,
      text: 'x'.repeat(100), body: 'x'.repeat(100),
      pageAnchors: [], charCount: 100,
      startOffset: i * 100, endOffset: (i + 1) * 100,
    });
    scores.push(0);
  }
  scores[0] = 0.5;
  scores[7] = 1.0;
  scores[3] = 0.8;

  const selected = selectSections(sections, scores, 30000);
  for (let i = 1; i < selected.length; i++) {
    assert.ok(selected[i] > selected[i - 1],
      `Indices should be sorted: ${selected[i - 1]} before ${selected[i]}`);
  }
});

/* ---------- extractQuery ------------------------------------------ */

test('extractQuery removes /parse-relevant command from prompt', () => {
  const PARSE_PATTERN = /\/parse(?:-\w+)?\s+\S+/g;
  const prompt = 'Tell me about the revenue trends /parse-relevant report.pdf in this document';
  const query = extractQuery(prompt, PARSE_PATTERN);
  assert.ok(query);
  assert.ok(!query.includes('/parse'));
  assert.ok(!query.includes('report.pdf'));
});

test('extractQuery strips framing words', () => {
  const query = extractQuery('tell me about the database architecture', null);
  assert.ok(query);
  assert.ok(!query.match(/\btell me about\b/i));
  assert.ok(query.includes('database'));
  assert.ok(query.includes('architecture'));
});

test('extractQuery returns null for empty query', () => {
  const PARSE_PATTERN = /\/parse(?:-\w+)?\s+\S+/g;
  // after removing the command and framing, nothing remains
  const query = extractQuery('/parse report.pdf', PARSE_PATTERN);
  assert.equal(query, null);
});

/* ---------- buildTOC ---------------------------------------------- */

test('buildTOC produces correct outline', () => {
  const sections = [
    { id: 0, heading: 'Introduction', headingLevel: 1, parentId: null, pageAnchors: [1], charCount: 100 },
    { id: 1, heading: 'Details', headingLevel: 2, parentId: 0, pageAnchors: [], charCount: 200 },
    { id: 2, heading: 'Sub Detail', headingLevel: 3, parentId: 1, pageAnchors: [3], charCount: 150 },
    { id: 3, heading: 'Conclusion', headingLevel: 1, parentId: null, pageAnchors: [], charCount: 80 },
  ];

  const toc = buildTOC(sections);
  const lines = toc.split('\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0], '- Introduction (p1)');
  assert.equal(lines[1], '  - Details');
  assert.equal(lines[2], '    - Sub Detail (p3)');
  assert.equal(lines[3], '- Conclusion');
});

/* ---------- extractRelevant / FULL_INJECT_THRESHOLD --------------- */

test('short document below FULL_INJECT_THRESHOLD returns null', () => {
  const shortMd = '# Hello\nThis is a short document.\n\n## Section 2\nNot much here.';
  assert.ok(shortMd.length < FULL_INJECT_THRESHOLD);

  const result = extractRelevant(shortMd, 'hello', 30000);
  assert.equal(result, null);
});

/* ---------- buildRelevantOutput ----------------------------------- */

test('buildRelevantOutput marks included sections as bold in outline', () => {
  const sections = [
    {
      id: 0, heading: 'Intro', headingLevel: 1, parentId: null,
      text: '# Intro\nIntro text.',
      body: 'Intro text.',
      pageAnchors: [], charCount: 25, startOffset: 0, endOffset: 25,
    },
    {
      id: 1, heading: 'Middle', headingLevel: 1, parentId: null,
      text: '# Middle\nMiddle text.',
      body: 'Middle text.',
      pageAnchors: [], charCount: 25, startOffset: 25, endOffset: 50,
    },
    {
      id: 2, heading: 'End', headingLevel: 1, parentId: null,
      text: '# End\nEnd text.',
      body: 'End text.',
      pageAnchors: [], charCount: 20, startOffset: 50, endOffset: 70,
    },
  ];

  const selectedIndices = [0, 2]; // include Intro and End, skip Middle
  const scores = [1.0, 0.3, 0.8];
  const output = buildRelevantOutput('test.pdf', sections, selectedIndices, scores, 'intro end');

  // Included sections should be bold in outline
  assert.match(output, /\*\*Intro\*\*/);
  assert.match(output, /\*\*End\*\*/);
  // Excluded section should NOT be bold
  assert.ok(!output.includes('**Middle**'));
  assert.ok(output.includes('- Middle'));

  // Should have summary line
  assert.match(output, /2 of 3 sections included/);

  // Should list omitted sections
  assert.match(output, /Omitted sections/);
  assert.match(output, /Middle/);

  // Should include selected section content
  assert.match(output, /Intro text/);
  assert.match(output, /End text/);
});
