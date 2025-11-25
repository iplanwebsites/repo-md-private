# GitHub Template API Documentation

This document describes the GitHub template functionality available through the Repo.md API.

## Overview

The Repo.md API provides two ways to create new repositories:

1. **From Templates**: Create repositories from existing template repositories with pre-configured boilerplate code
2. **From AI Brief**: Generate a complete project structure from a natural language description using AI

## API Endpoints

### 1. List Available Templates

Lists all available template repositories from a specific owner (organization or user).

**Endpoint:** `trpc.projects.listTemplates`

**Input:**
```typescript
{
  owner?: string;        // GitHub username or organization name (default: "repo-md")
  type?: 'org' | 'user'; // Default: 'org'
  includeGithubData?: boolean; // Fetch fresh data from GitHub (default: false)
}
```

**Response:**
```typescript
{
  success: boolean;
  templates: Array<{
    // Template metadata
    id: number;
    slug: string;
    name: string;
    icon: string;
    image: string;
    description: string;
    githubRepo: string;
    categories: string[];
    author: string;
    framework: string;
    stars: number;
    features: string[];
    demoUrl: string;
    
    // Parsed repository info
    templateOwner: string;
    templateRepo: string;
    
    // GitHub data (if includeGithubData is true)
    defaultBranch?: string;
    private?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  source: 'config' | 'merged'; // Indicates data source
}
```

**Example Usage:**
```javascript
// Get Repo.md templates (default)
const templates = await trpc.projects.listTemplates.query();

// Get templates from a specific organization
const customTemplates = await trpc.projects.listTemplates.query({
  owner: 'your-org',
  type: 'org',
  includeGithubData: true // Fetch fresh GitHub data
});
```

### 2. Create Repository from Template

Creates a new repository from a template and optionally creates a Repo.md project for it.

**Endpoint:** `trpc.projects.createFromTemplate`

**Input:**
```typescript
{
  templateOwner: string;      // Owner of the template repository
  templateRepo: string;       // Name of the template repository
  newRepoName: string;        // Name for the new repository
  orgId?: string;            // Optional organization ID (for future use)
  repoOptions?: {
    private?: boolean;       // Whether the new repo should be private
    description?: string;    // Repository description
    includeAllBranches?: boolean; // Include all branches from template
  };
  createProject?: boolean;    // Create a Repo.md project (default: true)
  triggerDeploy?: boolean;    // Trigger deployment after creation (default: false)
}
```

**Response:**
```typescript
{
  success: boolean;
  repository: {
    id: string;
    name: string;
    fullName: string;
    url: string;
    cloneUrl: string;
    sshUrl: string;
    defaultBranch: string;
    createdAt: string;
  };
  project?: {              // Only if createProject is true
    _id: string;
    handle: string;
    name: string;
    owner: string;
    githubRepo: {
      owner: string;
      repoName: string;
      fullName: string;
    };
  };
  deployment?: {           // Only if triggerDeploy is true
    deploymentId?: string;
    deploymentUrl?: string;
    environment?: string;
    createdAt?: string;
    method?: string;
    event_type?: string;
  };
  deploymentError?: string; // If deployment failed
  templateInfo?: {         // Template metadata if available
    name: string;
    description: string;
    categories: string[];
    features: string[];
  };
}
```

**Example Usage:**
```javascript
const result = await trpc.projects.createFromTemplate.mutate({
  templateOwner: 'your-org',
  templateRepo: 'nextjs-template',
  newRepoName: 'my-new-project',
  repoOptions: {
    private: false,
    description: 'My awesome new project'
  },
  createProject: true,
  triggerDeploy: true
});
```

### 3. Create Repository from AI Brief

Generates a complete project structure from a natural language description using AI.

**Endpoint:** `trpc.projects.createFromBrief`

**Input:**
```typescript
{
  brief: string;              // Natural language description (min 10 chars)
  newRepoName: string;        // Name for the new repository
  orgId?: string;            // Optional organization ID (for future use)
  repoOptions?: {
    private?: boolean;       // Whether the repo should be private
    description?: string;    // Repository description
  };
  generationOptions?: {
    projectType?: 'web' | 'api' | 'mobile' | 'desktop';
    language?: 'javascript' | 'typescript';
    framework?: string;      // e.g., 'react', 'nextjs', 'express'
  };
  createProject?: boolean;    // Create a Repo.md project (default: true)
  triggerDeploy?: boolean;    // Trigger deployment after creation (default: false)
}
```

**Response:**
```typescript
{
  success: boolean;
  repository: {
    name: string;
    fullName: string;
    url: string;
    cloneUrl: string;
    sshUrl: string;
    defaultBranch: string;
  };
  project?: {              // Only if createProject is true
    _id: string;
    handle: string;
    name: string;
    owner: string;
    githubRepo: {
      owner: string;
      repoName: string;
      fullName: string;
    };
  };
  generation: {
    brief: string;
    projectType: string;
    language: string;
    framework?: string;
    fileCount: number;
    generatedAt: string;
    prompt: string;
  };
  deployment?: {           // Only if triggerDeploy is true
    deploymentId?: string;
    deploymentUrl?: string;
    environment?: string;
    createdAt?: string;
  };
  deploymentError?: string; // If deployment failed
}
```

**Example Usage:**
```javascript
const result = await trpc.projects.createFromBrief.mutate({
  brief: "Create a React TypeScript app with authentication and user dashboard",
  newRepoName: "my-auth-app",
  repoOptions: {
    private: false,
    description: "Authentication app with user dashboard"
  },
  generationOptions: {
    projectType: "web",
    language: "typescript",
    framework: "react"
  },
  createProject: true,
  triggerDeploy: false
});
```

**AI Generation Examples:**

1. **Basic Web App**:
   - Brief: "Create a simple portfolio website"
   - Generates: HTML, CSS, JS files with basic structure

2. **React App**:
   - Brief: "Build a React app for task management"
   - Generates: React project with components, package.json, etc.

3. **API Server**:
   - Brief: "Create an Express API for a blog"
   - Generates: Express server with routes, middleware, config

4. **Next.js App**:
   - Brief: "Build a Next.js e-commerce site with TypeScript"
   - Generates: Next.js project with pages, components, TypeScript config

## Frontend Implementation Guide

### Prerequisites

1. User must be authenticated
2. User must have connected their GitHub account (have a GitHub token)

### Step 1: List Available Templates

Create a template selection UI that fetches and displays available templates:

```jsx
import { trpc } from '../utils/trpc';

function TemplateSelector({ onSelect }) {
  // Fetch Repo.md templates by default
  const { data, isLoading, error } = trpc.projects.listTemplates.useQuery();

  if (isLoading) return <div>Loading templates...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="template-grid">
      {data.templates.map(template => (
        <div key={template.id} className="template-card">
          <img src={template.image} alt={template.name} />
          <div className="template-content">
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            
            <div className="template-categories">
              {template.categories.map(cat => (
                <span key={cat} className="category-tag">{cat}</span>
              ))}
            </div>
            
            <div className="template-features">
              <h4>Features:</h4>
              <ul>
                {template.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              {template.features.length > 3 && (
                <p className="more-features">
                  +{template.features.length - 3} more features
                </p>
              )}
            </div>
            
            <div className="template-actions">
              <button onClick={() => onSelect(template)}>
                Use this template
              </button>
              <a href={template.demoUrl} target="_blank" rel="noopener">
                View Demo
              </a>
            </div>
          </div>
          
          <div className="template-stats">
            <span>⭐ {template.stars}</span>
            <span>by {template.author}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 2: Create Repository from Template

Implement a form to collect repository details and create from template:

```jsx
function CreateFromTemplate({ template }) {
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [triggerDeploy, setTriggerDeploy] = useState(false);
  
  const createMutation = trpc.projects.createFromTemplate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Redirect to project or show success message
        window.location.href = `/projects/${data.project.handle}`;
      }
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    createMutation.mutate({
      templateOwner: template.templateOwner,
      templateRepo: template.templateRepo,
      newRepoName: repoName,
      repoOptions: {
        private: isPrivate,
        description: description || template.description
      },
      createProject: true,
      triggerDeploy: triggerDeploy
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create from {template.name}</h2>
      
      <label>
        Repository Name:
        <input 
          type="text" 
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          required
          pattern="[a-zA-Z0-9-_]+"
        />
      </label>

      <label>
        Description:
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label>
        <input 
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private repository
      </label>

      <label>
        <input 
          type="checkbox"
          checked={triggerDeploy}
          onChange={(e) => setTriggerDeploy(e.target.checked)}
        />
        Deploy immediately after creation
      </label>

      <button 
        type="submit" 
        disabled={createMutation.isLoading}
      >
        {createMutation.isLoading ? 'Creating...' : 'Create Repository'}
      </button>
    </form>
  );
}
```

### Step 3: Create Repository from AI Brief

Implement a form to generate a project from a natural language description:

```jsx
function CreateFromBrief() {
  const [brief, setBrief] = useState('');
  const [repoName, setRepoName] = useState('');
  const [projectType, setProjectType] = useState('web');
  const [language, setLanguage] = useState('javascript');
  const [framework, setFramework] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const createMutation = trpc.projects.createFromBrief.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        window.location.href = `/projects/${data.project.handle}`;
      }
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    createMutation.mutate({
      brief,
      newRepoName: repoName,
      repoOptions: {
        private: isPrivate,
      },
      generationOptions: {
        projectType,
        language,
        framework: framework || undefined,
      },
      createProject: true,
      triggerDeploy: false
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Project from AI Brief</h2>
      
      <label>
        Describe your project:
        <textarea 
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="E.g., Create a React app with user authentication and a dashboard..."
          rows={4}
          required
          minLength={10}
        />
      </label>

      <label>
        Repository Name:
        <input 
          type="text" 
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          required
          pattern="[a-zA-Z0-9-_]+"
        />
      </label>

      <label>
        Project Type:
        <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
          <option value="web">Web Application</option>
          <option value="api">API Server</option>
          <option value="mobile">Mobile App</option>
          <option value="desktop">Desktop App</option>
        </select>
      </label>

      <label>
        Language:
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
        </select>
      </label>

      <label>
        Framework (optional):
        <input 
          type="text" 
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          placeholder="e.g., react, nextjs, express"
        />
      </label>

      <label>
        <input 
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private repository
      </label>

      <button 
        type="submit" 
        disabled={createMutation.isLoading}
      >
        {createMutation.isLoading ? 'Generating...' : 'Generate Project'}
      </button>

      {createMutation.isLoading && (
        <div className="generation-status">
          <p>🤖 AI is generating your project structure...</p>
          <p>This may take a few moments.</p>
        </div>
      )}
    </form>
  );
}
```

### Step 4: Complete Implementation

Combine all components into a complete workflow:

```jsx
function ProjectCreationWorkflow() {
  const [mode, setMode] = useState('templates'); // 'templates' or 'ai'
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  return (
    <div>
      <div className="mode-selector">
        <button 
          className={mode === 'templates' ? 'active' : ''}
          onClick={() => setMode('templates')}
        >
          Use Template
        </button>
        <button 
          className={mode === 'ai' ? 'active' : ''}
          onClick={() => setMode('ai')}
        >
          Generate with AI
        </button>
      </div>

      {mode === 'templates' ? (
        selectedTemplate ? (
          <CreateFromTemplate template={selectedTemplate} />
        ) : (
          <TemplateSelector onSelect={setSelectedTemplate} />
        )
      ) : (
        <CreateFromBrief />
      )}
    </div>
  );
}
```

## Error Handling

Common error scenarios to handle:

1. **No GitHub Token**: User hasn't connected their GitHub account
   - Show message: "Please connect your GitHub account to use templates"
   - Provide link to GitHub connection settings

2. **Template Not Found**: Template repository doesn't exist or isn't accessible
   - Show message: "Template not found or not accessible"

3. **Name Conflict**: Repository with the same name already exists
   - Show message: "A repository with this name already exists"
   - Suggest alternative names

4. **Permission Denied**: User doesn't have permission to create repositories
   - Show message: "You don't have permission to create repositories"

## Deployment Notes

When `triggerDeploy` is set to `true`, the system will:

1. Wait 500ms for GitHub to fully initialize the repository
2. Attempt to trigger a deployment using GitHub Deployments API
3. If that fails, fall back to repository dispatch events
4. Return deployment status in the response

The deployment process is asynchronous, so the API will return immediately with deployment info if successful, or an error message if the trigger failed.

## Webhooks

After repository creation, GitHub will send webhook events to your configured webhook endpoint. The new repository will be automatically processed if:

1. The user has webhook integration enabled
2. The webhook is properly configured in GitHub
3. The repository matches any configured filters

## Best Practices

1. **Template Organization**: Keep templates in a dedicated organization for easy management
2. **Template Naming**: Use descriptive names that indicate the template's purpose
3. **Documentation**: Include README files in templates with setup instructions
4. **Defaults**: Set sensible defaults in template repositories (workflows, configs, etc.)
5. **Validation**: Validate repository names on the frontend before submission
6. **Loading States**: Show clear loading indicators during repository creation
7. **Error Recovery**: Provide clear next steps when errors occur