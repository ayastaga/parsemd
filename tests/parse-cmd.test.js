'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractParseCommands } = require('../hooks/lib/parse-cmd');

test('matches /parsemd with home-relative path', () => {
  const out = extractParseCommands('/parsemd ~/docs/report.pdf');
  assert.equal(out.length, 1);
  assert.match(out[0].filePath, /report\.pdf$/);
});

test('matches /parsemd-save', () => {
  const out = extractParseCommands('/parsemd-save ~/docs/notes.docx');
  assert.equal(out.length, 1);
  assert.equal(out[0].outputSave, true);
});

test('matches @"quoted path" with spaces', () => {
  const out = extractParseCommands('/parsemd @"~/My Docs/Q4 Report.pdf"');
  assert.equal(out.length, 1);
  assert.match(out[0].filePath, /Q4 Report\.pdf$/);
});

test('matches absolute path', () => {
  const out = extractParseCommands('/parsemd /tmp/export.docx');
  assert.equal(out.length, 1);
  assert.equal(out[0].filePath, '/tmp/export.docx');
});

test('ignores /parse inside fenced code block', () => {
  const out = extractParseCommands('```\n/parsemd foo.pdf\n```\n');
  assert.equal(out.length, 0);
});

test('ignores /parse inside inline backticks', () => {
  const out = extractParseCommands('use the `/parsemd foo.pdf` syntax');
  assert.equal(out.length, 0);
});

test('ignores prose mention without valid extension', () => {
  const out = extractParseCommands('discussing /parse in the doc');
  assert.equal(out.length, 0);
});

test('ignores arbitrary slash command', () => {
  const out = extractParseCommands('/something my-file.pdf');
  assert.equal(out.length, 0);
});

test('matches multiple files in one prompt', () => {
  const out = extractParseCommands('/parsemd a.pdf and /parsemd b.docx');
  assert.equal(out.length, 2);
});

test('captures --output flag and marks outputSave', () => {
  const out = extractParseCommands('/parsemd a.pdf --output ~/out.md');
  assert.equal(out.length, 1);
  assert.equal(out[0].outputSave, true);
  assert.match(out[0].customOutputPath, /out\.md$/);
});

test('captures --no-cache flag', () => {
  const out = extractParseCommands('/parsemd a.pdf --no-cache');
  assert.equal(out.length, 1);
  assert.equal(out[0].noCache, true);
});

test('matches at start of line', () => {
  const out = extractParseCommands('/parse ~/x.docx');
  assert.equal(out.length, 1);
});

test('does not match inside a word', () => {
  const out = extractParseCommands('describe/parsemd file.pdf in detail');
  assert.equal(out.length, 0);
});

test('strips fenced block but keeps surrounding commands', () => {
  const prompt = '/parsemd a.pdf\n```\n/parsemd b.pdf\n```\n/parsemd c.pdf';
  const out = extractParseCommands(prompt);
  assert.equal(out.length, 2);
  assert.match(out[0].filePath, /a\.pdf$/);
  assert.match(out[1].filePath, /c\.pdf$/);
});

test('matches http URL ending in known extension', () => {
  const out = extractParseCommands('/parsemd http://example.com/report.pdf');
  assert.equal(out.length, 1);
  assert.equal(out[0].filePath, 'http://example.com/report.pdf');
});

test('matches https URL with .docx tail', () => {
  const out = extractParseCommands('/parsemd https://cdn.example.com/files/doc.docx');
  assert.equal(out.length, 1);
  assert.equal(out[0].filePath, 'https://cdn.example.com/files/doc.docx');
});
