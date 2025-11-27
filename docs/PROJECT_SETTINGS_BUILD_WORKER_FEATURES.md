# Project Settings → Build Worker Feature List

This document tracks which project settings from the webapp need to be passed to the build worker, their current implementation status, and priority.

---

## Overview

| Category | Settings in UI | Passed to Worker | Fully Implemented |
|----------|----------------|------------------|-------------------|
| Build & Deploy | 3 | 2 | Partial |
| Formatting | 5 | 2 | Partial |
| Media | 8 | 0 | ❌ Not connected |
| Frontmatter | 2 | 0 | ❌ Not connected |
| AI/Embeddings | 4 | 0 | ❌ Hardcoded defaults |

---

## 1. BUILD & DEPLOYMENT SETTINGS

**UI Location:** `BuildDeployTab.vue`
**API Location:** `project.settings.build.*`

| Setting | UI Field | Worker Param | Status | Notes |
|---------|----------|--------------|--------|-------|
| Repository Folder | `repositoryFolder` | `repositoryFolder` | ✅ Connected | Specifies subfolder for markdown |
| Ignore Files | `ignoreFiles` | `ignoreFiles` | ✅ Connected | Glob patterns to exclude |
| Auto Deployment | `enableAutoDeployment` | N/A | ⚠️ UI Only | Used by webhook handler, not worker |
| Production Branch | (hardcoded select) | N/A | ❌ Not saved | UI shows options but doesn't save |

**Worker defaults that should be configurable:**

| Setting | Current Default | Worker Location |
|---------|-----------------|-----------------|
| Skip Embeddings | `false` (env: `SKIP_EMBEDDINGS`) | `buildAssets.ts:JobData.skipEmbeddings` |
| Keep Temp Files | `false` (env: `KEEP_TMP_BUILD_FOLDER`) | `worker.ts` |
| Debug Level | `1` | `buildAssets.js` (legacy) |

---

## 2. FORMATTING / MARKDOWN SETTINGS

**UI Location:** `FormattingTab.vue`
**API Location:** `project.formatting.*`

| Setting | UI Field | Worker Param | Status | Notes |
|---------|----------|--------------|--------|-------|
| Page Link Prefix | `pageLinkPrefix` | `notePrefix` | ✅ Connected | URL prefix for page links |
| Media Prefix | `mediaPrefix` | `mediaPrefix` | ✅ Connected | Default: `/_repo/medias` |
| Parse Formulas | `parseFormulas` | - | ❌ Not connected | LaTeX parsing (Pro feature) |
| Remove Dead Links | `removeDeadLinks` | - | ❌ Not connected | Handle broken wiki-links |
| Syntax Highlighting | `syntaxHighlighting` | - | ❌ Not connected | Code block highlighting |

**Processor defaults that should be configurable:**

| Setting | Current Default | Processor Location |
|---------|-----------------|-------------------|
| `contentConfig.ignoreFiles` | `['CONTRIBUTING.md', 'README.md', 'readme.md', 'LICENSE.md']` | `config.ts` |
| `contentConfig.processAllFiles` | `false` | `config.ts` |
| `contentConfig.slugConflictStrategy` | `'number'` | `config.ts` |

---

## 3. MEDIA SETTINGS ⚠️ NOT CONNECTED

**UI Location:** `MediaTab.vue`
**API Location:** `project.media.*`

### Image Processing

| Setting | UI Field | Worker Param | Status | Worker Default |
|---------|----------|--------------|--------|----------------|
| Image Sizes | `imageSizes: {xs, sm, lg, xl, 2xl}` | - | ❌ Not connected | `[100, 300, 700, 1400, 2160]` |
| Image Formats | `imageFormats: {jpg, webp}` | - | ❌ Not connected | `webp` only |
| Image Quality | (not in UI) | - | ❌ Not in UI | `80` |

**Current worker defaults in `buildAssets.ts`:**
```typescript
const DEFAULT_IMAGE_SIZES = [
  { width: 100, height: null, suffix: 'xs' },
  { width: 300, height: null, suffix: 'sm' },
  { width: 700, height: null, suffix: 'md' },
  { width: 1400, height: null, suffix: 'lg' },
  { width: 2160, height: null, suffix: 'xl' },
];

media: {
  optimize: true,
  format: 'webp',
  quality: 80,
  useHash: true,
  useSharding: false,
}
```

### Embeds & Players

| Setting | UI Field | Worker Param | Status | Notes |
|---------|----------|--------------|--------|-------|
| YouTube Embeds | `enableYoutubeEmbeds` | - | ❌ Not connected | Affects iframe processing |
| Audio Player | `enableAudioPlayer` | - | ❌ Not connected | Experimental feature |

### Code Blocks

| Setting | UI Field | Worker Param | Status | Notes |
|---------|----------|--------------|--------|-------|
| Render Method | `codeBlockRender` | - | ❌ Not connected | `css` or `iframe` |
| Theme | `codeBlockTheme` | - | ❌ Not connected | `light` or `dark` |

### Mermaid Diagrams

| Setting | UI Field | Worker Param | Status | Processor Default |
|---------|----------|--------------|--------|-------------------|
| Render Method | `mermaidRender` | - | ❌ Not connected | `inline-svg` |
| Theme | `mermaidTheme` | - | ❌ Not connected | `false` (light) |

**Processor mermaid config in `config.ts`:**
```typescript
mermaid: {
  enabled: true,
  strategy: 'inline-svg', // Options: 'img-png', 'img-svg', 'inline-svg', 'pre-mermaid'
  dark: false,
}
```

---

## 4. FRONTMATTER SETTINGS ⚠️ NOT CONNECTED

**UI Location:** `FrontmatterTab.vue`
**API Location:** `project.frontmatter.*` (assumed)

| Setting | UI Field | Worker Param | Status | Notes |
|---------|----------|--------------|--------|-------|
| Default Visibility | `defaultVisibility` | - | ❌ Not connected | public/private/hidden |
| Frontmatter Defaults | (planned) | - | ❌ Not implemented | Custom default values |

---

## 5. AI / EMBEDDINGS SETTINGS ⚠️ HARDCODED

**UI Location:** `AIAgentTab.vue`
**API Location:** `project.ai.*` (assumed)

| Setting | UI Field | Worker Param | Status | Worker Default |
|---------|----------|--------------|--------|----------------|
| Enable Text Search | `enableAiTextSearch` | - | ❌ Not connected | Always enabled |
| Enable Image Search | `enableAiImageSearch` | - | ❌ Not connected | Always enabled |
| Skip Embeddings | (not in UI) | `skipEmbeddings` | ⚠️ Env only | `SKIP_EMBEDDINGS` env var |

**Hardcoded embedding models in worker:**
```typescript
// Text embeddings
model: 'all-MiniLM-L6-v2' // dimension: 384

// Image embeddings
model: 'clip-vit-base-patch32' // dimension: 512

// Legacy worker uses:
// Xenova/mobileclip_s2
```

**Other hardcoded AI settings:**
```javascript
NB_SIMILAR_POSTS = 10  // Number of similar posts to compute
```

---

## 6. EXPERIMENTAL SECTIONS (Skip for now)

These sections exist in the UI but are marked experimental or not for MVP:

### Site Theme (`SiteThemeTab.vue`)
- Theme selection
- Site name, footer text
- Color scheme (light/dark/auto)

**Status:** 🧪 Experimental - Skip for build worker integration

### Integrations (`IntegrationsTab.vue`)
- Mailchimp, ConvertKit, Substack
- Discord, Slack
- Disqus, Giscus
- Claude, OpenAI
- Google Analytics, Plausible

**Status:** 🧪 Experimental - Skip for build worker integration

### AI Agent Editor (`AIAgentTab.vue`)
- Public/Editor agent configuration
- Model selection
- Agent capabilities
- System prompts

**Status:** 🧪 Experimental - Separate from build worker

### Secrets (`SecretsTab.vue`)
- API keys storage
- OpenAI, Anthropic, ElevenLabs, etc.

**Status:** 🧪 Experimental - Runtime only, not build-time

### Domains (`DomainsTab.vue`)
- Custom domain configuration
- CNAME setup

**Status:** ✅ Implemented separately - Not build worker related

### Webhooks (`WebhooksTab.vue`)
- Incoming/outgoing webhooks
- GitHub integration

**Status:** ✅ Implemented separately - Not build worker related

---

## Implementation Status

### ✅ Phase 1: Media Settings (IMPLEMENTED)

**Commit:** Added project settings integration

| Setting | UI Field | Status |
|---------|----------|--------|
| `imageSizes` | {xs, sm, md, lg, xl, 2xl} | ✅ Connected |
| `imageFormats` | {jpg, webp} | ✅ Connected |
| `imageQuality` | (future UI) | ✅ Ready (default: 80) |
| `mermaidRender` | svg/iframe/keep-as-code | ✅ Connected |
| `mermaidTheme` | light/dark | ✅ Connected |

**Files Modified:**
- `packages/repo-build-worker-ts/src/types/job.ts` - Added ProjectSettings types
- `packages/repo-build-worker-ts/src/process/buildAssets.ts` - Use settings instead of defaults
- `packages/repo-api/lib/cloudRun.js` - Pass projectSettings to worker

### ✅ Phase 2: Formatting Settings (IMPLEMENTED)

| Setting | UI Field | Status | Notes |
|---------|----------|--------|-------|
| `parseFormulas` | Toggle | ✅ Connected | Requires rehype-mathjax plugin |
| `removeDeadLinks` | Toggle | ✅ Connected | Requires custom rehype plugin |
| `syntaxHighlighting` | Toggle | ✅ Connected | Requires rehype-highlight plugin |

**Files Modified:**
- `packages/repo-processor-core/src/types/config.ts` - Added PipelineConfig interface
- `packages/repo-processor-core/src/processor/processor.ts` - Pass pipeline config to processMarkdown
- `packages/repo-build-worker-ts/src/process/buildAssets.ts` - Extract and pass formatting settings

**Note:** The pipeline config is now passed through, but the actual plugins (rehype-highlight,
remark-math, rehype-mathjax) need to be added to the pipeline for full functionality.

### 🔄 Phase 3: AI/Embeddings Settings (PENDING)
1. Add `skipEmbeddings` toggle to UI
2. Add similar posts count configuration
3. (Future) Model selection

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        repo-app (Vue)                           │
│  ProjectSettings tabs → trpc.projects.updateSettings.mutate()   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        repo-api (Express)                       │
│  MongoDB: projects.settings.*, projects.media.*                 │
│  cloudRun.js: createRepoDeployJob() → processDataForWorker()    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     repo-build-worker-ts                        │
│  worker.ts → buildAssets.ts → ProcessConfig                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     repo-processor-core                         │
│  Processor(config) → plugins                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### API (repo-api)
- `lib/cloudRun.js` - `processDataForWorker()` function (lines 271-329)
- `routes/trpc/projectRoutes.ts` - Settings schema validation

### Worker (repo-build-worker-ts)
- `src/types/job.ts` - Add new fields to `JobData` interface
- `src/process/buildAssets.ts` - Use settings instead of defaults

### Processor (repo-processor-core)
- `src/types/config.ts` - Ensure all options are exposed
- Uses `ProcessConfig` interface

### App (repo-app)
- Settings UI already exists, just needs backend connection verified
