---
name: parsemd-relevant
description: >
  Extract only query-relevant sections from a document using keyword scoring.
  Injects a document outline plus the top-scoring sections, saving context tokens.
  Use when the user needs focused context from a large document.
---

/parse-relevant $ARGUMENTS

[parsemd-relevant]
The sections above were extracted by parsemd's relevance scoring based on the user's query.
The full document outline is included. If critical information might be in sections NOT selected,
tell the user which sections look relevant from the outline and suggest:
`/parsemd <file> --section "Section Name"`
