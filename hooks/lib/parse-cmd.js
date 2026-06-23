'use strict';

const { expandPath, stripCodeBlocks } = require('./util');

const PARSE_PATTERN = /(?:^|\s)\/parse(-save|md(?:-save)?)?(?=\s)\s+(?:@?"([^"\n]+)"|@?'([^'\n]+)'|(\S+))((?:\s+--[\w-]+(?:\s+(?!--|\/)[^\s][^\s]*)?)*)/g;

const VALID_PATH_TAIL = /\.(docx|pdf|pptx|ppt|xlsx|xls|epub|zip|jpg|jpeg|png|gif|bmp|tiff|wav|mp3|m4a|html|csv|json)$/i;

function looksLikePath(p) {
  if (!p) return false;
  return VALID_PATH_TAIL.test(p);
}

function extractParseCommands(prompt) {
  if (!prompt) return [];
  const cleaned = stripCodeBlocks(prompt);
  const commands = [];
  PARSE_PATTERN.lastIndex = 0;
  let match;
  while ((match = PARSE_PATTERN.exec(cleaned)) !== null) {
    const rawPath = match[2] || match[3] || match[4];
    if (!looksLikePath(rawPath)) continue;
    const filePath = expandPath(rawPath);
    const variant = match[1] || '';
    const flagStr = (match[5] || '').trim();

    const outputMatch = flagStr.match(/--output\s+(\S+)/);
    const customOutputPath = outputMatch ? expandPath(outputMatch[1]) : null;
    const outputSave = variant.includes('-save') || flagStr.includes('--output-save') || !!customOutputPath;
    const noCache = flagStr.includes('--no-cache');

    commands.push({
      filePath,
      rawPath,
      outputSave,
      customOutputPath,
      noCache,
    });
  }
  return commands;
}

module.exports = { extractParseCommands, PARSE_PATTERN, looksLikePath };
