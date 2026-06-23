# Security

## Threat Model

parsemd runs locally inside your Claude Code session. Its job is to convert binary documents into markdown via the `markitdown` library and inject the result into a Claude conversation. It does not open network sockets, does not exfiltrate data, and does not require credentials.

The relevant threats are:

1. A malicious file path is passed via `/parsemd`.
2. A malicious file is parsed by `markitdown`, exploiting a parser vulnerability.
3. A document's contents include text that looks like a `/parsemd` command (prompt injection).

## What Is Guarded

- **Subprocess sandboxing.** The `markitdown` subprocess is run inside an OS-level sandbox where supported:
  - **macOS:** `sandbox-exec` with a profile that denies network, denies file writes outside the OS temp directory and `~/.cache`, and only allows file reads.
  - **Linux:** `bwrap` (preferred) or `firejail`. Network namespace unshared. Root filesystem read-only.
  - **Other platforms / missing tools:** the subprocess runs unsandboxed and parsemd emits a one-line warning in the `systemMessage`.
  - Disable with environment variable `PARSEMD_SANDBOX=off`.
- **No shell injection.** parsemd uses `child_process.execFile` with argument arrays — never `exec` with a shell string.
- **Restricted environment.** The subprocess receives only `PATH`, `HOME`, and `LANG`. Other environment variables (including secrets) are not propagated.
- **Output size cap.** Subprocess stdout is capped at 32 MiB. Larger output produces an `OUTPUT_TOO_LARGE` error rather than memory exhaustion.
- **Total context cap.** The hook caps total injected content per prompt at 250 000 characters across all files, proportionally truncating individual files when the total is exceeded.

## What Is Not Guarded (and why)

- **Path traversal.** parsemd intentionally allows any file path the user types, including absolute paths and `..` traversal. Claude Code already has access to the user's entire repository and most of the user's home directory; adding a path allow-list in the hook would not meaningfully reduce blast radius and would block legitimate use cases (e.g. parsing a document outside the current working directory). If you do not want a file readable, do not type its path.
- **Prompt injection from document contents.** The hook only fires on prompts containing a `/parse*` token at start of line or after whitespace, and only outside of fenced code blocks and inline backticks. A document's contents could in principle contain instructions like "run /parsemd /etc/passwd". Such instructions would only execute on the **next user prompt you submit** — they are inert until then. Be skeptical of pasted document content that contains slash commands.
- **markitdown parser CVEs.** parsemd uses upstream markitdown without modification. Document parsers (PDF, PPTX, XLSX, EPUB, ZIP) have historically been a rich source of vulnerabilities. Keep `markitdown` updated. The sandbox above is the primary mitigation for an exploited parser.
- **Image vision.** Images are routed to your in-session Claude via the `Read` tool — markitdown is not invoked for image extensions and no external LLM client is required. Image bytes remain local; Claude reads them as it would any other file in the session.
- **Audio.** Audio transcription is not yet routed through in-session Claude (planned Phase 4). Audio currently falls through to markitdown. If you configure markitdown to call an external LLM for transcription, the audio file is sent off-device. parsemd does not configure this — markitdown does. See `PRIVACY.md`.

## Reporting

Open an issue at [github.com/ayastaga/parsemd](https://github.com/ayastaga/parsemd/issues) for non-sensitive reports. For sensitive vulnerability reports, contact the maintainer listed in `plugin.json`.
