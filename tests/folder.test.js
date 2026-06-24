'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanFolder, globToRegex, MAX_FOLDER_FILES } = require('../hooks/lib/folder');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'folder-test-'));
}

function touch(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '');
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('scanFolder returns only supported extensions', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, 'doc.pdf'));
    touch(path.join(tmp, 'pic.png'));
    touch(path.join(tmp, 'notes.txt'));
    touch(path.join(tmp, 'script.py'));
    const { files } = scanFolder(tmp);
    const names = files.map(f => path.basename(f));
    assert.ok(names.includes('doc.pdf'));
    assert.ok(names.includes('pic.png'));
    assert.ok(!names.includes('notes.txt'));
    assert.ok(!names.includes('script.py'));
  } finally {
    rmrf(tmp);
  }
});

test('scanFolder respects depth: 0 (immediate children only)', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, 'top.pdf'));
    touch(path.join(tmp, 'sub', 'nested.pdf'));
    const { files } = scanFolder(tmp, { depth: 0 });
    const names = files.map(f => path.basename(f));
    assert.ok(names.includes('top.pdf'));
    assert.ok(!names.includes('nested.pdf'));
  } finally {
    rmrf(tmp);
  }
});

test('scanFolder applies include filter', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, 'a.pdf'));
    touch(path.join(tmp, 'b.docx'));
    touch(path.join(tmp, 'c.png'));
    const { files } = scanFolder(tmp, { include: '*.pdf' });
    const names = files.map(f => path.basename(f));
    assert.deepEqual(names, ['a.pdf']);
  } finally {
    rmrf(tmp);
  }
});

test('scanFolder applies exclude filter', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, 'a.pdf'));
    touch(path.join(tmp, 'b.pdf'));
    touch(path.join(tmp, 'c.png'));
    const { files } = scanFolder(tmp, { exclude: '*.pdf' });
    const names = files.map(f => path.basename(f));
    assert.deepEqual(names, ['c.png']);
  } finally {
    rmrf(tmp);
  }
});

test('scanFolder skips .parsemd/, node_modules/, .git/', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, '.parsemd', 'hidden.pdf'));
    touch(path.join(tmp, 'node_modules', 'pkg.pdf'));
    touch(path.join(tmp, '.git', 'obj.pdf'));
    touch(path.join(tmp, 'keep.pdf'));
    const { files } = scanFolder(tmp);
    const names = files.map(f => path.basename(f));
    assert.deepEqual(names, ['keep.pdf']);
  } finally {
    rmrf(tmp);
  }
});

test('scanFolder throws DIR_NOT_FOUND for missing path', () => {
  const missing = path.join(os.tmpdir(), 'nonexistent-' + Date.now());
  assert.throws(
    () => scanFolder(missing),
    err => err.code === 'DIR_NOT_FOUND',
  );
});

test('scanFolder throws NOT_A_DIRECTORY for file path', () => {
  const tmp = makeTmpDir();
  const filePath = path.join(tmp, 'file.txt');
  try {
    fs.writeFileSync(filePath, 'hi');
    assert.throws(
      () => scanFolder(filePath),
      err => err.code === 'NOT_A_DIRECTORY',
    );
  } finally {
    rmrf(tmp);
  }
});

test('globToRegex matches *.pdf correctly', () => {
  const re = globToRegex('*.pdf');
  assert.ok(re.test('report.pdf'));
  assert.ok(re.test('REPORT.PDF'));
  assert.ok(!re.test('report.docx'));
  assert.ok(!re.test('report.pdf.bak'));
});

test('results are sorted alphabetically', () => {
  const tmp = makeTmpDir();
  try {
    touch(path.join(tmp, 'c.pdf'));
    touch(path.join(tmp, 'a.pdf'));
    touch(path.join(tmp, 'b.pdf'));
    const { files } = scanFolder(tmp);
    const names = files.map(f => path.basename(f));
    assert.deepEqual(names, ['a.pdf', 'b.pdf', 'c.pdf']);
  } finally {
    rmrf(tmp);
  }
});
