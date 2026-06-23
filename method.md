# How to Build a Claude Code Plugin

Reference for building hook-based Claude Code plugins like caveman — skills triggered by slash commands, with hooks that preprocess prompts before Claude sees them.

---

## 1. Directory Structure

```
my-plugin/
├── .claude-plugin/
│   ├── plugin.json        # plugin manifest
│   └── marketplace.json   # marketplace manifest (if self-hosting)
├── skills/
│   ├── my-skill/
│   │   └── SKILL.md       # slash command definition
│   └── my-skill-help/
│       └── SKILL.md
├── hooks/
│   ├── hooks.json         # hook event wiring
│   ├── run.sh             # shell wrapper (resolves __dirname reliably)
│   └── my-hook.js         # hook logic
└── README.md
```

Key rules:

- Only `plugin.json` goes inside `.claude-plugin/`. Skills, hooks, agents go at plugin root.
- Use `skills/<name>/SKILL.md` format (not `commands/`). Required for `/plugin-name` shorthand.
- Never reference paths outside the plugin directory — plugins are copied to a cache on install.

---

## 2. Plugin Manifest (`.claude-plugin/plugin.json`)

```json
{
  "name": "my-plugin",
  "description": "One-line description shown in marketplace",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/you"
  },
  "homepage": "https://github.com/you/my-plugin",
  "repository": "https://github.com/you/my-plugin",
  "license": "MIT"
}
```

- `name` becomes the skill namespace: skills are invoked as `/name:skill-name`
- Bump `version` on every release — without it, Claude Code uses the git commit SHA
- `homepage`, `repository`, `license` required for community marketplace submission

---

## 3. Skills (`skills/<name>/SKILL.md`)

Skills are slash commands. The folder name = the command name after the colon.

```markdown
---
name: my-skill
description: >
  What this skill does. Claude uses this to decide when to auto-invoke.
  Also shown in /help listing.
---

Instructions for Claude go here. Use $ARGUMENTS for user-provided input.

/my-hook-trigger $ARGUMENTS
```

### Shorthand invocation

If `name` in frontmatter matches the plugin name, `/plugin-name` expands to `/plugin-name:plugin-name`.

Example: plugin named `parsemd` + skill named `parsemd` → typing `/parsemd` works.

This only works with `skills/` directory format, not `commands/` flat files.

### Multiple skills

Each skill gets its own folder:

```
skills/
  parsemd/SKILL.md        → /parsemd
  parsemd-save/SKILL.md   → /parsemd:parsemd-save  (or /parsemd-save)
  parsemd-help/SKILL.md   → /parsemd:parsemd-help  (or /parsemd-help)
```

### Skill → hook communication

Skills pass data to hooks via prompt text. The skill content becomes the user's prompt, so embed a trigger pattern the hook can detect:

```markdown
/parse $ARGUMENTS --output-save
```

The hook scans every `UserPromptSubmit` for this pattern.

---

## 4. Hooks

### `hooks/hooks.json`

Wires hook events to shell commands. `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's installed path.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/run.sh\"",
            "timeout": 35
          }
        ]
      }
    ]
  }
}
```

Available events: `UserPromptSubmit`, `PostToolUse`, `PreToolUse`, `SessionStart`, `Stop`.

### `hooks/run.sh` — shell wrapper

`${CLAUDE_PLUGIN_ROOT}` is not set in `--plugin-dir` dev mode. Use `$BASH_SOURCE` to find the script reliably:

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/my-hook.js"
```

Make it executable: `chmod +x hooks/run.sh`

### Hook script (`hooks/my-hook.js`)

Hooks receive a JSON payload on stdin and write JSON to stdout.

```js
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const prompt = data.prompt || "";

  // Scan prompt for trigger pattern
  if (!prompt.includes("/my-trigger")) process.exit(0);

  // Do work...

  // Return result
  process.stdout.write(
    JSON.stringify({
      systemMessage: "Done. Injected into context.", // shown to user
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "## Injected content\n\n...", // added to Claude's context
      },
    }),
  );
});
```

Exit code 0 = success (blocking or non-blocking). Non-zero = error (non-blocking by default).

### Handling file paths in hooks

Support plain paths, quoted paths, and Claude Code's `@"..."` syntax:

```js
const PATTERN = /\/my-trigger\s+(?:@?"([^"]+)"|(\S+))((?:\s+--[\w-]+)*)/g;
// group 1: @"quoted path" or "quoted path"
// group 2: unquoted/single-token path
// group 3: flags like --output-save
```

---

## 5. Marketplace Manifest (`.claude-plugin/marketplace.json`)

Lets the repo serve as its own marketplace. Users add it with `claude plugin marketplace add github:you/repo` and install with `claude plugin install plugin-name@marketplace-name`.

```json
{
  "name": "my-plugin",
  "metadata": {
    "description": "Marketplace description"
  },
  "owner": {
    "name": "Your Name",
    "url": "https://github.com/you"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./",
      "description": "Plugin description",
      "homepage": "https://github.com/you/my-plugin",
      "repository": "https://github.com/you/my-plugin",
      "license": "MIT"
    }
  ]
}
```

`source: "./"` means the plugin is at the repo root. For monorepos, use `source: "./plugins/my-plugin"`.

Note: `description` must be nested under `metadata` at the marketplace level (top-level `description` fails validation).

---

## 6. Testing Locally

Load plugin for one session without installing:

```bash
claude --plugin-dir /path/to/my-plugin
```

After making changes, reload without restarting:

```
/reload-plugins
```

Validate structure and manifest before every push:

```bash
claude plugin validate /path/to/my-plugin
```

---

## 7. Installing Without a Marketplace

**Per-session (dev):**

```bash
claude --plugin-dir /path/to/my-plugin
```

**Persistent, auto-loads every session (skills dir):**

```bash
claude plugin init my-plugin
# copy files into ~/.claude/skills/my-plugin/
```

Loads as `my-plugin@skills-dir`.

**Self-hosted marketplace (shareable):**

```bash
claude plugin marketplace add github:you/my-plugin
claude plugin install my-plugin@my-plugin
```

---

## 8. Submitting to the Community Marketplace

The community marketplace (`anthropics/claude-plugins-community`) is where third-party plugins land after review.

**Before submitting:**

1. Plugin is in a public GitHub repo
2. `claude plugin validate` passes with no errors
3. `version` field set in `plugin.json`
4. `homepage`, `repository`, `license` fields populated
5. README covers install + usage

**Submit:**

- Individual authors (no Team/Enterprise org): `platform.claude.com/plugins/submit`
- Team/Enterprise org owners: `claude.ai/admin-settings/directory/submissions/plugins/new`

**After approval:**

- Plugin is pinned to a commit SHA in `anthropics/claude-plugins-community`
- Check status: search plugin name in the [community catalog](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json)
- Catalog syncs nightly — there can be a delay after approval

Users install with:

```bash
claude plugin marketplace add anthropics/claude-plugins-community
claude plugin install my-plugin@claude-community
```

---

## Checklist

- [ ] `.claude-plugin/plugin.json` has `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`
- [ ] Skills use `skills/<name>/SKILL.md` format (not `commands/`)
- [ ] Skill frontmatter has `name:` field matching folder name
- [ ] `hooks/hooks.json` references `${CLAUDE_PLUGIN_ROOT}/hooks/run.sh`
- [ ] `hooks/run.sh` uses `$BASH_SOURCE` for path resolution, is `chmod +x`
- [ ] Hook script exits 0 with no stdout when no trigger found
- [ ] `.claude-plugin/marketplace.json` exists (for self-hosting)
- [ ] `claude plugin validate` passes
- [ ] Tested with `claude --plugin-dir`
- [ ] Public GitHub repo
