# Frontmatter Image Processing

The repo-processor now supports automatic processing of image references in frontmatter fields, similar to how the `cover` field was previously handled.

## Supported Fields

By default, the following frontmatter fields are processed as images:

- `cover` - Cover image for the post
- `photographer_portrait` - Portrait of the photographer
- `hero_image` - Hero/banner image
- `thumbnail` - Thumbnail image
- `featured_image` - Featured image

## Supported Formats

Each field can contain an image reference in any of these formats:

1. **Obsidian syntax**: `![[image.jpg]]`
2. **Markdown syntax**: `![alt text](image.jpg)`
3. **Direct path**: `image.jpg`
4. **Hash reference**: `abc123def456...` (32+ character hash)

## Output Format

For each image field, the processor generates:

- **Main field**: Uses the default size (lg) - e.g., `cover: "/_media/lg/image.webp"`
- **Size variants**: Creates additional fields for each size:
  - `{field}-xs`: Extra small variant
  - `{field}-sm`: Small variant
  - `{field}-md`: Medium variant
  - `{field}-lg`: Large variant
  - `{field}-xl`: Extra large variant

## Example

Input frontmatter:
```yaml
---
title: My Post
cover: "![[cover-image.jpg]]"
photographer_portrait: "![[photographer-headshot.jpg]]"
---
```

Output after processing:
```yaml
---
title: My Post
cover: "/_media/lg/cover-image.webp"
cover-xs: "/_media/xs/cover-image.webp"
cover-sm: "/_media/sm/cover-image.webp"
cover-md: "/_media/md/cover-image.webp"
cover-lg: "/_media/lg/cover-image.webp"
cover-xl: "/_media/xl/cover-image.webp"
photographer_portrait: "/_media/lg/photographer-headshot.webp"
photographer_portrait-xs: "/_media/xs/photographer-headshot.webp"
photographer_portrait-sm: "/_media/sm/photographer-headshot.webp"
photographer_portrait-md: "/_media/md/photographer-headshot.webp"
photographer_portrait-lg: "/_media/lg/photographer-headshot.webp"
photographer_portrait-xl: "/_media/xl/photographer-headshot.webp"
---
```

## Custom Fields

You can configure which fields are processed as images by passing the `frontmatterImageFields` option:

```typescript
const result = await processFolder(vaultPath, {
  frontmatterImageFields: [
    'cover',
    'author_photo',
    'banner_image',
    'og_image',
    'twitter_card_image'
  ]
});
```

## Integration with Media Processing

This feature works seamlessly with the existing media processing pipeline:

- Images are resolved using the same MediaService
- Supports the same optimization and size generation
- Respects `useAbsolutePaths` and `preferredSize` options
- Falls back gracefully if images are not found