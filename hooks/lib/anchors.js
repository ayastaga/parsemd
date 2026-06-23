'use strict';

const path = require('path');

function annotatePdf(md) {
  if (md.includes('\f')) {
    const pages = md.split('\f');
    const numbered = pages.map((p, i) => `<!-- page:${i + 1} -->\n${p.replace(/^\n+|\n+$/g, '')}`);
    return { markdown: numbered.join('\n\n'), pageCount: pages.length };
  }
  return { markdown: md, pageCount: null };
}

function annotatePptx(md) {
  const matches = md.match(/<!--\s*Slide number:\s*\d+\s*-->/gi);
  if (matches && matches.length) {
    const normalized = md.replace(
      /<!--\s*Slide number:\s*(\d+)\s*-->/gi,
      '<!-- slide:$1 -->',
    );
    return { markdown: normalized, pageCount: matches.length };
  }
  return { markdown: md, pageCount: null };
}

function annotateXlsx(md) {
  const sheetMatches = [...md.matchAll(/^##\s+(.+)$/gm)];
  if (sheetMatches.length) {
    const annotated = md.replace(/^(##\s+)(.+)$/gm, (full, hashes, name) => {
      const clean = name.trim();
      return `<!-- sheet:${clean} -->\n${hashes}${clean}`;
    });
    return { markdown: annotated, pageCount: sheetMatches.length };
  }
  return { markdown: md, pageCount: null };
}

function annotate(filePath, markdown) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':  return { ...annotatePdf(markdown), format: 'pdf' };
    case '.pptx':
    case '.ppt':  return { ...annotatePptx(markdown), format: 'pptx' };
    case '.xlsx':
    case '.xls':  return { ...annotateXlsx(markdown), format: 'xlsx' };
    case '.docx': return { markdown, pageCount: null, format: 'docx' };
    case '.epub': return { markdown, pageCount: null, format: 'epub' };
    default:      return { markdown, pageCount: null, format: ext.replace('.', '') || 'unknown' };
  }
}

module.exports = { annotate, annotatePdf, annotatePptx, annotateXlsx };
