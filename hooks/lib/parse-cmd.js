'use strict';

const { expandPath, stripCodeBlocks } = require('./util');

const PARSE_PATTERN = /(?:^|\s)\/parse(-save|-summarize|-diff|-folder|-pack|-relevant|md(?:-save|-folder|-pack|-relevant)?)?(?=\s)\s+(?:@?"([^"\n]+)"|@?'([^'\n]+)'|(\S+))((?:\s+--[\w-]+(?:\s+(?!--|\/)[^\s][^\s]*)?)*)/g;

const VALID_PATH_TAIL = /\.(docx|pdf|pptx|ppt|xlsx|xls|epub|zip|jpg|jpeg|png|gif|bmp|tiff|wav|mp3|m4a|html|csv|json)$/i;

function looksLikePath(p) {
  if (!p) return false;
  return VALID_PATH_TAIL.test(p);
}

function extractFlag(flagStr, name) {
  const re = new RegExp('--' + name + '\\s+(\\S+)');
  const m = flagStr.match(re);
  return m ? m[1] : null;
}

function extractParseCommands(prompt) {
  if (!prompt) return [];
  const cleaned = stripCodeBlocks(prompt);
  const commands = [];
  PARSE_PATTERN.lastIndex = 0;
  let match;
  while ((match = PARSE_PATTERN.exec(cleaned)) !== null) {
    const rawPath = match[2] || match[3] || match[4];
    const variant = match[1] || '';
    const isFolderOrPack = variant === '-folder' || variant === 'md-folder'
      || variant === '-pack' || variant === 'md-pack';
    if (!isFolderOrPack && !looksLikePath(rawPath)) continue;
    const filePath = expandPath(rawPath);
    const flagStr = (match[5] || '').trim();

    const outputMatch = flagStr.match(/--output\s+(\S+)/);
    const customOutputPath = outputMatch ? expandPath(outputMatch[1]) : null;
    const outputSave = variant.includes('-save') || flagStr.includes('--output-save') || !!customOutputPath;
    const noCache = flagStr.includes('--no-cache');

    let mode = 'parse';
    if (variant === '-summarize') mode = 'summarize';
    else if (variant === '-diff') mode = 'diff';
    else if (variant === '-folder' || variant === 'md-folder') mode = 'folder';
    else if (variant === '-pack' || variant === 'md-pack') mode = 'pack';
    else if (variant === '-relevant' || variant === 'md-relevant') mode = 'relevant';

    commands.push({
      filePath,
      rawPath,
      mode,
      outputSave,
      customOutputPath,
      noCache,
      pages: extractFlag(flagStr, 'pages'),
      section: extractFlag(flagStr, 'section'),
      heading: extractFlag(flagStr, 'heading'),
      sheet: extractFlag(flagStr, 'sheet'),
      budget: extractFlag(flagStr, 'budget'),
      head: extractFlag(flagStr, 'head'),
      tail: extractFlag(flagStr, 'tail'),
      depth: extractFlag(flagStr, 'depth'),
      include: extractFlag(flagStr, 'include'),
      exclude: extractFlag(flagStr, 'exclude'),
      name: extractFlag(flagStr, 'name'),
      query: extractFlag(flagStr, 'query'),
    });
  }
  return commands;
}

module.exports = { extractParseCommands, PARSE_PATTERN, looksLikePath };
