# Multi-tenant Platform

A flexible multi-tenant platform that serves different templates based on the subdomain.

## Project Structure

```
./
├── packages/            # Shared code
│   ├── ui/              # Common UI components
│   ├── utils/           # Shared utilities
│   ├── config/          # Configuration management
│   └── api-client/      # API client for your services
│
├── apps/                # Application templates
│   ├── app-templates.json # Template configuration
│   ├── source/          # Source code for templates (cloned from GitHub)
│   ├── dist/            # Built template files
│   ├── next-template-a/ # NextJS implementation
│   ├── next-template-b/ # Another NextJS variant
│   └── remix-template/  # RemixJS implementation
│
├── server/              # Backend services
│   ├── api/             # API endpoints
│   ├── tenant-manager/  # Tenant configuration service
│   └── router/          # Request routing logic
│
├── scripts/             # Build and deployment scripts
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and update as needed
4. Start the development server:
   ```
   npm run dev
   ```

## Template Management

### Building Templates
To build all templates from their source repositories:
```
npm run build:templates
```

### Watching Templates for Changes
To watch templates for changes and rebuild automatically:
```
npm run watch:templates
```

## Testing Tenants

To test different tenants, you can either:

1. Add entries to your hosts file and use subdomains locally
2. Use the Cloudflare header simulation by setting the `cf-connecting-domain` header in your requests

Example request with curl:
```
curl -H "cf-connecting-domain: demo.yourdomain.com" http://localhost:3000
```

Example tenants configured:
- default.yourdomain.com - Template A
- demo.yourdomain.com - Template B
- test.yourdomain.com - Remix Template

## Adding New Templates

To add a new template:

1. Add the template configuration to `apps/app-templates.json`
2. Create a new directory in `apps/` for local development
3. Run `npm run build:templates` to build the template

## License

MIT
