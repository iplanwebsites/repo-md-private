# Media Upload Implementation Summary

## Overview
Implemented backend support for media uploads from the frontend, including direct file uploads and stock photo integration.

## New Endpoints

### 1. File Upload Endpoint
**Route:** `POST /api/projects/:projectId/upload-files`
- Accepts multiple files via multipart/form-data
- Commits files directly to the `uploads/` folder in the main branch
- Supports optional subfolders
- Returns commit SHA and file URLs

### 2. Stock Photo Integration
**Route:** `POST /api/projects/:projectId/add-stock-photo`
- Downloads photos from Unsplash URLs
- Automatically creates attribution file
- Commits to repository with proper metadata

### 3. Unsplash Search API
**Route:** `GET /api/projects/unsplash/search`
- Search Unsplash photos
- Returns formatted results for frontend selection
- Requires UNSPLASH_ACCESS_KEY environment variable

## Key Features

### Security
- JWT authentication required (Bearer token)
- Project-level access control (editor role or higher required)
- File type validation (images, videos, audio, documents)
- 10MB per file limit, 20 files max per request

### Git Integration
- Uses GitHub Trees API for atomic multi-file commits
- Single commit for all uploaded files
- Automatic deployment triggering if enabled
- Preserves file names with conflict resolution

### File Storage
- Files committed to `uploads/` folder by default
- Optional subfolder organization
- Direct CDN URLs provided: `https://static.repo.md/projects/{projectId}/{path}`

## Configuration

Add to `.env`:
```bash
# Required for stock photo integration
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

## Testing

Use the provided test script:
```bash
AUTH_TOKEN="your-jwt-token" PROJECT_ID="your-project-id" node test-media-upload.js
```

## Implementation Details

### New Files Created
1. `/routes/express/mediaUploadRoutes.js` - Main route handlers
2. `/lib/authMiddleware.js` - Express authentication middleware
3. `/lib/projectMiddleware.js` - Project access control middleware
4. `/test-media-upload.js` - Test script

### Modified Files
1. `/lib/gitFileService.js` - Added `createCommitWithFiles` method
2. `/lib/githubService.js` - Implemented multi-file commit using Trees API
3. `/lib/project.js` - Added `getProjectAccessLevel` function
4. `/server.js` - Registered new routes
5. `/.env.example` - Added Unsplash configuration

### Dependencies Added
- `multer` - Multipart form handling
- `mime-types` - File type detection (already existed)

## Notes
- The implementation uses the GitHub Trees API for efficient multi-file commits
- File uploads are atomic - all files in a request are committed together
- Unsplash integration includes proper attribution handling
- The system automatically triggers deployments if configured for the project