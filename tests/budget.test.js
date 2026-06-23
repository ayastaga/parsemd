'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBudget, applyBudget, allocateMultiFileBudget, tokensToChars, charsToTokens } = require('../hooks/lib/budget');

test('tokensToChars and charsToTokens', () => {
  assert.equal(tokensToChars(1000), 4000);
  assert.equal(charsToTokens(4000), 1000);
});

test('parseBudget parses plain number', () => {
  assert.equal(parseBudget('5000'), 5000);
});

test('parseBudget parses k suffix', () => {
  assert.equal(parseBudget('20k'), 20000);
});

test('parseBudget parses m suffix', () => {
  assert.equal(parseBudget('1m'), 1000000);
});

test('parseBudget returns null for empty or bad input', () => {
  assert.equal(parseBudget(null), null);
  assert.equal(parseBudget(''), null);
  assert.equal(parseBudget('abc'), null);
});

test('applyBudget truncates when exceeding', () => {
  const md = 'a'.repeat(10000);
  const out = applyBudget(md, 1000);
  assert.equal(out.markdown.length, 4000);
  assert.equal(out.truncated, true);
});

test('applyBudget passes through when under budget', () => {
  const md = 'hello';
  const out = applyBudget(md, 1000);
  assert.equal(out.markdown, 'hello');
  assert.equal(out.truncated, false);
});

test('applyBudget returns unchanged when no budget', () => {
  const md = 'hello';
  const out = applyBudget(md, null);
  assert.equal(out.markdown, 'hello');
  assert.equal(out.truncated, false);
});

test('allocateMultiFileBudget proportionally truncates', () => {
  const results = [
    { markdown: 'a'.repeat(40000) },
    { markdown: 'b'.repeat(60000) },
  ];
  allocateMultiFileBudget(results, 10000);
  assert.ok(results[0].markdown.length <= 40000);
  assert.ok(results[1].markdown.length <= 40000);
  const total = results[0].markdown.length + results[1].markdown.length;
  assert.ok(total <= 40000);
});
