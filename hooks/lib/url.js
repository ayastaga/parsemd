'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

const CONTENT_TYPE_TO_EXT = {
  'application/pdf': '.pdf',
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'application/json': '.json',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/epub+zip': '.epub',
  'application/zip': '.zip',
};

function pickExt(urlObj, contentType) {
  const fromPath = path.extname(urlObj.pathname).toLowerCase();
  if (fromPath) return fromPath;
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[ct] || '';
}

function downloadOnce(targetUrl, timeout) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.get(targetUrl, {
      timeout,
      headers: { 'user-agent': 'parsemd/1.2 (+https://github.com/ayastaga/parsemd)' },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirectTo: new URL(res.headers.location, targetUrl).toString() });
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(Object.assign(
          new Error(`HTTP ${res.statusCode}`),
          { code: 'HTTP_ERROR', status: res.statusCode },
        ));
      }
      const ext = pickExt(u, res.headers['content-type']);
      if (!ext) {
        res.resume();
        return reject(Object.assign(
          new Error(`could not determine file type for ${targetUrl}`),
          { code: 'UNKNOWN_TYPE' },
        ));
      }
      const tmp = path.join(os.tmpdir(), `parsemd-url-${crypto.randomBytes(6).toString('hex')}${ext}`);
      const out = fs.createWriteStream(tmp);
      let size = 0;
      let aborted = false;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_DOWNLOAD_BYTES && !aborted) {
          aborted = true;
          req.destroy();
          out.destroy();
          try { fs.unlinkSync(tmp); } catch (_) {}
          reject(Object.assign(
            new Error(`download exceeded ${MAX_DOWNLOAD_BYTES} bytes`),
            { code: 'TOO_LARGE' },
          ));
        }
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => {
        if (aborted) return;
        resolve({ path: tmp, size, contentType: res.headers['content-type'] || null });
      }));
      out.on('error', err => {
        try { fs.unlinkSync(tmp); } catch (_) {}
        reject(err);
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(
      new Error(`URL fetch timed out after ${timeout}ms`),
      { code: 'URL_TIMEOUT' },
    )));
    req.on('error', reject);
  });
}

async function download(targetUrl, opts = {}) {
  const timeout = opts.timeout || DEFAULT_TIMEOUT_MS;
  let url = targetUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await downloadOnce(url, timeout);
    if (r.redirectTo) {
      url = r.redirectTo;
      continue;
    }
    return r;
  }
  throw Object.assign(new Error(`too many redirects from ${targetUrl}`), { code: 'TOO_MANY_REDIRECTS' });
}

module.exports = { isUrl, download, DEFAULT_TIMEOUT_MS, MAX_DOWNLOAD_BYTES };
