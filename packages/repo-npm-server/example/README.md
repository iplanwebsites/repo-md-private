# Repo-MD Dynamic Package Example

This example demonstrates the complete workflow of creating a repo.md project from a prompt and installing the dynamic npm package.

## Quick Start

```bash
# Navigate to the example directory
cd example

# Run the demo with a cooking blog prompt
npm run demo:cooking

# Or create your own project
npm run create "Your custom prompt here"

# Test the installed package
npm run test-package
```

## What This Example Does

1. **Simulates API Call**: Mocks the repo.md API to create a project from a text prompt
2. **Generates Project ID**: Returns a realistic project identifier
3. **Installs Dynamic Package**: Runs `npm install` with the dynamic package URL
4. **Tests Installation**: Verifies the package works correctly

## Example Output

```
🔧 Step 1: Creating repo.md project...
🚀 Creating repo.md project from prompt: "Create a cooking blog with AI-generated recipes"
✅ Project created successfully!
📋 Project ID: 676f9a8c45e7b3f2d1a9c8e4

📦 Step 2: Installing npm package...
📦 Installing package from: https://npm.repo.md/project/676f9a8c45e7b3f2d1a9c8e4
💻 Running: npm install my-repo-md@https://npm.repo.md/project/676f9a8c45e7b3f2d1a9c8e4
✅ Package installed successfully!

🎉 Complete! Your repo.md project is ready.

📋 Project Details:
   Project ID: 676f9a8c45e7b3f2d1a9c8e4
   Package URL: https://npm.repo.md/project/676f9a8c45e7b3f2d1a9c8e4

💡 Usage Example:
   import repo from 'my-repo-md';
   const posts = await repo.getAllPosts();

🌐 URLs:
   API: https://api.repo.md/v1/project-id/676f9a8c45e7b3f2d1a9c8e4
   NPM: https://npm.repo.md/project/676f9a8c45e7b3f2d1a9c8e4
   Web: https://repo.md/project/676f9a8c45e7b3f2d1a9c8e4
```

## Available Scripts

- `npm run create "prompt"` - Create and install a new project
- `npm run demo:cooking` - Demo with cooking blog prompt
- `npm run demo:tech` - Demo with tech blog prompt  
- `npm run demo:docs` - Demo with documentation prompt
- `npm run test-package` - Test the installed package

## API Functions

### `createRemoteRepoFromPrompt(prompt, options)`

Simulates creating a repo.md project from a text prompt.

**Parameters:**
- `prompt` (string): Description of the project to create
- `options` (object): Configuration options
  - `apiUrl`: API base URL (default: 'https://api.repo.md/v1')
  - `timeout`: Request timeout in ms (default: 30000)
  - `verbose`: Enable detailed logging (default: false)

**Returns:** Project object with ID and endpoints

### `installRepoMdPackage(projectId, options)`

Installs the dynamic npm package for a project.

**Parameters:**
- `projectId` (string): The project identifier
- `options` (object): Installation options
  - `packageName`: Package name (default: 'my-repo-md')
  - `npmRegistry`: Registry URL (default: 'https://npm.repo.md')
  - `directory`: Install directory (default: current working directory)
  - `verbose`: Enable detailed logging (default: false)

**Returns:** Installation result with package URL and command

### `createAndInstallRepo(prompt, options)`

Complete workflow: create project and install package.

**Parameters:**
- `prompt` (string): Project description
- `options` (object): Combined options for both operations

**Returns:** Combined result with project and installation details

## Real-World Integration

To integrate with the actual repo.md API, replace the mock `createRemoteRepoFromPrompt` function with real API calls:

```javascript
export async function createRemoteRepoFromPrompt(prompt, options = {}) {
  const response = await fetch(`${options.apiUrl}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      prompt,
      type: 'generated',
      settings: options.projectSettings
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}
```

## Testing

The example includes a test script that verifies:
- Package can be imported
- Pre-configured instance is available
- RepoMd class can be used to create custom instances
- Methods are accessible (even if they fail due to mock data)

Run the test after installation:
```bash
npm run test-package
```