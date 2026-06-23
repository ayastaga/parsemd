'use strict';

const PAGE_ANCHOR = /<!--\s*page:(\d+)\s*-->/g;
const SLIDE_ANCHOR = /<!--\s*slide:(\d+)\s*-->/g;
const SHEET_ANCHOR = /<!--\s*sheet:([^>]+?)\s*-->/g;
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;

function parseRanges(spec) {
  const parts = spec.split(',').map(s => s.trim()).filter(Boolean);
  const pages = new Set();
  for (const p of parts) {
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      for (let i = lo; i <= hi; i++) pages.add(i);
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n)) pages.add(n);
    }
  }
  return pages;
}

function sliceByPages(markdown, spec) {
  const wanted = parseRanges(spec);
  if (wanted.size === 0) return markdown;

  const anchor = markdown.includes('<!-- slide:') ? SLIDE_ANCHOR : PAGE_ANCHOR;
  anchor.lastIndex = 0;

  const segments = [];
  let lastIdx = 0;
  let lastNum = 0;
  let match;
  const positions = [];

  while ((match = anchor.exec(markdown)) !== null) {
    positions.push({ num: parseInt(match[1], 10), idx: match.index });
  }

  if (positions.length === 0) return markdown;

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i + 1 < positions.length ? positions[i + 1].idx : markdown.length;
    if (wanted.has(positions[i].num)) {
      segments.push(markdown.slice(start, end).trim());
    }
  }

  return segments.join('\n\n');
}

function sliceBySheet(markdown, spec) {
  const names = spec.split(',').map(s => s.trim().toLowerCase());
  const indices = names.map(n => parseInt(n, 10)).filter(n => !isNaN(n));

  SHEET_ANCHOR.lastIndex = 0;
  const positions = [];
  let match;
  while ((match = SHEET_ANCHOR.exec(markdown)) !== null) {
    positions.push({ name: match[1].trim(), idx: match.index });
  }

  if (positions.length === 0) return markdown;

  const segments = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i + 1 < positions.length ? positions[i + 1].idx : markdown.length;
    const matchByName = names.includes(positions[i].name.toLowerCase());
    const matchByIdx = indices.includes(i);
    if (matchByName || matchByIdx) {
      segments.push(markdown.slice(start, end).trim());
    }
  }

  return segments.length > 0 ? segments.join('\n\n') : markdown;
}

function sliceBySection(markdown, query) {
  const lower = query.toLowerCase();
  HEADING_RE.lastIndex = 0;
  const headings = [];
  let match;
  while ((match = HEADING_RE.exec(markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2].trim(), idx: match.index });
  }

  let targetIdx = -1;
  let targetLevel = 0;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].text.toLowerCase().includes(lower)) {
      targetIdx = i;
      targetLevel = headings[i].level;
      break;
    }
  }

  if (targetIdx === -1) return markdown;

  const startPos = headings[targetIdx].idx;
  let endPos = markdown.length;
  for (let i = targetIdx + 1; i < headings.length; i++) {
    if (headings[i].level <= targetLevel) {
      endPos = headings[i].idx;
      break;
    }
  }

  return markdown.slice(startPos, endPos).trim();
}

function sliceByHeadingLevel(markdown, level) {
  HEADING_RE.lastIndex = 0;
  const headings = [];
  let match;
  while ((match = HEADING_RE.exec(markdown)) !== null) {
    headings.push({ level: match[1].length, idx: match.index });
  }

  const segments = [];
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].level !== level) continue;
    const start = headings[i].idx;
    let end = markdown.length;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= level) {
        end = headings[j].idx;
        break;
      }
    }
    segments.push(markdown.slice(start, end).trim());
  }

  return segments.length > 0 ? segments.join('\n\n') : markdown;
}

function sliceHeadTail(markdown, head, tail) {
  const charHead = head ? head * 4 : 0;
  const charTail = tail ? tail * 4 : 0;

  if (head && !tail) return markdown.slice(0, charHead);
  if (tail && !head) return markdown.slice(-charTail);
  if (head && tail) {
    if (charHead + charTail >= markdown.length) return markdown;
    return markdown.slice(0, charHead) + '\n\n[…truncated…]\n\n' + markdown.slice(-charTail);
  }
  return markdown;
}

function applySlicing(markdown, flags) {
  let result = markdown;
  if (flags.pages) result = sliceByPages(result, flags.pages);
  if (flags.sheet) result = sliceBySheet(result, flags.sheet);
  if (flags.section) result = sliceBySection(result, flags.section);
  if (flags.heading) result = sliceByHeadingLevel(result, parseInt(flags.heading, 10));
  if (flags.head || flags.tail) {
    result = sliceHeadTail(result, flags.head ? parseInt(flags.head, 10) : null, flags.tail ? parseInt(flags.tail, 10) : null);
  }
  return result;
}

module.exports = {
  applySlicing, sliceByPages, sliceBySheet, sliceBySection,
  sliceByHeadingLevel, sliceHeadTail, parseRanges,
};
