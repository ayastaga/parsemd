#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { extractParseCommands } = require('./lib/parse-cmd');
const { convert, getVersion, IMAGE_EXTS } = require('./lib/engine');
const cache = require('./lib/cache');
const settings = require('./lib/settings');
const { isUrl, download } = require('./lib/url');
const { annotate } = require('./lib/anchors');
const { hashFile, buildHeader } = require('./lib/provenance');

const MAX_TOTAL_CHARS = 250_000;
const MIN_PER_FILE_CHARS = 20_000;

function cwdOutputPath(inputPath, sessionCwd) {
  const stem = path.basename(inputPath, path.extname(inputPath));
  return path.join(sessionCwd, stem + '.md');
}

function urlBasename(urlStr) {
  try {
    const u = new URL(urlStr);
    const base = path.basename(u.pathname);
    return base || u.hostname;
  } catch (_) {
    return urlStr.split('/').pop() || 'download';
  }
}

function firstHeading(md) {
  if (!md) return null;
  const m = md.match(/^#{1,3}\s+(.+)/m);
  return m ? m[1].trim().slice(0, 80) : null;
}

function buildImageDirective(filePath) {
  return [
    `_Image file:_ \`${filePath}\``,
    '',
    '**Instruction to Claude:** Use the `Read` tool on the absolute path above to view this image directly via your native vision. Do not guess its contents — read the file first, then proceed with the user\'s request.',
  ].join('\n');
}

function buildInjectionContent(r, engineVersion) {
  const header = buildHeader({
    source: r.source || r.filename,
    engine: 'markitdown',
    engineVersion: engineVersion || null,
    sha256: r.sha256 || null,
    chars: r.markdown ? r.markdown.length : null,
    pages: r.pageCount || null,
    format: r.format || null,
    viaUrl: r.viaUrl || null,
  });
  return header + r.markdown.trim();
}

async function processFile(cmd, ctx) {
  const { filePath, outputSave, customOutputPath, noCache } = cmd;
  const { sessionCwd, sessionId, cacheState, cacheFile, cfg, engineVersion } = ctx;

  const viaUrl = isUrl(filePath);
  const displayName = viaUrl ? urlBasename(filePath) : path.basename(filePath);
  const ext = path.extname(viaUrl ? urlBasename(filePath) : filePath).toLowerCase();

  if (IMAGE_EXTS.has(ext)) {
    if (viaUrl) {
      return { filename: displayName, failed: true, summary: `${displayName} → FAILED: cannot route remote images to Claude vision — download first` };
    }
    if (!fs.existsSync(filePath)) {
      return { filename: displayName, failed: true, summary: `${displayName} → FAILED [FILE_NOT_FOUND]: ${filePath}` };
    }
    return {
      filename: displayName,
      markdown: buildImageDirective(filePath),
      viaClaude: 'image',
      outputSave,
      customOutputPath,
    };
  }

  let localPath = filePath;
  let tmpFile = null;
  let markdown = null;
  let fromCache = false;
  let fromCacheType = null;
  let sandboxWarning = null;
  let sha256 = null;

  // URL download
  if (viaUrl) {
    try {
      const dlResult = await download(filePath, { timeout: cfg.urlTimeoutMs });
      localPath = dlResult.path;
      tmpFile = dlResult.path;
    } catch (err) {
      return {
        filename: displayName,
        failed: true,
        summary: `${displayName} → FAILED [${err.code || 'DOWNLOAD_ERR'}]: ${err.message}`,
      };
    }
  }

  // Hash for project cache
  sha256 = cache.hashKey(localPath);

  // Session cache lookup
  if (!noCache) {
    const k = cache.key(localPath);
    if (k && cacheState[k]) {
      markdown = cacheState[k];
      fromCache = true;
      fromCacheType = 'session';
    }
  }

  // Project cache lookup
  if (!markdown && !noCache && cfg.projectCache && sha256) {
    const cached = cache.readProjectCache(sessionCwd, sha256);
    if (cached) {
      markdown = cached;
      fromCache = true;
      fromCacheType = 'project';
    }
  }

  if (!markdown) {
    try {
      const result = await convert(localPath);
      markdown = result.markdown;
      sandboxWarning = result.meta.sandboxWarning || null;
    } catch (err) {
      if (tmpFile) try { fs.unlinkSync(tmpFile); } catch (_) {}
      const detail = err.detail ? ` (${err.detail})` : '';
      return {
        filename: displayName,
        failed: true,
        summary: `${displayName} → FAILED [${err.code || 'ERR'}]: ${err.message}${detail}`,
      };
    }
    // Session cache write
    if (!noCache) {
      const k = cache.key(localPath);
      if (k) {
        cacheState[k] = markdown;
        cache.save(cacheFile, cacheState);
      }
    }
    // Project cache write
    if (!noCache && cfg.projectCache && sha256) {
      try { cache.writeProjectCache(sessionCwd, sha256, markdown); } catch (_) {}
    }
  }

  // Clean up temp URL file
  if (tmpFile) try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Annotate (page/slide/sheet anchors)
  const ann = annotate(viaUrl ? urlBasename(filePath) : filePath, markdown);
  markdown = ann.markdown;

  return {
    filename: displayName,
    source: viaUrl ? filePath : localPath,
    markdown,
    fromCache,
    fromCacheType,
    sandboxWarning,
    outputSave,
    customOutputPath,
    sha256,
    pageCount: ann.pageCount,
    format: ann.format,
    viaUrl: viaUrl ? filePath : null,
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

function unitFor(format) {
  switch (format) {
    case 'pptx': return 'slides';
    case 'xlsx': return 'sheets';
    default: return 'pages';
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
  if (r.fromCache && r.fromCacheType) {
    tags.push(`cached/${r.fromCacheType}`);
  } else if (r.fromCache) {
    tags.push('cached');
  }
  if (r.viaUrl) tags.push('url');

  let s = `${r.filename} → markdown (${chars} chars`;
  if (r.pageCount) s += `, ${r.pageCount} ${unitFor(r.format)}`;
  if (tags.length) s += ', ' + tags.join(', ');
  s += ')';

  // First heading preview
  const heading = firstHeading(r.markdown);
  if (heading) s += ` "${heading}"`;

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

    const [cfg, engineVersion] = await Promise.all([
      Promise.resolve(settings.load()),
      getVersion(),
    ]);

    const ctx = { sessionCwd, sessionId, cacheState, cacheFile, cfg, engineVersion };

    const results = await Promise.all(
      commands.map(c => processFile(c, ctx))
    );

    applyTotalBudget(results);

    const summaries = results.map(r => buildSummary(r, sessionCwd));
    const contextParts = results
      .filter(r => r.markdown)
      .map(r => {
        if (r.viaClaude === 'image') {
          return `## Content of ${r.filename}\n\n${r.markdown.trim()}`;
        }
        return `## Content of ${r.filename}\n\n${buildInjectionContent(r, engineVersion)}`;
      });

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
