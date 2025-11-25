---
title: Test Frontmatter Image Processing
public: true
cover: "![[cover-image.jpg]]"
photographer_portrait: "![[photographer-headshot.jpg]]"
hero_image: "![Hero](hero-banner.png)"
thumbnail: "thumb.jpg"
featured_image: "abc123def456789"
---

# Test Content

This file demonstrates the enhanced frontmatter image processing.

The following frontmatter fields now support image references:
- `cover` - Using Obsidian syntax: `![[cover-image.jpg]]`
- `photographer_portrait` - Using Obsidian syntax: `![[photographer-headshot.jpg]]`
- `hero_image` - Using Markdown syntax: `![Hero](hero-banner.png)`
- `thumbnail` - Using direct path: `thumb.jpg`
- `featured_image` - Using hash: `abc123def456789`

Each field will be processed to include:
- Main field with default size (lg): `cover`, `photographer_portrait`, etc.
- Size variants: `cover-xs`, `cover-sm`, `cover-md`, `cover-lg`, `cover-xl`
- Same pattern for all image fields