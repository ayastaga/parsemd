'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPack, loadPack, listPacks, packsDir } = require('../hooks/lib/pack');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), `parsemd-pack-test-${process.pid}-`));
}

const mockResults = [
  { filename: 'doc1.pdf', markdown: '# Doc 1\nContent here', sha256: 'abc123', source: '/tmp/doc1.pdf' },
  { filename: 'doc2.docx', markdown: '# Doc 2\nMore content', sha256: 'def456', source: '/tmp/doc2.docx' },
];

test('createPack writes manifest.json and bundle.md', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'my-pack', mockResults);
    const dir = path.join(packsDir(cwd), 'my-pack');
    assert.equal(fs.existsSync(path.join(dir, 'manifest.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'bundle.md')), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('createPack manifest has correct file entries and totalChars', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'stats-pack', mockResults);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packsDir(cwd), 'stats-pack', 'manifest.json'), 'utf8')
    );
    assert.equal(manifest.name, 'stats-pack');
    assert.equal(manifest.files.length, 2);
    assert.equal(manifest.files[0].basename, 'doc1.pdf');
    assert.equal(manifest.files[0].sha256, 'abc123');
    assert.equal(manifest.files[0].path, '/tmp/doc1.pdf');
    assert.equal(manifest.files[1].basename, 'doc2.docx');
    const expectedTotal = mockResults[0].markdown.length + mockResults[1].markdown.length;
    assert.equal(manifest.totalChars, expectedTotal);
    assert.equal(manifest.files[0].chars, mockResults[0].markdown.length);
    assert.equal(manifest.files[1].chars, mockResults[1].markdown.length);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadPack returns correct markdown content', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'load-test', mockResults);
    const { markdown } = loadPack(cwd, 'load-test');
    assert.ok(markdown.includes('## Content of doc1.pdf'));
    assert.ok(markdown.includes('# Doc 1\nContent here'));
    assert.ok(markdown.includes('## Content of doc2.docx'));
    assert.ok(markdown.includes('# Doc 2\nMore content'));
    assert.ok(markdown.includes('\n\n---\n\n'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadPack round-trips with createPack', () => {
  const cwd = tmpDir();
  try {
    const result = createPack(cwd, 'round-trip', mockResults);
    const { markdown, manifest } = loadPack(cwd, 'round-trip');
    assert.equal(manifest.name, 'round-trip');
    assert.equal(manifest.files.length, result.fileCount);
    assert.equal(manifest.totalChars, result.totalChars);

    // Rebuild expected bundle and compare
    const expected = mockResults
      .map(r => `## Content of ${path.basename(r.filename)}\n\n${r.markdown}`)
      .join('\n\n---\n\n');
    assert.equal(markdown, expected);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadPack throws PACK_NOT_FOUND for missing pack', () => {
  const cwd = tmpDir();
  try {
    assert.throws(
      () => loadPack(cwd, 'no-such-pack'),
      err => {
        assert.equal(err.code, 'PACK_NOT_FOUND');
        assert.ok(err.message.includes('no-such-pack'));
        return true;
      }
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('listPacks returns all packs with metadata', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'alpha', [mockResults[0]]);
    createPack(cwd, 'beta', mockResults);

    const packs = listPacks(cwd);
    assert.equal(packs.length, 2);

    const names = packs.map(p => p.name).sort();
    assert.deepEqual(names, ['alpha', 'beta']);

    const alpha = packs.find(p => p.name === 'alpha');
    assert.equal(alpha.fileCount, 1);
    assert.equal(alpha.totalChars, mockResults[0].markdown.length);
    assert.ok(alpha.updated);

    const beta = packs.find(p => p.name === 'beta');
    assert.equal(beta.fileCount, 2);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('listPacks returns empty array when no packs exist', () => {
  const cwd = tmpDir();
  try {
    const packs = listPacks(cwd);
    assert.deepEqual(packs, []);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('createPack ensures .gitignore includes packs/ entry', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'gi-test', [mockResults[0]]);
    const gi = fs.readFileSync(path.join(cwd, '.parsemd', '.gitignore'), 'utf8');
    assert.ok(gi.includes('packs/'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('createPack appends to existing .gitignore without duplicating', () => {
  const cwd = tmpDir();
  try {
    // Pre-create .gitignore with cache/ only
    const parsemdDir = path.join(cwd, '.parsemd');
    fs.mkdirSync(parsemdDir, { recursive: true });
    fs.writeFileSync(path.join(parsemdDir, '.gitignore'), 'cache/\n', 'utf8');

    createPack(cwd, 'gi-append', [mockResults[0]]);
    const gi = fs.readFileSync(path.join(parsemdDir, '.gitignore'), 'utf8');
    assert.ok(gi.includes('cache/'));
    assert.ok(gi.includes('packs/'));

    // Call again to verify no duplication
    createPack(cwd, 'gi-append2', [mockResults[0]]);
    const gi2 = fs.readFileSync(path.join(parsemdDir, '.gitignore'), 'utf8');
    const matches = gi2.match(/packs\//g);
    assert.equal(matches.length, 1);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('createPack overwrites existing pack (update case)', () => {
  const cwd = tmpDir();
  try {
    createPack(cwd, 'overwrite', [mockResults[0]]);
    const first = loadPack(cwd, 'overwrite');
    assert.equal(first.manifest.files.length, 1);
    const originalCreated = first.manifest.created;

    createPack(cwd, 'overwrite', mockResults);
    const second = loadPack(cwd, 'overwrite');
    assert.equal(second.manifest.files.length, 2);
    assert.equal(second.manifest.totalChars, mockResults[0].markdown.length + mockResults[1].markdown.length);
    // Preserves original created date
    assert.equal(second.manifest.created, originalCreated);
    // Updated date is different (or at least set)
    assert.ok(second.manifest.updated);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
