# Method Descriptions API Guide

This guide explains how to load and use method descriptions from the RepoMD library, allowing other projects to dynamically discover available methods, their parameters, and documentation.

## Overview

The RepoMD library provides a comprehensive method description system built on top of Zod schemas. This allows external projects to:

- Discover all available methods and their categories
- Get detailed descriptions for methods and parameters
- Understand parameter types, defaults, and requirements
- Build dynamic UIs or documentation systems

## Installation

```bash
npm install repo-md-js-sdk
```

## Basic Usage

### Getting All Method Descriptions

```javascript
import { getAllMethodDescriptions } from 'repo-md-js-sdk';

// Get all method descriptions
const allMethods = getAllMethodDescriptions();

console.log(`Found ${Object.keys(allMethods).length} methods`);

// Example method structure:
// {
//   "getAllPosts": {
//     "name": "getAllPosts",
//     "description": "Retrieve all blog posts from the repository with metadata and content",
//     "category": "Posts",
//     "parameters": [
//       {
//         "name": "useCache",
//         "type": "boolean",
//         "required": false,
//         "default": true,
//         "description": "Use cached data if available to improve performance"
//       }
//     ]
//   }
// }
```

### Getting Methods by Category

```javascript
import { getMethodsByCategory, getAllMethodDescriptions } from 'repo-md-js-sdk';

// Get all available categories
const allMethods = getAllMethodDescriptions();
const categories = [...new Set(Object.values(allMethods).map(m => m.category))];
console.log('Categories:', categories);
// Output: ['Posts', 'Media', 'Files', 'Project', 'URLs', 'Similarity', 'API', 'OpenAI', 'Utility']

// Get methods for a specific category
const postMethods = getMethodsByCategory('Posts');
console.log(`Posts category has ${Object.keys(postMethods).length} methods`);

Object.entries(postMethods).forEach(([name, info]) => {
  console.log(`${name}: ${info.description}`);
});
```

### Getting Individual Method Description

```javascript
import { getMethodDescription } from 'repo-md-js-sdk';

// Get description for a specific method
const methodInfo = getMethodDescription('getAllPosts');

if (methodInfo) {
  console.log(`Method: ${methodInfo.name}`);
  console.log(`Description: ${methodInfo.description}`);
  console.log(`Category: ${methodInfo.category}`);
  console.log(`Parameters: ${methodInfo.parameters.length}`);
  
  methodInfo.parameters.forEach(param => {
    const req = param.required ? 'required' : 'optional';
    const defaultText = param.default !== undefined ? ` (default: ${param.default})` : '';
    console.log(`  • ${param.name} (${param.type}, ${req})${defaultText}: ${param.description}`);
  });
}
```

## Building Dynamic UIs

### Method Browser Component

```javascript
import { getAllMethodDescriptions, getMethodsByCategory } from 'repo-md-js-sdk';

function MethodBrowser() {
  const allMethods = getAllMethodDescriptions();
  const categories = [...new Set(Object.values(allMethods).map(m => m.category))];

  return (
    <div className="method-browser">
      {categories.map(category => {
        const methods = getMethodsByCategory(category);
        return (
          <div key={category} className="category-section">
            <h3>{category}</h3>
            {Object.entries(methods).map(([name, info]) => (
              <div key={name} className="method-item">
                <h4>{name}</h4>
                <p>{info.description}</p>
                <div className="parameters">
                  {info.parameters.map(param => (
                    <span key={param.name} className={`param ${param.required ? 'required' : 'optional'}`}>
                      {param.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

### Dynamic Method Caller

```javascript
import { RepoMD, getMethodDescription, validateFunctionParams } from 'repo-md-js-sdk';

class DynamicMethodCaller {
  constructor(repoMdConfig) {
    this.repo = new RepoMD(repoMdConfig);
  }

  async callMethod(methodName, parameters = {}) {
    // Get method description for validation
    const methodInfo = getMethodDescription(methodName);
    if (!methodInfo) {
      throw new Error(`Unknown method: ${methodName}`);
    }

    // Validate parameters using the schema system
    const validation = validateFunctionParams(methodName, parameters);
    if (!validation.success) {
      throw new Error(`Parameter validation failed: ${validation.error}`);
    }

    // Check if method exists on RepoMD instance
    if (typeof this.repo[methodName] !== 'function') {
      throw new Error(`Method ${methodName} is not callable`);
    }

    try {
      // Call the method with validated parameters
      const result = await this.repo[methodName](...this.convertParamsToArgs(methodInfo, validation.data));
      return {
        success: true,
        data: result,
        methodInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        methodInfo
      };
    }
  }

  convertParamsToArgs(methodInfo, validatedParams) {
    // Convert parameter object to positional arguments based on schema order
    return methodInfo.parameters.map(param => validatedParams[param.name]);
  }
}

// Usage
const caller = new DynamicMethodCaller({
  projectId: 'your-project-id',
  orgSlug: 'your-org'
});

const result = await caller.callMethod('getAllPosts', { useCache: true });
if (result.success) {
  console.log('Posts:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## Documentation Generation

### Generate API Documentation

```javascript
import { getAllMethodDescriptions } from 'repo-md-js-sdk';

function generateMarkdownDocs() {
  const allMethods = getAllMethodDescriptions();
  const categories = [...new Set(Object.values(allMethods).map(m => m.category))];
  
  let markdown = '# RepoMD API Documentation\\n\\n';
  
  categories.forEach(category => {
    markdown += `## ${category}\\n\\n`;
    
    Object.entries(allMethods)
      .filter(([_, info]) => info.category === category)
      .forEach(([name, info]) => {
        markdown += `### ${name}\\n\\n`;
        markdown += `${info.description}\\n\\n`;
        
        if (info.parameters.length > 0) {
          markdown += '**Parameters:**\\n\\n';
          info.parameters.forEach(param => {
            const req = param.required ? '(required)' : '(optional)';
            const defaultText = param.default !== undefined ? ` - Default: \`${param.default}\`` : '';
            markdown += `- \`${param.name}\` _(${param.type})_ ${req}${defaultText}\\n`;
            if (param.description) {
              markdown += `  ${param.description}\\n`;
            }
          });
          markdown += '\\n';
        }
        
        markdown += '---\\n\\n';
      });
  });
  
  return markdown;
}

// Generate and save documentation
const docs = generateMarkdownDocs();
console.log(docs);
```

## Advanced Usage

### Type-Safe Method Calling with TypeScript

```typescript
import { 
  RepoMD, 
  getMethodDescription, 
  validateFunctionParams,
  type schemas 
} from 'repo-md-js-sdk';

type MethodName = keyof typeof schemas;
type MethodResult<T extends MethodName> = T extends 'getAllPosts' 
  ? Array<any> 
  : T extends 'getPostBySlug' 
  ? any | null 
  : any;

class TypeSafeMethodCaller {
  private repo: RepoMD;

  constructor(config: any) {
    this.repo = new RepoMD(config);
  }

  async call<T extends MethodName>(
    methodName: T, 
    params: Record<string, any> = {}
  ): Promise<MethodResult<T>> {
    const methodInfo = getMethodDescription(methodName);
    if (!methodInfo) {
      throw new Error(`Unknown method: ${methodName}`);
    }

    const validation = validateFunctionParams(methodName, params);
    if (!validation.success) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    return await (this.repo as any)[methodName](...Object.values(validation.data));
  }
}
```

### Creating Interactive API Explorers

```javascript
import { getAllMethodDescriptions, RepoMD } from 'repo-md-js-sdk';

class APIExplorer {
  constructor(containerElement, repoConfig) {
    this.container = containerElement;
    this.repo = new RepoMD(repoConfig);
    this.methods = getAllMethodDescriptions();
    this.render();
  }

  render() {
    const categories = [...new Set(Object.values(this.methods).map(m => m.category))];
    
    this.container.innerHTML = `
      <div class="api-explorer">
        <div class="sidebar">
          ${categories.map(cat => `
            <div class="category" data-category="${cat}">
              <h3>${cat}</h3>
              ${Object.entries(this.methods)
                .filter(([_, info]) => info.category === cat)
                .map(([name, info]) => `
                  <div class="method-item" data-method="${name}">
                    <div class="method-name">${name}</div>
                    <div class="method-desc">${info.description}</div>
                  </div>
                `).join('')}
            </div>
          `).join('')}
        </div>
        <div class="main-content">
          <div id="method-details">Select a method to see details</div>
          <div id="method-tester">
            <h3>Try it out</h3>
            <div id="parameter-inputs"></div>
            <button id="execute-btn">Execute</button>
            <div id="results"></div>
          </div>
        </div>
      </div>
    `;

    this.attachEventHandlers();
  }

  attachEventHandlers() {
    // Handle method selection
    this.container.querySelectorAll('.method-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const methodName = e.currentTarget.dataset.method;
        this.showMethodDetails(methodName);
      });
    });

    // Handle method execution
    this.container.querySelector('#execute-btn').addEventListener('click', () => {
      this.executeSelectedMethod();
    });
  }

  showMethodDetails(methodName) {
    const method = this.methods[methodName];
    const detailsDiv = this.container.querySelector('#method-details');
    
    detailsDiv.innerHTML = `
      <h2>${methodName}</h2>
      <p>${method.description}</p>
      <h3>Parameters</h3>
      ${method.parameters.map(param => `
        <div class="parameter">
          <strong>${param.name}</strong> (${param.type}) 
          ${param.required ? '<span class="required">*required</span>' : '<span class="optional">optional</span>'}
          ${param.default !== undefined ? `<span class="default">default: ${param.default}</span>` : ''}
          <p>${param.description}</p>
        </div>
      `).join('')}
    `;

    this.generateParameterInputs(method);
    this.selectedMethod = methodName;
  }

  generateParameterInputs(method) {
    const inputsDiv = this.container.querySelector('#parameter-inputs');
    
    inputsDiv.innerHTML = method.parameters.map(param => `
      <div class="param-input">
        <label for="${param.name}">${param.name}</label>
        <input 
          type="${param.type === 'number' ? 'number' : 'text'}" 
          id="${param.name}" 
          name="${param.name}"
          placeholder="${param.default !== undefined ? param.default : ''}"
          ${param.required ? 'required' : ''}
        />
        <small>${param.description}</small>
      </div>
    `).join('');
  }

  async executeSelectedMethod() {
    if (!this.selectedMethod) return;

    const inputs = this.container.querySelectorAll('#parameter-inputs input');
    const params = {};
    
    inputs.forEach(input => {
      if (input.value) {
        params[input.name] = input.type === 'number' ? Number(input.value) : input.value;
      }
    });

    const resultsDiv = this.container.querySelector('#results');
    resultsDiv.innerHTML = '<div class="loading">Executing...</div>';

    try {
      const result = await this.repo[this.selectedMethod](...Object.values(params));
      resultsDiv.innerHTML = `
        <h3>Results</h3>
        <pre>${JSON.stringify(result, null, 2)}</pre>
      `;
    } catch (error) {
      resultsDiv.innerHTML = `
        <h3>Error</h3>
        <pre class="error">${error.message}</pre>
      `;
    }
  }
}

// Usage
const explorer = new APIExplorer(
  document.getElementById('api-explorer'),
  { projectId: 'your-project', orgSlug: 'your-org' }
);
```

## Available Method Categories

| Category | Description | Example Methods |
|----------|-------------|-----------------|
| **Posts** | Blog post and content management | `getAllPosts`, `getPostBySlug`, `getRecentPosts` |
| **Media** | Media file handling and optimization | `getAllMedia`, `getR2MediaUrl`, `getMediaItems` |
| **Files** | Repository file access and management | `getFileContent`, `getSourceFilesList`, `getGraph` |
| **Similarity** | AI-powered content similarity analysis | `getSimilarPostsBySlug`, `getPostsSimilarity` |
| **URLs** | URL generation and repository access | `getR2Url`, `createViteProxy`, `getSqliteUrl` |
| **API** | Low-level API and data fetching | `fetchProjectDetails`, `fetchJson`, `getActiveProjectRev` |
| **OpenAI** | AI integration and function calling | `handleOpenAiRequest`, `createOpenAiToolHandler` |
| **Project** | Project metadata and configuration | `getProjectMetadata`, `getReleaseInfo` |
| **Utility** | Helper methods and instance management | `getClientStats`, `destroy`, `sortPostsByDate` |

## Best Practices

1. **Always validate parameters** using `validateFunctionParams` before calling methods
2. **Use method descriptions** to build user-friendly interfaces
3. **Group methods by category** for better organization
4. **Handle errors gracefully** when calling methods dynamically
5. **Cache method descriptions** to avoid repeated processing
6. **Use TypeScript** for better type safety when possible

## Error Handling

```javascript
import { getMethodDescription, validateFunctionParams } from 'repo-md-js-sdk';

function safeMethodCall(repo, methodName, params) {
  try {
    // Check if method exists
    const methodInfo = getMethodDescription(methodName);
    if (!methodInfo) {
      return { error: `Unknown method: ${methodName}` };
    }

    // Validate parameters
    const validation = validateFunctionParams(methodName, params);
    if (!validation.success) {
      return { error: `Invalid parameters: ${validation.error}` };
    }

    // Check if method is callable
    if (typeof repo[methodName] !== 'function') {
      return { error: `Method ${methodName} is not callable` };
    }

    // Execute method
    const result = repo[methodName](...Object.values(validation.data));
    return { success: true, data: result, methodInfo };

  } catch (error) {
    return { error: error.message };
  }
}
```

This API allows you to build powerful, dynamic applications that can discover and interact with RepoMD methods at runtime, creating flexible documentation systems, API explorers, and integration tools.