#!/usr/bin/env node
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUPPORTED_EXTENSIONS = new Set([
  '.docx', '.pdf', '.pptx', '.ppt', '.xlsx', '.xls',
  '.epub', '.zip',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff',
  '.wav', '.mp3', '.m4a',
  '.html', '.csv', '.json',
]);

const MAX_CONTEXT_CHARS = 100000;
const PER_FILE_TIMEOUT = 28000;

// Matches /parse, /parse-save, /parsemd, /parsemd-save + path + flags (--output-save, --output <path>)
const PARSE_PATTERN = /\/parse(-save|md(?:-save)?)?\s+(?:@?"([^"]+)"|@?'([^']+)'|(\S+))((?:\s+--[\w-]+(?:\s+(?!--)\S+)?)*)/g;

function expandPath(fp) {
  if (!fp) return fp;
  const clean = fp.replace(/^@/, '');
  if (clean.startsWith('~/')) return path.join(os.homedir(), clean.slice(2));
  return path.resolve(clean);
}

function cwdOutputPath(inputPath, sessionCwd) {
  const stem = path.basename(inputPath, path.extname(inputPath));
  return path.join(sessionCwd, stem + '.md');
}

function extractParseCommands(prompt) {
  const commands = [];
  PARSE_PATTERN.lastIndex = 0;
  let match;
  while ((match = PARSE_PATTERN.exec(prompt)) !== null) {
    const rawPath = match[2] || match[3] || match[4];
    const filePath = expandPath(rawPath);
    const variant = match[1] || '';
    const flagStr = (match[5] || '').trim();
    const outputMatch = flagStr.match(/--output\s+(\S+)/);
    const customOutputPath = outputMatch ? expandPath(outputMatch[1]) : null;
    const outputSave = variant.includes('-save') || flagStr.includes('--output-save') || !!customOutputPath;
    commands.push({ filePath, outputSave, customOutputPath });
  }
  return commands;
}

function loadCache(cacheFile) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveCache(cacheFile, cache) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache), 'utf8');
  } catch (_) {}
}

function cacheKey(filePath) {
  try {
    return `${filePath}:${fs.statSync(filePath).mtimeMs}`;
  } catch (_) {
    return null;
  }
}

function runMarkitdown(filePath) {
  return new Promise((resolve, reject) => {
    execFile('markitdown', [filePath], { encoding: 'utf8', timeout: PER_FILE_TIMEOUT }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr || ''; reject(err); }
      else resolve(stdout);
    });
  });
}

async function processFile({ filePath, outputSave, customOutputPath }, sessionCwd, cache, cacheFile) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { filename, summary: `${filename} → skipped (use @ for text files)`, markdown: null };
  }

  if (!fs.existsSync(filePath)) {
    return { filename, summary: `${filename} → FAILED: file not found`, markdown: null };
  }

  const key = cacheKey(filePath);
  let markdown = key ? cache[key] : null;
  let fromCache = !!markdown;

  if (!markdown) {
    try {
      markdown = await runMarkitdown(filePath);
    } catch (err) {
      const rawErr = (err.stderr || err.message || 'unknown error').trim();
      const msg = rawErr.split('\n').filter(l => l.trim()).slice(0, 3).join(' | ');
      return { filename, summary: `${filename} → FAILED: ${msg}`, markdown: null };
    }

    if (!markdown || !markdown.trim()) {
      return { filename, summary: `${filename} → FAILED: markitdown returned empty output`, markdown: null };
    }

    if (key) {
      cache[key] = markdown;
      saveCache(cacheFile, cache);
    }
  }

  let truncated = false;
  if (markdown.length > MAX_CONTEXT_CHARS) {
    markdown = markdown.slice(0, MAX_CONTEXT_CHARS);
    truncated = true;
  }

  const charCount = markdown.length.toLocaleString();
  let summary = `${filename} → markdown (${charCount} chars${truncated ? ', TRUNCATED' : ''}${fromCache ? ', cached' : ''})`;

  if (outputSave) {
    const outPath = customOutputPath || cwdOutputPath(filePath, sessionCwd);
    try {
      fs.writeFileSync(outPath, markdown, 'utf8');
      summary += `. Saved to ${outPath}`;
    } catch (err) {
      summary += `. Save FAILED: ${err.message}`;
    }
  }

  return { filename, summary, markdown: markdown.trim() };
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

    if (commands.length === 0) {
      process.exit(0);
    }

    const sessionCwd = data.cwd || process.cwd();
    const sessionId = data.session_id || 'default';
    const cacheFile = path.join(os.tmpdir(), `parsemd-cache-${sessionId}.json`);
    const cache = loadCache(cacheFile);

    const results = await Promise.all(
      commands.map(cmd => processFile(cmd, sessionCwd, cache, cacheFile))
    );

    const summaries = results.map(r => r.summary);
    const contextParts = results
      .filter(r => r.markdown)
      .map(r => `## Content of ${r.filename}\n\n${r.markdown}`);

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
