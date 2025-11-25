# Create Repo from Prompt - Frontend Integration Guide

Generate complete repositories from natural language descriptions using AI.

## API Endpoint

**Endpoint:** `trpc.projects.createRepoFromPrompt.mutate()`

**Input:**
```typescript
{
  prompt: string;                   // User description (min 5 chars)
  newRepoName: string;             // Repository name  
  orgId?: string;                  // Optional org ID
  repoOptions?: {
    private?: boolean;             // Default: false
    description?: string;
  };
  agentOptions?: {
    simulate?: boolean;            // Test mode, default: false
  };
}
```

## Frontend Integration

### Basic Usage
```tsx
const createRepoMutation = trpc.projects.createRepoFromPrompt.useMutation();

const handleSubmit = async (prompt: string, repoName: string) => {
  await createRepoMutation.mutateAsync({
    prompt,
    newRepoName: repoName,
    repoOptions: { private: false }
  });
};
```

### Form Component
```tsx
export function CreateRepoFromPrompt({ onSuccess }: { onSuccess?: (result: any) => void }) {
  const [prompt, setPrompt] = useState('');
  const [repoName, setRepoName] = useState('');
  
  const createRepoMutation = trpc.projects.createRepoFromPrompt.useMutation({
    onSuccess,
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createRepoMutation.mutate({ prompt, newRepoName: repoName });
    }}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Create a React todo app with TypeScript and Tailwind CSS"
        required
        minLength={5}
      />
      <input
        value={repoName}
        onChange={(e) => setRepoName(e.target.value)}
        placeholder="my-todo-app"
        required
      />
      <button disabled={createRepoMutation.isLoading}>
        {createRepoMutation.isLoading ? 'Creating...' : 'Generate Repository'}
      </button>
    </form>
  );
}
```

### Add to Project Creation Flow
```tsx
// Add as new tab in create project page
<button onClick={() => setTab('ai-generate')}>
  🤖 Generate with AI
</button>

{tab === 'ai-generate' && (
  <CreateRepoFromPrompt
    onSuccess={(result) => {
      console.log('Repository created:', result.repository.url);
      // Redirect to project or show success
    }}
  />
)}
```

## Test Mode
Use `agentOptions: { simulate: true }` to test without creating actual repositories.

## Mock Mode
When OpenAI API key is not configured, the system automatically uses mock AI generation that:
- Detects project type from keywords (React, Vue, Node.js, Python, etc.)
- Generates appropriate file structures and boilerplate code
- Works without external API dependencies for development/testing

## Example Prompts
- "Create a React todo app with TypeScript and Tailwind CSS"
- "Build a Node.js REST API for a blog with MongoDB"  
- "Make a Python CLI tool that processes CSV files"
- "Create a simple Vue.js dashboard"