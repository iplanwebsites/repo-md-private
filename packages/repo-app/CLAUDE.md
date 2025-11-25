# repo.md Frontend Application (repo-app)

## Project Overview

**repo.md** (formerly pushmd) is a modern, Git-based content management system that serves as a developer-friendly alternative to traditional CMS platforms like WordPress. The platform enables users to publish content by pushing markdown files to Git, with instant edge deployment and no database required.

### Core Philosophy
- **File-based**: Content stored as markdown files, not in databases
- **Git-native**: Push to Git to publish, full version control
- **Edge-first**: Content served from 200+ global locations
- **Developer-friendly**: Works with VS Code, Obsidian, vim, or any text editor
- **Offline-capable**: Edit content without internet, sync when ready

### Key URLs
- **Production**: https://repo.md
- **API**: https://api.repo.md
- **Static Assets**: https://static.repo.md
- **npm Package**: `repo-md`

## Technology Stack

### Core Framework
- **Vue 3** with Composition API - src/main.js:1
- **Vite** - Build tool for fast development
- **TypeScript** - Type safety throughout the codebase
- **Vue Router** - Client-side routing - src/router.js:1

### State Management
- **Pinia** - Vue's official state management - src/store/:1
- **pinia-plugin-persistedstate** - Persist store data in localStorage

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui patterns** - Component design system in src/components/ui/:1
- **Custom component library** - Extensive UI components

### Authentication & Backend
- **Supabase Auth** - Authentication with GitHub OAuth - src/lib/supabase.js:1
- **tRPC Client** - Type-safe API communication - src/lib/trpcClient.js:1
- **API Integration** - RESTful endpoints at api.repo.md

### Real-time & AI Features
- **Agora SDK** - Video/audio conferencing - src/components/videoconf/:1
- **OpenAI Realtime API** - Voice and real-time AI features
- **Claude Integration** - AI agent capabilities - src/components/agent/:1
- **11Labs** - Text-to-speech functionality

### Development & Monitoring
- **Sentry** - Error tracking and performance monitoring
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Project Structure

```
pushmd-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI components (buttons, cards, forms)
│   │   ├── auth/           # Authentication flows
│   │   ├── nav/            # Navigation components
│   │   ├── pushmd/         # Platform-specific components
│   │   ├── videoconf/      # Video conferencing
│   │   ├── agent/          # AI agent interface
│   │   └── brochure/       # Marketing page components
│   ├── view/               # Page components/routes
│   │   ├── brochure/       # Public marketing pages
│   │   ├── admin/          # Admin panel pages
│   │   ├── org/            # Organization management
│   │   ├── project/        # Project management
│   │   └── account-settings/ # User settings pages
│   ├── store/              # Pinia stores
│   │   ├── auth.js         # Authentication state
│   │   ├── org.js          # Organization data
│   │   ├── project.js      # Project data
│   │   └── ui.js           # UI state management
│   ├── lib/                # Utilities and services
│   │   ├── api.js          # API client utilities
│   │   ├── supabase.js     # Supabase client
│   │   └── trpcClient.js   # tRPC configuration
│   ├── brochureContent/    # Static marketing content
│   │   ├── mainPages.js    # Core pages content
│   │   ├── productPages.js # Product feature pages
│   │   └── solutions/      # Solution-specific content
│   ├── router.js           # Route definitions
│   ├── main.js             # App entry point
│   └── appConfigs.js       # Global configuration
├── public/                 # Static assets
├── dist/                   # Build output
└── scripts/               # Build and utility scripts
```

## Key Dependencies & Their Purpose

### Core Dependencies
- **vue** (^3.5.13) - Core framework
- **vue-router** (^4.5.0) - SPA routing
- **pinia** (^2.3.0) - State management
- **@vueuse/core** (^12.1.0) - Vue composition utilities

### UI & Styling
- **tailwindcss** (^3.4.17) - CSS framework
- **@tailwindcss/typography** - Prose styling
- **lucide-vue-next** (^0.469.0) - Icon library
- **vue-sonner** (^1.3.1) - Toast notifications

### Content & Visualization
- **marked** (^16.0.3) - Markdown parsing
- **highlight.js** (^11.11.2) - Code syntax highlighting
- **d3** (^7.9.0) - Data visualization
- **apexcharts** (^4.3.0) - Charts
- **plotly.js-dist** (^2.36.0) - Scientific plots

### Real-time & Communication
- **agora-rtc-sdk-ng** (^4.23.3) - Video/audio calls
- **@supabase/supabase-js** (^2.48.1) - Auth & realtime
- **@trpc/client** (^11.0.1) - Type-safe API calls

### AI & Voice
- **@11labs/client** (^0.1.2) - Text-to-speech
- **openai** (^4.77.3) - OpenAI integration
- **@anthropic-ai/sdk** (^0.34.2) - Claude AI

### Platform SDK
- **repo-md** (^1.0.1105) - Core platform SDK (frequently updated)

## Navigation & Routes

### Public Routes (Brochure)
- `/` - Home page (redirects authenticated users to org dashboard)
- `/products/:id` - Product feature pages
- `/solutions/:id` - Solution pages by use case
- `/pricing` - Pricing plans
- `/templates` - Site templates
- `/themes` - Theme gallery
- `/blog`, `/guides`, `/docs` - Content sections
- `/about`, `/contact`, `/careers` - Company pages

### Authenticated Routes

#### Organization Level - src/view/org/:1
- `/:orgId` - Organization dashboard (project listing)
- `/:orgId/~/settings` - Organization settings
- `/:orgId/~/webhooks` - Webhook management
- `/:orgId/~/integrations` - Third-party integrations

#### Project Level - src/view/project/:1
- `/:orgId/:projectId` - Project dashboard
- `/:orgId/:projectId/deployments` - Deployment history
- `/:orgId/:projectId/site` - Site configuration
- `/:orgId/:projectId/mcp` - MCP server setup
- `/:orgId/:projectId/agent` - AI agent config
- `/:orgId/:projectId/api` - API documentation
- `/:orgId/:projectId/db` - Database management

#### Deployment Level - src/view/project/deploy/:1
- `/:orgId/:projectId/:deployId/posts` - Content management
- `/:orgId/:projectId/:deployId/medias` - Media library
- `/:orgId/:projectId/:deployId/source` - Source viewer
- `/:orgId/:projectId/:deployId/graph` - Content graph
- `/:orgId/:projectId/:deployId/logs` - Build logs
- `/:orgId/:projectId/:deployId/sqlite` - SQLite browser

#### User Account - src/view/account-settings/:1
- `/settings` - Account settings
- `/settings/billing` - Subscription management
- `/settings/apikeys` - API key management
- `/settings/notifications` - Notification preferences

### Admin Routes - src/view/admin/:1
- `/admin` - Admin dashboard
- `/admin/waitlist` - Waitlist management
- `/admin/database` - Database operations
- `/admin/api-cache` - API cache management

## Dashboard Architecture

### Organization Dashboard - src/view/org/OrgHome.vue:1
- **Project Grid**: Displays all projects with status indicators
- **Quick Actions**: Create project, import from GitHub
- **Filtering**: Search, sort by date/name, filter by status
- **Real-time Updates**: Auto-refresh project data

### Project Dashboard - src/view/project/ProjectHome.vue:1
The main project dashboard provides a comprehensive overview with:

#### Key Metrics Section
- Deployment status and history
- Content statistics (posts, media, pages)
- Collaborator count
- API usage metrics

#### Feature Grid (6 main sections)
1. **Content Management**
   - Posts & Pages editor
   - Media library
   - Content relationships graph

2. **Analytics & Insights**
   - Traffic analytics
   - Content performance
   - User engagement metrics

3. **Developer Tools**
   - API documentation
   - Database browser
   - MCP server configuration

4. **Team Collaboration**
   - Project settings
   - Webhook management
   - Access control

5. **Deployment Management**
   - Deployment history
   - Build logs
   - Branch previews

6. **Configuration**
   - Custom domains
   - Environment variables
   - Site settings

## Important Code Patterns

### Component Structure
Components follow a consistent pattern:
```vue
// src/components/example/ExampleComponent.vue
<script setup>
import { computed, ref } from 'vue'
import { useStore } from '@/store/storeName'
// Component logic
</script>

<template>
  <!-- Template with Tailwind classes -->
</template>
```

### Store Pattern - src/store/:1
```javascript
// Pinia store structure
export const useExampleStore = defineStore('example', {
  state: () => ({
    // State properties
  }),
  getters: {
    // Computed properties
  },
  actions: {
    // Methods
  }
})
```

### API Communication Pattern - src/lib/api.js:1
```javascript
// Using tRPC client
const result = await trpcClient.endpoint.method.query({ params })
// or
const result = await trpcClient.endpoint.method.mutate({ data })
```

### Authentication Check - src/router.js:90
```javascript
// Routes requiring auth have menu: "project"
if (to.matched.some(record => record.meta.menu === 'project')) {
  // Check authentication
}
```

## Brochure Content System

The brochure content is managed through a modular block system:

### Content Structure - src/brochureContent/allBrochureContent.js:1
- **mainPages**: Core marketing pages (home, about, contact)
- **productPages**: Feature-specific pages (6 products)
- **solutionPages**: Use-case specific pages (9 solutions)

### Block Types
- **HERO**: Landing sections with CTAs
- **TEXT**: Rich text content blocks
- **FEATURES**: Feature grids with icons
- **CARDS**: Card-based layouts
- **CTA**: Call-to-action sections
- **CODE**: Syntax-highlighted examples

### Adding New Brochure Content
1. Create content file in `src/brochureContent/solutions/` or appropriate directory
2. Export content structure with blocks array
3. Import and add to `allBrochureContent.js`
4. Content automatically routed at `/solutions/:id` or `/products/:id`

## Development Commands

```bash
# Install dependencies
npm install

# Update repo-md SDK to latest
npm run up

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint

# Format code
npm run format
```

## Environment Configuration

### Key Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SENTRY_DSN` - Sentry error tracking
- `VITE_AGORA_APP_ID` - Agora video conferencing
- `VITE_OPENAI_API_KEY` - OpenAI integration

### Configuration Files
- `appConfigs.js` - Global app configuration
- `vite.config.js` - Build configuration
- `tailwind.config.js` - Tailwind customization
- `vercel.json` - Deployment configuration

## Current Development State

 

### Waitlist Mode
The platform is currently in waitlist mode for production. Development access available through:
- `/beta-login` - Beta user login
- `/beta-signup` - Beta user registration
- Local development bypasses waitlist

## Key Features Reference

### Content Management - src/view/project/deploy/PostList.vue:1
- Markdown-based content editing
- Frontmatter metadata support
- Obsidian-compatible features (links, embeds, tags)
- Real-time preview

### Media Management - src/view/project/deploy/MediaList.vue:1
- Drag-and-drop upload
- Automatic image optimization
- AI vision capabilities
- CDN delivery

### Deployment System - src/view/project/DeploymentList.vue:1
- Git push triggers deployment
- Branch preview URLs
- Instant rollback
- Build logs and monitoring

### AI Integration - src/components/agent/:1
- Claude-powered content assistant
- Voice input/output
- Context-aware suggestions
- MCP protocol support

## Testing & Quality

### Code Quality Tools
- Sentry for error monitoring

### Performance Optimization
- Lazy loading routes
- Code splitting by route
- Image optimization
- Edge caching strategy

## Security Considerations

- All routes check authentication status
- Admin routes have additional permission checks
- API calls use secure tRPC client
- Sensitive data stored in environment variables
- CORS properly configured for API access

## Useful References

- Main entry: src/main.js:1
- Router configuration: src/router.js:1
- Store management: src/store/:1
- API utilities: src/lib/api.js:1
- UI components: src/components/ui/:1
- Dashboard views: src/view/project/:1
- Brochure content: src/brochureContent/:1