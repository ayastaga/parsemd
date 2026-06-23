#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { extractParseCommands } = require('./lib/parse-cmd');
const { convert, IMAGE_EXTS } = require('./lib/engine');
const cache = require('./lib/cache');

const MAX_TOTAL_CHARS = 250_000;
const MIN_PER_FILE_CHARS = 20_000;

function cwdOutputPath(inputPath, sessionCwd) {
  const stem = path.basename(inputPath, path.extname(inputPath));
  return path.join(sessionCwd, stem + '.md');
}

function buildImageDirective(filePath) {
  return [
    `_Image file:_ \`${filePath}\``,
    '',
    '**Instruction to Claude:** Use the `Read` tool on the absolute path above to view this image directly via your native vision. Do not guess its contents — read the file first, then proceed with the user\'s request.',
  ].join('\n');
}

async function processFile(cmd, cacheState, cacheFile) {
  const { filePath, outputSave, customOutputPath, noCache } = cmd;
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (IMAGE_EXTS.has(ext)) {
    if (!fs.existsSync(filePath)) {
      return { filename, failed: true, summary: `${filename} → FAILED [FILE_NOT_FOUND]: ${filePath}` };
    }
    return {
      filename,
      markdown: buildImageDirective(filePath),
      viaClaude: 'image',
      outputSave,
      customOutputPath,
    };
  }

  let markdown = null;
  let fromCache = false;
  let sandboxWarning = null;

  if (!noCache) {
    const k = cache.key(filePath);
    if (k && cacheState[k]) {
      markdown = cacheState[k];
      fromCache = true;
    }
  }

  if (!markdown) {
    try {
      const result = await convert(filePath);
      markdown = result.markdown;
      sandboxWarning = result.meta.sandboxWarning || null;
    } catch (err) {
      const detail = err.detail ? ` (${err.detail})` : '';
      return {
        filename,
        failed: true,
        summary: `${filename} → FAILED [${err.code || 'ERR'}]: ${err.message}${detail}`,
      };
    }
    if (!noCache) {
      const k = cache.key(filePath);
      if (k) {
        cacheState[k] = markdown;
        cache.save(cacheFile, cacheState);
      }
    }
  }

  return {
    filename,
    markdown,
    fromCache,
    sandboxWarning,
    outputSave,
    customOutputPath,
  };
}

function applyTotalBudget(results) {
  const valid = results.filter(r => r.markdown && r.viaClaude !== 'image');
  if (valid.length === 0) return;

  const total = valid.reduce((a, r) => a + r.markdown.length, 0);
  if (total <= MAX_TOTAL_CHARS) return;

  if (valid.length === 1) {
    valid[0].markdown = valid[0].markdown.slice(0, MAX_TOTAL_CHARS);
    valid[0].truncated = true;
    return;
  }

  const floor = Math.max(MIN_PER_FILE_CHARS, Math.floor(MAX_TOTAL_CHARS / valid.length / 2));
  for (const r of valid) {
    const share = Math.max(floor, Math.floor((r.markdown.length / total) * MAX_TOTAL_CHARS));
    if (r.markdown.length > share) {
      r.markdown = r.markdown.slice(0, share);
      r.truncated = true;
    }
  }
}

function buildSummary(r, sessionCwd) {
  if (r.failed) return r.summary;
  if (!r.markdown) return `${r.filename} → no content`;

  if (r.viaClaude === 'image') {
    let s = `${r.filename} → routed to Claude vision (Read tool)`;
    if (r.outputSave) s += '. Save skipped: image routing produces no markdown';
    return s;
  }

  const chars = r.markdown.length.toLocaleString();
  const tags = [];
  if (r.truncated) tags.push('TRUNCATED');
  if (r.fromCache) tags.push('cached');

  let s = `${r.filename} → markdown (${chars} chars`;
  if (tags.length) s += ', ' + tags.join(', ');
  s += ')';

  if (r.outputSave) {
    const outPath = r.customOutputPath || cwdOutputPath(r.filePath || r.filename, sessionCwd);
    try {
      fs.writeFileSync(outPath, r.markdown, 'utf8');
      s += `. Saved to ${outPath}`;
    } catch (err) {
      s += `. Save FAILED: ${err.message}`;
    }
  }
  if (r.sandboxWarning) s += `. ${r.sandboxWarning}`;
  return s;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', async () => {
    let data;
    try {
      data = JSON.parse(input);
    } catch (_) {
      process.exit(0);
    }

    const prompt = data.prompt || '';
    const commands = extractParseCommands(prompt);
    if (commands.length === 0) process.exit(0);

    const sessionCwd = data.cwd || process.cwd();
    const sessionId = data.session_id || 'default';
    const cacheFile = cache.sessionCacheFile(sessionId);
    const cacheState = cache.load(cacheFile);
    cache.gcStale();

    const results = await Promise.all(
      commands.map(c => processFile(c, cacheState, cacheFile))
    );

    applyTotalBudget(results);

    const summaries = results.map(r => buildSummary(r, sessionCwd));
    const contextParts = results
      .filter(r => r.markdown)
      .map(r => `## Content of ${r.filename}\n\n${r.markdown.trim()}`);

    const output = {
      systemMessage: `Parsed: ${summaries.join(' | ')}${contextParts.length ? '. Injected into context.' : ''}`,
    };
    if (contextParts.length > 0) {
      output.hookSpecificOutput = {
        hookEventName: 'UserPromptSubmit',
        additionalContext: contextParts.join('\n\n---\n\n'),
      };
    }
    process.stdout.write(JSON.stringify(output));
  });
}

main();
