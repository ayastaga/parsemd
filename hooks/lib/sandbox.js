'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SANDBOX_DISABLED = process.env.PARSEMD_SANDBOX === 'off';

function which(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    if (!d) continue;
    const full = path.join(d, cmd);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch (_) {}
  }
  return null;
}

function macosProfile() {
  const tmp = os.tmpdir();
  const cacheDir = path.join(os.homedir(), '.cache');
  return [
    '(version 1)',
    '(deny default)',
    '(allow process-fork process-exec)',
    '(allow file-read*)',
    `(allow file-write* (subpath "${tmp}") (subpath "${cacheDir}"))`,
    '(allow ipc-posix-shm)',
    '(allow mach-lookup)',
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(deny network*)',
  ].join('\n');
}

function chooseSandbox(inputDir) {
  if (SANDBOX_DISABLED) return { mode: 'off', warning: 'sandbox disabled (PARSEMD_SANDBOX=off)' };
  if (process.platform === 'darwin') {
    if (which('sandbox-exec')) return { mode: 'macos', tool: 'sandbox-exec', profile: macosProfile() };
  } else if (process.platform === 'linux') {
    if (which('bwrap')) return { mode: 'bwrap', tool: 'bwrap', inputDir };
    if (which('firejail')) return { mode: 'firejail', tool: 'firejail', inputDir };
  }
  return { mode: 'none', warning: 'no OS sandbox available — markitdown ran unsandboxed' };
}

function buildSandboxedCommand(cmd, args, sandbox) {
  switch (sandbox.mode) {
    case 'macos':
      return { binary: sandbox.tool, args: ['-p', sandbox.profile, cmd, ...args] };
    case 'bwrap':
      return {
        binary: sandbox.tool,
        args: [
          '--ro-bind', '/', '/',
          '--tmpfs', '/tmp',
          '--bind', sandbox.inputDir, sandbox.inputDir,
          '--proc', '/proc',
          '--dev', '/dev',
          '--unshare-net',
          cmd, ...args,
        ],
      };
    case 'firejail':
      return {
        binary: sandbox.tool,
        args: [
          '--quiet',
          '--net=none',
          '--read-only=/',
          `--read-write=${sandbox.inputDir}`,
          '--read-write=/tmp',
          cmd, ...args,
        ],
      };
    default:
      return { binary: cmd, args };
  }
}

function runSandboxed(cmd, args, { cwd, timeout, maxBuffer, inputDir }) {
  const sandbox = chooseSandbox(inputDir);
  const built = buildSandboxedCommand(cmd, args, sandbox);
  return new Promise((resolve, reject) => {
    execFile(built.binary, built.args, {
      cwd,
      encoding: 'utf8',
      timeout,
      maxBuffer,
      env: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        LANG: process.env.LANG || 'C.UTF-8',
      },
    }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr || '';
        err.sandboxMode = sandbox.mode;
        reject(err);
      } else {
        resolve({ stdout, sandboxMode: sandbox.mode, warning: sandbox.warning || null });
      }
    });
  });
}

module.exports = { runSandboxed, chooseSandbox };
