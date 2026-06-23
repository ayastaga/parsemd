---
name: parsemd-summarize
description: >
  Parse a binary document and produce a maximally compressed summary using
  Claude's own reasoning. Preserves key facts, numbers, decisions, dates,
  named entities, and page/slide/sheet citations. Use when context budget
  matters more than full-text fidelity.
---

/parse-summarize $ARGUMENTS

[parsemd-summarize]
The document content above was parsed and injected by parsemd. Produce the tightest possible summary that preserves:
- Key facts, numbers, decisions, dates, named entities
- Page/slide/sheet citations from the <!-- page:N -->, <!-- slide:N -->, <!-- sheet:NAME --> anchors
- Section structure as a brief outline

Compress aggressively. Drop redundant phrasing. Do not invent information that is not in the document. Present the summary, then wait for follow-up questions before exploring details further.
