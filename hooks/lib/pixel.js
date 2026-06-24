'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const LOW_TEXT_THRESHOLD = 50; // non-whitespace chars per page
const DEFAULT_DPI = 150;

function isRenderAvailable() {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch (_) {
    return false;
  }
}

function detectLowText(markdown, pageCount) {
  if (!pageCount || pageCount === 0) return [];

  const pagePattern = /<!--\s*page:(\d+)\s*-->/g;
  const anchors = [];
  let m;
  while ((m = pagePattern.exec(markdown)) !== null) {
    anchors.push({ page: parseInt(m[1], 10), index: m.index });
  }

  if (anchors.length === 0) return [];

  const lowTextPages = [];

  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : markdown.length;
    const pageContent = markdown.slice(start, end);

    // Strip anchors and whitespace, count remaining chars
    const textOnly = pageContent
      .replace(/<!--\s*page:\d+\s*-->/g, '')
      .replace(/\s+/g, '');

    if (textOnly.length < LOW_TEXT_THRESHOLD) {
      lowTextPages.push(anchors[i].page);
    }
  }

  return lowTextPages;
}

function renderPages(pdfPath, pages, { outputDir, dpi = DEFAULT_DPI } = {}) {
  const dir = outputDir || os.tmpdir();
  const results = [];

  for (const page of pages) {
    const prefix = path.join(dir, `parsemd-pixel-${path.basename(pdfPath, '.pdf')}-p${page}`);
    try {
      execFileSync('pdftoppm', [
        '-png', '-r', String(dpi),
        '-f', String(page), '-l', String(page),
        pdfPath, prefix,
      ], { stdio: 'pipe', timeout: 30000 });

      // pdftoppm appends -N.png where N is zero-padded page number
      // Find the output file
      const candidates = fs.readdirSync(dir)
        .filter(f => f.startsWith(path.basename(prefix)) && f.endsWith('.png'))
        .map(f => path.join(dir, f));

      if (candidates.length > 0) {
        // Sort and take last (most recent) if multiple
        candidates.sort();
        results.push({ page, imagePath: candidates[candidates.length - 1] });
      }
    } catch (_) {
      // Skip pages that fail to render
    }
  }

  return results;
}

function buildPixelDirective(page, imagePath) {
  return [
    `<!-- page:${page} [PIXEL FALLBACK] -->`,
    `_Page ${page} had insufficient text for markdown extraction. Rendered as image for visual analysis._`,
    '',
    `**Instruction to Claude:** Use the \`Read\` tool on \`${imagePath}\` to view this page. Extract any text, tables, charts, or visual information you see.`,
  ].join('\n');
}

function replacePageSections(markdown, lowTextPages, rendered) {
  const pageSet = new Set(lowTextPages);
  const renderedMap = new Map(rendered.map(r => [r.page, r]));

  const pagePattern = /<!--\s*page:(\d+)\s*-->/g;
  const anchors = [];
  let m;
  while ((m = pagePattern.exec(markdown)) !== null) {
    anchors.push({ page: parseInt(m[1], 10), index: m.index });
  }

  if (anchors.length === 0) return markdown;

  const parts = [];
  let lastEnd = 0;

  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : markdown.length;
    const page = anchors[i].page;

    // Content before this anchor (if any gap)
    if (start > lastEnd) {
      parts.push(markdown.slice(lastEnd, start));
    }

    if (pageSet.has(page) && renderedMap.has(page)) {
      // Replace with pixel directive
      parts.push(buildPixelDirective(page, renderedMap.get(page).imagePath));
      parts.push('\n\n');
    } else {
      // Keep original content
      parts.push(markdown.slice(start, end));
    }

    lastEnd = end;
  }

  // Any trailing content
  if (lastEnd < markdown.length) {
    parts.push(markdown.slice(lastEnd));
  }

  return parts.join('');
}

module.exports = {
  isRenderAvailable,
  detectLowText,
  renderPages,
  replacePageSections,
  buildPixelDirective,
  LOW_TEXT_THRESHOLD,
  DEFAULT_DPI,
};
