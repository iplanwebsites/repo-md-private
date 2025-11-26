# Repo-MD Builder Scripts

This directory contains utility scripts for the repo-build-worker.

## Dockerization Test Scripts

### Copy Repo-Processor

The `copy-repo-processor.js` script copies the essential files from the repo-processor package for use in Docker environments without relying on GitHub packages.

**Usage:**
```bash
# Use default path (../repo-processor)
node scripts/copy-repo-processor.js

# Use custom path
REPO_PROCESSOR_PATH=/path/to/repo-processor node scripts/copy-repo-processor.js
```

This script will:
1. Create a directory at `src/modules/repo-processor`
2. Copy `package.json` from repo-processor
3. Copy the entire `dist` folder from repo-processor

By default, the script looks for repo-processor in the parent directory of repo-build-worker. If your project structure is different, you can specify a custom path using the `REPO_PROCESSOR_PATH` environment variable.

### Test Dockerization

The `test-dockerization.js` script tests the Docker-friendly approach for using the repo-processor package.

**Usage:**
```bash
node scripts/test-dockerization.js
```

This script will:
1. Copy the repo-processor files using the copy-repo-processor script
2. Create a modified version of buildAssets.js that imports from the new location
3. Test the RepoProcessor initialization to validate that the setup works

For Docker integration, you'll need to include in your Dockerfile:
```dockerfile
# Install repo-processor dependencies
RUN cd /app/src/modules/repo-processor && npm install --omit=dev
```

## WordPress Import Testing

### Test WP Importer

The `test-wp-importer.js` script tests the WordPress import functionality.

**Prerequisites:**
- Place a WordPress export file named `sample-wp-export.xml` in this directory (a sample file is included)
- Alternatively, use a file named `wp1.xml` (as configured in the script)

**Usage:**
```bash
npm run test:wp
```

The script will:
1. Create a test directory at `./test-wp-import`
2. Import the WordPress content from the sample export file
3. Display progress and list all generated files

**Getting a Sample WordPress Export File:**
1. From a WordPress site, go to Tools > Export
2. Select what to export (Posts, Pages, etc.)
3. Download the export file
4. Rename it to `sample-wp-export.xml` and place it in this scripts directory

## R2 Upload Scripts

This directory contains utility scripts for working with Cloudflare R2 storage.

## Upload Text to R2

`uploadTextToR2.js` is a simple script that uploads a text file to Cloudflare R2 storage.

### Prerequisites

Before using this script, make sure you have the following environment variables set:

- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - Your R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Your R2 secret access key
- `R2_BUCKET_NAME` - The name of your R2 bucket

You can set these variables in your shell environment:

```bash
export R2_ACCOUNT_ID=your_account_id
export R2_ACCESS_KEY_ID=your_access_key_id
export R2_SECRET_ACCESS_KEY=your_secret_access_key
export R2_BUCKET_NAME=your_bucket_name
```

Or create a `.env` file in the project root with:

```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
```

### Usage

```bash
node uploadTextToR2.js <file-path> [object-key]
```

- `<file-path>`: Path to the text file you want to upload (required)
- `[object-key]`: Key to use for the object in R2 (optional, defaults to the filename)

### Example

```bash
# Upload example.txt to R2 with the same filename
node uploadTextToR2.js ./example.txt

# Upload example.txt to R2 with a custom path and filename
node uploadTextToR2.js ./example.txt folder/custom-name.txt
```

The script will output the public URL where the file can be accessed after uploading.