'use strict';

const fs = require('fs');
const path = require('path');
const { runSandboxed } = require('./sandbox');
const { ParseError } = require('./util');

const PER_FILE_TIMEOUT = 300_000;
const MAX_BUFFER = 32 * 1024 * 1024;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']);
const AUDIO_EXTS = new Set(['.wav', '.mp3', '.m4a']);

const SUPPORTED_EXTENSIONS = new Set([
  '.docx', '.pdf', '.pptx', '.ppt', '.xlsx', '.xls',
  '.epub', '.zip',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff',
  '.wav', '.mp3', '.m4a',
  '.html', '.csv', '.json',
]);

async function convert(filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new ParseError('UNSUPPORTED_EXT', `unsupported extension ${ext || '(none)'} — use @ for text files`);
  }

  if (!fs.existsSync(filePath)) {
    throw new ParseError('FILE_NOT_FOUND', `file not found: ${filePath}`);
  }

  const timeout = opts.timeout || PER_FILE_TIMEOUT;
  const inputDir = path.dirname(filePath);

  let result;
  try {
    result = await runSandboxed('markitdown', [filePath], {
      cwd: inputDir,
      timeout,
      maxBuffer: MAX_BUFFER,
      inputDir,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ParseError(
        'MARKITDOWN_MISSING',
        "markitdown not found in PATH",
        "install with: pip install 'markitdown[all]'",
      );
    }
    if (err.code === 'ENOBUFS') {
      throw new ParseError('OUTPUT_TOO_LARGE', `output exceeded ${MAX_BUFFER} bytes`);
    }
    if (err.killed && (err.signal === 'SIGTERM' || err.signal === 'SIGKILL')) {
      throw new ParseError('TIMEOUT', `markitdown timed out after ${Math.round(timeout / 1000)}s`);
    }
    const stderr = (err.stderr || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' | ');
    throw new ParseError('MARKITDOWN_FAILED', stderr || err.message || 'unknown markitdown error');
  }

  const markdown = result.stdout;
  if (!markdown || !markdown.trim()) {
    if (AUDIO_EXTS.has(ext)) {
      throw new ParseError(
        'AUDIO_NOT_SUPPORTED',
        'audio transcription not yet supported by parsemd',
        'in-session-Claude audio routing is planned for Phase 4 — transcribe externally (e.g. local Whisper) then /parsemd the .txt',
      );
    }
    throw new ParseError(
      'EMPTY_OUTPUT',
      'parser produced no text — file may be image-only, scanned, or encrypted',
    );
  }

  return {
    markdown,
    meta: {
      engine: 'markitdown',
      sandboxMode: result.sandboxMode,
      sandboxWarning: result.warning,
    },
  };
}

module.exports = { convert, SUPPORTED_EXTENSIONS, IMAGE_EXTS, AUDIO_EXTS, PER_FILE_TIMEOUT };
