---
public: true
slug: test-page
---

# Link Resolution Test

## Wikilink Tests

- Basic wikilink: [[contact]]
- Wikilink with alias: [[contact|Contact Page]]
- Wikilink to non-existent page: [[non-existent]]
- Wikilink with header: [[contact#header]]
- Wikilink with block reference: [[contact#^block123]]

## Markdown Link Tests

- Relative markdown link: [Contact](./pages/contact.md)
- Root relative link: [Index](/index.md)
- Already processed link: [External](https://example.com)
- Anchor link: [Section](#section)

## Mixed Tests

- Link in a paragraph with [[contact]] and [another link](pages/contact.md).