'use strict';

/* ------------------------------------------------------------------ *
 *  relevant.js – TF-IDF-lite semantic extraction (pure Node, no deps)
 * ------------------------------------------------------------------ */

const DEFAULT_BUDGET_TOKENS   = 30000;
const FULL_INJECT_THRESHOLD   = 20000;   // chars; skip scoring below this
const HEADING_BONUS           = 2.0;
const POSITION_DECAY          = 0.02;
const FIRST_SECTION_BOOST     = 0.3;
const LENGTH_NORM_FLOOR       = 50;
const PARENT_PROPAGATION      = 0.3;
const SCORE_THRESHOLD_RATIO   = 0.15;
const MIN_SECTIONS            = 2;
const MAX_SECTIONS            = 20;
const CONTEXT_WINDOW          = 1;
const PARAGRAPH_CHUNK_SIZE    = 800;

/* ---------- stop words (~120 common + query-framing) -------------- */

const STOP_WORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and',
  'any','are','as','at','be','because','been','before','being','below',
  'between','both','but','by','can','could','did','do','does','doing',
  'down','during','each','few','for','from','further','get','got','had',
  'has','have','having','he','her','here','hers','herself','him',
  'himself','his','how','i','if','in','into','is','it','its','itself',
  'just','let','like','may','me','might','more','most','much','must',
  'my','myself','no','nor','not','now','of','off','on','once','only',
  'or','other','our','ours','ourselves','out','over','own','quite',
  'same','shall','she','should','so','some','such','than','that','the',
  'their','theirs','them','themselves','then','there','these','they',
  'this','those','through','to','too','under','until','up','upon','us',
  'very','was','we','were','what','when','where','which','while','who',
  'whom','why','will','with','would','you','your','yours','yourself',
  'yourselves',
  // query-framing words
  'tell','show','find','give','explain','describe','list',
  'document','file','page','section',
]);

/* ---------- crude stemmer ----------------------------------------- */

const SUFFIX_LIST = [
  'ation', 'tion', 'ment', 'ness', 'ible', 'able',
  'ling', 'ing', 'ful', 'ous', 'ive',
  'est', 'ism', 'ist',
  'ed', 'ly', 'er', 'al', 'en',
  's',
];

function crudeStem(word) {
  for (const sfx of SUFFIX_LIST) {
    if (word.length > sfx.length + 3 && word.endsWith(sfx)) {
      return word.slice(0, -sfx.length);
    }
  }
  return word;
}

/* ---------- tokenize ---------------------------------------------- */

function tokenize(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  return words.map(crudeStem);
}

/* ---------- extractQuery ------------------------------------------ */

const FRAMING_RE = /\b(based\s+on|tell\s+me\s+about|using|from|regarding|about|according\s+to|what\s+is|what\s+are|how\s+does|how\s+do|can\s+you|please)\b/gi;

function extractQuery(prompt, parsePattern) {
  if (!prompt) return null;
  let text = prompt;

  // remove /parse command spans
  if (parsePattern) {
    const re = new RegExp(parsePattern.source, parsePattern.flags);
    text = text.replace(re, ' ');
  }

  // strip framing words
  text = text.replace(FRAMING_RE, ' ');

  // collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text.length > 0 ? text : null;
}

/* ---------- extractSections --------------------------------------- */

const HEADING_RE    = /^(#{1,6})\s+(.+)$/gm;
const PAGE_ANCHOR   = /<!--\s*page:(\d+)\s*-->/g;

function extractSections(markdown) {
  if (!markdown) return [];

  // Strategy 1: heading-based
  HEADING_RE.lastIndex = 0;
  const headings = [];
  let m;
  while ((m = HEADING_RE.exec(markdown)) !== null) {
    headings.push({ level: m[1].length, text: m[2].trim(), idx: m.index });
  }

  if (headings.length >= 3) {
    return splitByHeadings(markdown, headings);
  }

  // Strategy 2: page-anchor-based
  PAGE_ANCHOR.lastIndex = 0;
  const anchors = [];
  while ((m = PAGE_ANCHOR.exec(markdown)) !== null) {
    anchors.push({ num: parseInt(m[1], 10), idx: m.index, end: m.index + m[0].length });
  }

  if (anchors.length >= 2) {
    return splitByPageAnchors(markdown, anchors);
  }

  // Strategy 3: paragraph clusters
  return splitByParagraphs(markdown);
}

function splitByHeadings(markdown, headings) {
  const sections = [];
  const stack = []; // { id, level } for parent tracking

  // content before first heading (intro)
  if (headings[0].idx > 0) {
    const introText = markdown.slice(0, headings[0].idx).trim();
    if (introText.length > 0) {
      sections.push(makeSectionObj(0, '(Introduction)', 0, null, introText, markdown));
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const start = h.idx;
    const end = i + 1 < headings.length ? headings[i + 1].idx : markdown.length;
    const text = markdown.slice(start, end).trim();
    const body = text.replace(/^#{1,6}\s+.+$/m, '').trim();

    // manage parent stack
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

    const id = sections.length;
    sections.push(makeSectionObj(id, h.text, h.level, parentId, text, markdown, start, end));

    stack.push({ id, level: h.level });
  }

  return sections;
}

function splitByPageAnchors(markdown, anchors) {
  const sections = [];
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].idx;
    const end = i + 1 < anchors.length ? anchors[i + 1].idx : markdown.length;
    const text = markdown.slice(start, end).trim();
    const heading = `Page ${anchors[i].num}`;
    const id = sections.length;
    sections.push(makeSectionObj(id, heading, 1, null, text, markdown, start, end));
    sections[id].pageAnchors = [anchors[i].num];
  }
  return sections;
}

function splitByParagraphs(markdown) {
  const sections = [];
  let pos = 0;
  const text = markdown;

  while (pos < text.length) {
    const end = Math.min(pos + PARAGRAPH_CHUNK_SIZE, text.length);
    // try to break at a paragraph boundary
    let breakAt = end;
    if (end < text.length) {
      const nextDouble = text.indexOf('\n\n', pos + Math.floor(PARAGRAPH_CHUNK_SIZE * 0.6));
      if (nextDouble !== -1 && nextDouble <= pos + PARAGRAPH_CHUNK_SIZE * 1.4) {
        breakAt = nextDouble + 2;
      }
    }
    const chunk = text.slice(pos, breakAt).trim();
    if (chunk.length > 0) {
      const id = sections.length;
      sections.push(makeSectionObj(id, `Chunk ${id + 1}`, 0, null, chunk, markdown, pos, breakAt));
    }
    pos = breakAt;
  }

  return sections;
}

function makeSectionObj(id, heading, headingLevel, parentId, text, fullDoc, startOffset, endOffset) {
  // find page anchors in this section
  const anchorRe = /<!--\s*page:(\d+)\s*-->/g;
  const pageAnchors = [];
  let am;
  while ((am = anchorRe.exec(text)) !== null) {
    pageAnchors.push(parseInt(am[1], 10));
  }

  const body = headingLevel > 0
    ? text.replace(/^#{1,6}\s+.+$/m, '').trim()
    : text;

  return {
    id,
    heading,
    headingLevel,
    parentId: parentId !== undefined ? parentId : null,
    text,
    body,
    pageAnchors,
    charCount: text.length,
    startOffset: startOffset !== undefined ? startOffset : 0,
    endOffset: endOffset !== undefined ? endOffset : (fullDoc ? fullDoc.length : text.length),
  };
}

/* ---------- scoring ----------------------------------------------- */

function buildTermCounts(tokens) {
  const counts = {};
  for (const t of tokens) {
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function scoreSections(sections, query) {
  if (!sections.length || !query) return new Array(sections.length).fill(0);

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return new Array(sections.length).fill(0);

  const N = sections.length;

  // document frequency per term
  const df = {};
  for (const s of sections) {
    const bodyTokens = new Set(tokenize(s.body));
    const headTokens = new Set(tokenize(s.heading));
    const allTokens = new Set([...bodyTokens, ...headTokens]);
    for (const t of allTokens) {
      df[t] = (df[t] || 0) + 1;
    }
  }

  // IDF
  const idf = {};
  for (const t of queryTokens) {
    idf[t] = Math.log((N + 1) / ((df[t] || 0) + 1)) + 1;
  }

  // score each section
  const scores = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const s = sections[i];
    const bodyTermCounts = buildTermCounts(tokenize(s.body));
    const headingTermCounts = buildTermCounts(tokenize(s.heading));

    let score = 0;
    for (const term of queryTokens) {
      const bodyTF = bodyTermCounts[term] > 0
        ? (1 + Math.log(bodyTermCounts[term]))
        : 0;
      const headingTF = headingTermCounts[term] > 0
        ? (1 + Math.log(headingTermCounts[term])) * HEADING_BONUS
        : 0;
      score += (bodyTF + headingTF) * idf[term];
    }

    // length normalization
    score /= Math.sqrt(Math.max(s.charCount, LENGTH_NORM_FLOOR));

    // position decay
    score *= Math.exp(-POSITION_DECAY * i);

    // first section boost
    if (i === 0) {
      score += FIRST_SECTION_BOOST;
    }

    scores[i] = score;
  }

  // parent propagation (reverse order)
  for (let i = N - 1; i >= 0; i--) {
    const pid = sections[i].parentId;
    if (pid !== null && pid !== undefined && pid >= 0 && pid < N) {
      scores[pid] += scores[i] * PARENT_PROPAGATION;
    }
  }

  // normalize by max
  const maxScore = Math.max(...scores);
  if (maxScore > 0) {
    for (let i = 0; i < N; i++) {
      scores[i] /= maxScore;
    }
  }

  return scores;
}

/* ---------- selection --------------------------------------------- */

function selectSections(sections, scores, budgetTokens) {
  const budget = budgetTokens || DEFAULT_BUDGET_TOKENS;
  const budgetChars = budget * 4;
  const N = sections.length;

  if (N === 0) return [];

  const maxScore = Math.max(...scores);
  const threshold = maxScore * SCORE_THRESHOLD_RATIO;

  // rank by score descending
  const ranked = scores
    .map((s, i) => ({ score: s, idx: i }))
    .filter(e => e.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const selectedSet = new Set();
  let usedChars = 0;

  // always include section 0 (intro)
  if (N > 0) {
    selectedSet.add(0);
    usedChars += sections[0].charCount;
  }

  // greedy add by score desc
  for (const entry of ranked) {
    if (selectedSet.size >= MAX_SECTIONS) break;
    if (selectedSet.has(entry.idx)) continue;
    const cost = sections[entry.idx].charCount;
    if (usedChars + cost > budgetChars && selectedSet.size >= MIN_SECTIONS) break;
    selectedSet.add(entry.idx);
    usedChars += cost;
  }

  // add context window neighbors
  const withContext = new Set(selectedSet);
  for (const idx of selectedSet) {
    for (let d = 1; d <= CONTEXT_WINDOW; d++) {
      if (idx - d >= 0) withContext.add(idx - d);
      if (idx + d < N) withContext.add(idx + d);
    }
  }

  // enforce min/max
  let indices = [...withContext].sort((a, b) => a - b);

  // if still below MIN_SECTIONS, add top-scored sections
  if (indices.length < MIN_SECTIONS && N >= MIN_SECTIONS) {
    const allRanked = scores
      .map((s, i) => ({ score: s, idx: i }))
      .sort((a, b) => b.score - a.score);
    for (const entry of allRanked) {
      if (indices.length >= MIN_SECTIONS) break;
      if (!withContext.has(entry.idx)) {
        withContext.add(entry.idx);
      }
    }
    indices = [...withContext].sort((a, b) => a - b);
  }

  // cap at MAX_SECTIONS (keep the highest scoring ones in document order)
  if (indices.length > MAX_SECTIONS) {
    const scoredIndices = indices
      .map(i => ({ idx: i, score: scores[i] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SECTIONS)
      .sort((a, b) => a.idx - b.idx)
      .map(e => e.idx);
    indices = scoredIndices;
  }

  return indices;
}

/* ---------- buildTOC ---------------------------------------------- */

function buildTOC(sections) {
  const lines = [];
  for (const s of sections) {
    const indent = s.headingLevel > 0 ? '  '.repeat(s.headingLevel - 1) : '';
    const pageRef = s.pageAnchors && s.pageAnchors.length > 0
      ? ` (p${s.pageAnchors[0]})`
      : '';
    lines.push(`${indent}- ${s.heading}${pageRef}`);
  }
  return lines.join('\n');
}

/* ---------- buildRelevantOutput ----------------------------------- */

function buildRelevantOutput(filename, sections, selectedIndices, scores, query) {
  const selectedSet = new Set(selectedIndices);
  const parts = [];

  // 1. Document outline
  parts.push('## Document Outline');
  parts.push('');
  for (const s of sections) {
    const indent = s.headingLevel > 0 ? '  '.repeat(s.headingLevel - 1) : '';
    const pageRef = s.pageAnchors && s.pageAnchors.length > 0
      ? ` (p${s.pageAnchors[0]})`
      : '';
    const charNote = ` [${s.charCount} chars]`;
    if (selectedSet.has(s.id)) {
      parts.push(`${indent}- **${s.heading}**${pageRef}${charNote}`);
    } else {
      parts.push(`${indent}- ${s.heading}${pageRef}${charNote}`);
    }
  }
  parts.push('');

  // 2. Summary line
  const queryDisplay = query ? query.slice(0, 80) : '';
  parts.push(`_${selectedIndices.length} of ${sections.length} sections included (query: "${queryDisplay}")_`);
  parts.push('');
  parts.push('---');
  parts.push('');

  // 3. Selected sections in document order
  for (const idx of selectedIndices) {
    parts.push(sections[idx].text);
    parts.push('');
  }

  parts.push('---');
  parts.push('');

  // 4. Expansion instructions: omitted sections
  const omitted = sections.filter(s => !selectedSet.has(s.id));
  if (omitted.length > 0) {
    parts.push('**Omitted sections** (ask to expand):');
    for (const s of omitted) {
      const tokenEst = Math.ceil(s.charCount / 4);
      parts.push(`- ${s.heading} (~${tokenEst} tokens)`);
    }
  }

  return parts.join('\n');
}

/* ---------- high-level convenience -------------------------------- */

function extractRelevant(markdown, query, budgetTokens) {
  if (!markdown || markdown.length < FULL_INJECT_THRESHOLD) {
    return null; // caller should inject full doc
  }

  const sections = extractSections(markdown);
  if (sections.length === 0) return null;

  const scores = scoreSections(sections, query);
  const budget = budgetTokens || DEFAULT_BUDGET_TOKENS;
  const selected = selectSections(sections, scores, budget);

  return {
    output: buildRelevantOutput(null, sections, selected, scores, query),
    sections,
    selected,
    scores,
  };
}

/* ---------- exports ----------------------------------------------- */

module.exports = {
  // constants (exported for testing)
  DEFAULT_BUDGET_TOKENS,
  FULL_INJECT_THRESHOLD,
  HEADING_BONUS,
  POSITION_DECAY,
  FIRST_SECTION_BOOST,
  LENGTH_NORM_FLOOR,
  PARENT_PROPAGATION,
  SCORE_THRESHOLD_RATIO,
  MIN_SECTIONS,
  MAX_SECTIONS,
  CONTEXT_WINDOW,
  PARAGRAPH_CHUNK_SIZE,
  STOP_WORDS,

  // functions
  crudeStem,
  tokenize,
  extractQuery,
  extractSections,
  scoreSections,
  selectSections,
  buildTOC,
  buildRelevantOutput,
  extractRelevant,
};
