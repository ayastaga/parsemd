'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const DEFAULTS = {
  projectCache: false,
  urlTimeoutMs: 30_000,
};

function load(pathOverride) {
  const fp = pathOverride || SETTINGS_PATH;
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw);
    const cfg = ((data && data.plugins && data.plugins.parsemd) || {});
    return { ...DEFAULTS, ...cfg };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

module.exports = { load, SETTINGS_PATH, DEFAULTS };
