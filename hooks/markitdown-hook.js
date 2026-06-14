#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUPPORTED_EXTENSIONS = new Set([
  '.docx', '.pdf', '.pptx', '.ppt', '.xlsx', '.xls',
  '.epub', '.zip',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff',
  '.wav', '.mp3', '.m4a',
]);

// /parse <path> [--output|-o [custom_output_path]]
const PARSE_PATTERN = /\/parse\s+(\S+)(?:\s+(--output|-o)(?:\s+(\S+\.\w+))?)?/g;

function expandPath(fp) {
  if (fp.startsWith('~/')) return path.join(os.homedir(), fp.slice(2));
  return path.resolve(fp);
}

function defaultOutputPath(inputPath) {
  const dir = path.dirname(inputPath);
  const stem = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, stem + '.md');
}

function extractParseCommands(prompt) {
  const commands = [];
  PARSE_PATTERN.lastIndex = 0;
  let match;
  while ((match = PARSE_PATTERN.exec(prompt)) !== null) {
    const filePath = expandPath(match[1]);
    const hasOutput = !!match[2];
    const customOutput = match[3] ? expandPath(match[3]) : null;
    commands.push({ filePath, hasOutput, customOutput });
  }
  return commands;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
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

    const summaries = [];
    const contextParts = [];

    for (const { filePath, hasOutput, customOutput } of commands) {
      const ext = path.extname(filePath).toLowerCase();
      const filename = path.basename(filePath);

      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        summaries.push(`${filename} → skipped (use @ for text files)`);
        continue;
      }

      if (!fs.existsSync(filePath)) {
        summaries.push(`${filename} → FAILED: file not found`);
        continue;
      }

      let markdown;
      try {
        markdown = execSync(`markitdown "${filePath}"`, {
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        const msg = (err.stderr || err.message || 'unknown error').trim().split('\n')[0];
        summaries.push(`${filename} → FAILED: ${msg}`);
        continue;
      }

      const charCount = markdown.length.toLocaleString();
      let summary = `${filename} → markdown (${charCount} chars)`;

      if (hasOutput) {
        const outPath = customOutput || defaultOutputPath(filePath);
        try {
          fs.writeFileSync(outPath, markdown, 'utf8');
          summary += `. Saved to ${outPath}`;
        } catch (err) {
          summary += `. Save FAILED: ${err.message}`;
        }
      }

      summaries.push(summary);
      contextParts.push(`## Content of ${filename}\n\n${markdown.trim()}`);
    }

    const result = {
      systemMessage: `Parsed: ${summaries.join(' | ')}${contextParts.length ? '. Injected into context.' : ''}`,
    };

    if (contextParts.length > 0) {
      result.hookSpecificOutput = {
        hookEventName: 'UserPromptSubmit',
        additionalContext: contextParts.join('\n\n---\n\n'),
      };
    }

    process.stdout.write(JSON.stringify(result));
  });
}

main();
