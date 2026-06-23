'use strict';

const CHARS_PER_TOKEN = 4;

function tokensToChars(tokens) {
  return tokens * CHARS_PER_TOKEN;
}

function charsToTokens(chars) {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function parseBudget(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/);
  if (!m) return null;
  let val = parseFloat(m[1]);
  if (m[2] === 'k') val *= 1000;
  if (m[2] === 'm') val *= 1_000_000;
  return Math.floor(val);
}

function applyBudget(markdown, budgetTokens) {
  if (!budgetTokens) return { markdown, truncated: false };
  const maxChars = tokensToChars(budgetTokens);
  if (markdown.length <= maxChars) return { markdown, truncated: false };
  return { markdown: markdown.slice(0, maxChars), truncated: true };
}

function allocateMultiFileBudget(results, totalBudgetTokens) {
  const valid = results.filter(r => r.markdown);
  if (valid.length === 0) return;

  const totalChars = tokensToChars(totalBudgetTokens);
  const currentTotal = valid.reduce((a, r) => a + r.markdown.length, 0);
  if (currentTotal <= totalChars) return;

  const floor = Math.max(
    5000,
    Math.floor(totalChars / valid.length / 2),
  );

  for (const r of valid) {
    const share = Math.max(floor, Math.floor((r.markdown.length / currentTotal) * totalChars));
    if (r.markdown.length > share) {
      r.markdown = r.markdown.slice(0, share);
      r.truncated = r.truncated || 'budget';
    }
  }
}

module.exports = {
  tokensToChars, charsToTokens, parseBudget,
  applyBudget, allocateMultiFileBudget, CHARS_PER_TOKEN,
};
