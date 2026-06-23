---
name: parsemd-diff
description: >
  Parse two binary documents and compare them using Claude's reasoning.
  Surfaces additions, removals, and changes with source citations.
  Use for contract versioning, spec comparison, or document revision tracking.
---

/parse-diff $ARGUMENTS

[parsemd-diff]
Two documents were parsed and injected above by parsemd. Compare them thoroughly:
- List key differences: additions, removals, and changes
- For each difference, cite both sources using [Source: filename p<N>] or [Source: filename slide:<N>] format
- Group differences by topic or section when possible
- Note unchanged sections briefly ("Section X: no changes")

Present a structured comparison, then wait for follow-up questions.
