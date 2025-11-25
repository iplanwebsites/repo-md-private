# Enhancement Roadmap: Gemini CLI to Obsidian Vault Management Agent

## Executive Summary

This roadmap outlines the transformation of the existing Gemini CLI into a specialized agent for managing Obsidian vault markdown repositories. The conversion leverages the robust existing architecture while introducing Obsidian-specific functionality, new authentication systems, external API integrations, and content migration tools.

## Current State Analysis

### Existing Architecture Strengths
- **Monorepo Structure**: Well-organized with `packages/cli` (React/Ink UI) and `packages/core` (business logic)
- **Extensible Tool System**: Robust tool architecture with validation, registration, and MCP server support
- **Configuration Management**: Hierarchical settings system with environment variable resolution
- **File Operations**: Comprehensive file manipulation tools (read, write, edit, glob, grep)
- **Authentication Infrastructure**: Multi-type auth system (Google OAuth, API keys, Vertex AI)
- **Memory System**: Hierarchical context management with Git integration
- **Command Framework**: Slash command system with auto-completion and validation

### Current Limitations for Obsidian Use
- **AI Provider Dependency**: Tightly coupled to Google Gemini/Vertex AI
- **File Context**: Optimized for code files, not markdown content management
- **No Obsidian Integration**: Missing vault-specific operations (links, tags, metadata)
- **No Content Migration**: No RSS, WordPress, or other content import capabilities
- **No Deployment**: No publishing or site generation capabilities

## Transformation Architecture

### Phase 1: Core Agent Foundation (Weeks 1-4)

#### 1.1 Agent Specification System
**Files to Modify:**
- `packages/core/src/config/config.ts` - Add REPO.md loading
- `packages/cli/src/config/settings.ts` - Add repo-specific settings

**New Implementation:**
```typescript
// packages/core/src/config/repoConfig.ts
interface RepoConfig {
  name: string;
  description: string;
  type: 'obsidian-vault' | 'generic-markdown';
  vaultPath: string;
  guidelines: string[];
  tools: string[];
  authProvider: string;
  deployConfig?: DeployConfig;
}

// Load from REPO.md instead of GEMINI.md
const loadRepoConfig = (path: string): RepoConfig => {
  // Parse REPO.md YAML frontmatter + content
  // Extract to .repo/guidelines.json for debugging
}
```

#### 1.2 Obsidian Vault Detection and Initialization
**New Files:**
- `packages/core/src/services/obsidianVaultService.ts`
- `packages/core/src/tools/obsidianTools.ts`

**Functionality:**
- Detect `.obsidian/` directory and vault configuration
- Parse vault metadata, plugins, and settings
- Initialize vault-specific tool registry
- Handle Obsidian link syntax `[[internal-links]]`

#### 1.3 Authentication System Migration
**Files to Modify:**
- `packages/core/src/core/contentGenerator.ts` - Replace AuthType enum
- `packages/cli/src/config/auth.ts` - Add new auth providers

**New Auth Providers:**
```typescript
export enum AuthType {
  JWT_TOKEN = 'jwtToken',
  OAUTH2_GENERIC = 'oauth2Generic',
  API_KEY_CUSTOM = 'apiKeyCustom',
  LOCAL_VAULT = 'localVault'
}
```

**Implementation:**
- Replace Google Auth with configurable OAuth2 provider
- Add JWT token validation
- Support for custom authentication servers
- Local vault access (file system permissions)

### Phase 2: Obsidian-Specific Tools (Weeks 5-8)

#### 2.1 Core Obsidian Tools
**New Tools to Implement:**
```typescript
// packages/core/src/tools/obsidian/
├── noteManagementTool.ts     // Create, update, delete notes
├── linkManagementTool.ts     // Resolve, create, update internal links
├── tagManagementTool.ts      // Tag operations and queries
├── templateTool.ts           // Template instantiation
├── graphAnalysisTool.ts      // Vault graph analysis
└── metadataManagementTool.ts // Frontmatter and properties
```

**Key Features:**
- **Note Operations**: Create notes with proper frontmatter, handle daily notes
- **Link Resolution**: Convert `[[links]]` to proper paths, maintain link integrity
- **Tag Management**: Query by tags, create tag hierarchies
- **Template System**: Apply Obsidian templates with variable substitution
- **Graph Analysis**: Find orphaned notes, broken links, content clusters

#### 2.2 Enhanced File Discovery
**Files to Modify:**
- `packages/core/src/services/fileDiscoveryService.ts`

**Obsidian-Specific Enhancements:**
- Prioritize `.md` files over other formats
- Parse and index frontmatter metadata
- Build link graph for relationship analysis
- Respect `.obsidian/app.json` exclusion patterns
- Handle Obsidian attachment folders

### Phase 3: External API Integration (Weeks 9-12)

#### 3.1 Image Generation API Integration
**New Files:**
- `packages/core/src/services/imageGenerationService.ts`
- `packages/core/src/tools/imageGenerationTool.ts`

**Supported APIs:**
- **DALL-E 3**: OpenAI's image generation
- **Midjourney**: Via unofficial API
- **Stable Diffusion**: Self-hosted or API
- **Replicate**: Various image models

**Implementation:**
```typescript
// Extensible API provider system
interface ImageGenerationProvider {
  name: string;
  generateImage(prompt: string, options: ImageOptions): Promise<ImageResult>;
  validateApiKey(key: string): Promise<boolean>;
}

// Tool integration
class ImageGenerationTool extends Tool {
  async execute(params: {
    prompt: string;
    provider: string;
    size?: string;
    style?: string;
    outputPath?: string;
  }): Promise<ToolResult> {
    // Generate image, save to vault assets, return markdown link
  }
}
```

#### 3.2 Content Enhancement APIs
**Additional External APIs:**
- **Text-to-Speech**: Generate audio versions of notes
- **Translation**: Multi-language content support
- **Summarization**: Content condensation
- **Fact-Checking**: Verify information in notes

### Phase 4: Migration and Import System (Weeks 13-16)

#### 4.1 Slash Command Integration
**Reference:** `/packages/cli/src/ui/hooks/slashCommandProcessor.ts` (lines 191-978)

The slash command system provides the perfect entry point for migration functionality. Commands are defined in the `slashCommands` array and automatically handle parsing, validation, and tool scheduling.

**New Slash Commands for Migration:**

```typescript
// Add to slashCommands array in slashCommandProcessor.ts
{
  name: 'migrate',
  description: 'Interactive migration menu for content import',
  completion: async () => ['rss', 'wordpress', 'website', 'notion', 'roam'],
  action: async (mainCommand, subCommand, args) => {
    if (!subCommand) {
      // Show interactive migration menu
      addMessage({
        type: MessageType.INFO,
        content: `Available migration options:
  /migrate rss <feed-url>     - Import RSS/Atom feeds
  /migrate wordpress <file>   - Import WordPress XML export
  /migrate website <url>      - Crawl and import website content
  /migrate notion <export>    - Import Notion database export
  /migrate roam <json>        - Import Roam Research graph`,
        timestamp: new Date(),
      });
      return;
    }
    
    return {
      shouldScheduleTool: true,
      toolName: `migrate_${subCommand}`,
      toolArgs: { source: args?.trim() }
    };
  }
},
{
  name: 'crawl',
  description: 'Intelligent website crawling and content extraction',
  action: (mainCommand, subCommand, args) => {
    const url = subCommand || args?.trim();
    if (!url) {
      addMessage({
        type: MessageType.ERROR,
        content: 'Usage: /crawl <website-url> or /crawl auto-detect <url>',
        timestamp: new Date(),
      });
      return;
    }
    
    return {
      shouldScheduleTool: true,
      toolName: 'smart_crawl',
      toolArgs: { 
        url, 
        autoDetect: subCommand === 'auto-detect',
        extractImages: true,
        followLinks: true,
        maxDepth: 3 
      }
    };
  }
},
{
  name: 'import',
  description: 'Direct content import commands',
  completion: async () => ['rss', 'atom', 'wordpress', 'json', 'markdown'],
  action: (mainCommand, subCommand, args) => {
    const supportedTypes = ['rss', 'atom', 'wordpress', 'json', 'markdown'];
    
    if (!subCommand || !supportedTypes.includes(subCommand)) {
      addMessage({
        type: MessageType.ERROR,
        content: `Usage: /import <${supportedTypes.join('|')}> <source>`,
        timestamp: new Date(),
      });
      return;
    }
    
    return {
      shouldScheduleTool: true,
      toolName: `import_${subCommand}`,
      toolArgs: { source: args?.trim() }
    };
  }
},
{
  name: 'deploy',
  description: 'Deploy vault as static site to various platforms',
  completion: async () => ['netlify', 'vercel', 'github', 'ftp', 'obsidian-publish'],
  action: (mainCommand, subCommand, args) => {
    if (!subCommand) {
      addMessage({
        type: MessageType.INFO,
        content: `Available deployment targets:
  /deploy netlify     - Deploy to Netlify
  /deploy vercel      - Deploy to Vercel  
  /deploy github      - Deploy to GitHub Pages
  /deploy ftp         - Deploy via FTP/SSH
  /deploy obsidian-publish - Deploy to Obsidian Publish
  /deploy preview     - Generate local preview`,
        timestamp: new Date(),
      });
      return;
    }
    
    return {
      shouldScheduleTool: true,
      toolName: 'deploy_site',
      toolArgs: { 
        target: subCommand,
        options: args ? JSON.parse(args) : {}
      }
    };
  }
}
```

#### 4.2 RSS Feed Import
**New Files:**
- `packages/core/src/services/rssImportService.ts`
- `packages/core/src/tools/rssImportTool.ts`
- `packages/cli/src/commands/importCommand.ts`

**Implementation:**
```typescript
// RSS import via npx command
const importRssCommand = {
  name: 'import_rss',
  description: 'Import RSS feeds into Obsidian vault',
  execute: async (feedUrl: string, options: ImportOptions) => {
    // Parse RSS feed
    // Convert entries to Obsidian notes
    // Handle media assets
    // Create index and navigation
  }
};
```

**Features:**
- Parse RSS/Atom feeds with automatic format detection
- Convert articles to Obsidian notes with proper frontmatter
- Download and organize media assets
- Create tag taxonomy from RSS categories
- Generate index notes and navigation
- Support for feed authentication and custom headers

#### 4.3 Smart Website Crawling
**New Files:**
- `packages/core/src/services/webCrawlerService.ts`
- `packages/core/src/tools/smartCrawlTool.ts`

**Auto-Detection Features:**
```typescript
class SmartCrawlTool extends Tool {
  async execute(params: {
    url: string;
    autoDetect: boolean;
    extractImages: boolean;
    followLinks: boolean;
    maxDepth: number;
  }): Promise<ToolResult> {
    // 1. Inspect website structure
    // 2. Auto-detect content patterns (blog posts, articles, docs)
    // 3. Extract navigation structure
    // 4. Download images and assets
    // 5. Convert to Obsidian format with proper linking
  }
}
```

**Smart Detection Capabilities:**
- **Blog Detection**: Identify post patterns, pagination, categories
- **Documentation Sites**: Extract hierarchy, navigation, code blocks
- **News Sites**: Article extraction, author metadata, publication dates
- **E-commerce**: Product descriptions, specifications, reviews
- **Wiki Sites**: Page relationships, categories, cross-references

#### 4.4 WordPress Import
**Enhanced Implementation:**
- Parse WordPress XML export with WXR format support
- Convert posts/pages to Obsidian notes with rich metadata
- Handle WordPress shortcodes and Gutenberg blocks
- Import media library with proper organization
- Preserve category/tag structure as Obsidian tags
- Maintain URL mappings for SEO redirects
- Support for custom post types and fields

#### 4.5 Generic Migration Framework
**New Files:**
- `packages/core/src/migration/migrationFramework.ts`
- `packages/core/src/migration/contentTransformers.ts`

**Support For:**
- **Notion**: Database and page exports with relation preservation
- **Roam Research**: Graph database exports with block references
- **Logseq**: Block-based content with hierarchy
- **Markdown**: Generic markdown repositories with frontmatter
- **Confluence**: Corporate wiki exports with space structure
- **Bear**: Note exports with tags and attachments
- **Evernote**: ENEX format with rich content
- **OneNote**: Notebook structure with sections

### Phase 5: Deployment and Publishing (Weeks 17-20)

#### 5.1 Static Site Generation
**New Files:**
- `packages/core/src/services/siteGenerationService.ts`
- `packages/core/src/tools/deployTool.ts`

**Features:**
```typescript
// Deploy command implementation
const deployCommand = {
  name: 'deploy',
  description: 'Deploy Obsidian vault as static site',
  execute: async (options: DeployOptions) => {
    // Convert Obsidian notes to HTML
    // Generate navigation and search
    // Optimize assets
    // Deploy to target platform
  }
};
```

#### 5.2 Deployment Targets
**Supported Platforms:**
- **Netlify**: Jamstack deployment
- **Vercel**: Next.js/React integration
- **GitHub Pages**: GitHub Actions workflow
- **Custom Server**: FTP/SSH deployment
- **Obsidian Publish**: Official Obsidian hosting

#### 5.3 Site Generation Features
- **Link Resolution**: Convert `[[internal-links]]` to proper URLs
- **Navigation Generation**: Automatic site structure
- **Search Integration**: Full-text search functionality
- **Theme Support**: Customizable site appearance
- **SEO Optimization**: Meta tags, sitemap generation

### Phase 6: Advanced Features (Weeks 21-24)

#### 6.1 Collaborative Features
- **Conflict Resolution**: Git-based collaboration
- **Real-time Sync**: WebSocket-based updates
- **Access Control**: Permission-based sharing
- **Comment System**: Note annotations

#### 6.2 Automation and Workflows
- **Scheduled Tasks**: Automated content updates
- **Webhook Integration**: External service triggers
- **Backup System**: Automated vault backups
- **Analytics**: Usage tracking and insights

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-4)
- [ ] Implement REPO.md specification system
- [ ] Create Obsidian vault detection
- [ ] Migrate authentication system
- [ ] Update configuration management

### Phase 2: Obsidian Tools (Weeks 5-8)
- [ ] Build core Obsidian tools
- [ ] Enhance file discovery for markdown
- [ ] Implement link and tag management
- [ ] Add template system

### Phase 3: External APIs (Weeks 9-12)
- [ ] Integrate image generation APIs
- [ ] Add content enhancement services
- [ ] Build extensible API provider system
- [ ] Implement asset management

### Phase 4: Migration (Weeks 13-16)
- [ ] Build RSS import functionality
- [ ] Add WordPress migration
- [ ] Create generic migration framework
- [ ] Implement batch processing

### Phase 5: Deployment (Weeks 17-20)
- [ ] Build static site generator
- [ ] Add deployment targets
- [ ] Implement URL transformation
- [ ] Create SEO optimization

### Phase 6: Advanced Features (Weeks 21-24)
- [ ] Add collaborative features
- [ ] Implement automation workflows
- [ ] Build analytics system
- [ ] Create backup solutions

## Migration Strategy

### Breaking Changes
1. **Authentication**: Replace Google Auth with configurable providers
2. **Configuration**: REPO.md replaces GEMINI.md
3. **Tool Focus**: Shift from code to markdown/content tools
4. **CLI Name**: Rename from `gemini-cli` to `obsidian-agent`

### Backward Compatibility
- Maintain existing tool interfaces where possible
- Provide migration path for existing configurations
- Support both GEMINI.md and REPO.md during transition
- Preserve existing slash command structure

### Deployment Strategy
- **Parallel Development**: Maintain existing CLI while building new agent
- **Feature Flags**: Gradual rollout of new functionality
- **Beta Testing**: Obsidian community testing program
- **Documentation**: Comprehensive migration guides

## Success Metrics

### Technical Metrics
- **Performance**: Sub-second vault operations
- **Reliability**: 99.9% uptime for core functions
- **Compatibility**: Support for 95% of Obsidian features
- **Extensibility**: Plugin system for custom tools

### User Metrics
- **Adoption**: 1000+ active users within 6 months
- **Satisfaction**: 4.5+ star rating
- **Engagement**: Daily active usage
- **Community**: Active contribution to tool ecosystem

## Risk Mitigation

### Technical Risks
- **Obsidian API Changes**: Maintain compatibility layer
- **External API Reliability**: Implement fallback providers
- **Performance Issues**: Optimize for large vaults (10,000+ notes)
- **Security Concerns**: Implement secure credential storage

### Business Risks
- **User Adoption**: Engage Obsidian community early
- **Competition**: Differentiate with unique features
- **Maintenance**: Build sustainable development model
- **Licensing**: Ensure compliance with Obsidian terms

## Conclusion

This roadmap transforms the Gemini CLI into a comprehensive Obsidian vault management agent by leveraging existing architectural strengths while adding specialized functionality. The phased approach ensures manageable development while delivering value at each stage.

The key to success lies in maintaining the robust tool architecture while adapting it to Obsidian's unique requirements, providing seamless migration paths, and building a vibrant ecosystem of extensions and integrations.

---

*This roadmap represents a 24-week transformation plan that will result in a production-ready Obsidian vault management agent with comprehensive import, management, and deployment capabilities.*