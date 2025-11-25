# LLM System Refactor Plan

## Current State Analysis

### What We Have
1. **Overcomplicated project generation** - Too many files, abstractions
2. **Legacy chat code** - elevenClient, patientMemory, fiche (appear to be from a medical/patient app)
3. **Multiple overlapping systems** - newProjectSystem, projectGenerationService, etc.
4. **Redundant abstractions** - ChatPlugin system might be overkill

### What We Need
1. **Simple LLM conversation API** - Just conversations with tool calling
2. **Lightweight project generation** - Just a composed LLM pattern, not a framework
3. **Direct GitHub integration** - Projects go straight to GitHub, no complex storage

## Proposed Architecture

### Core Components

#### 1. Simple Conversation Service (`/lib/llm/conversation.js`)
```javascript
// Basic conversation management
- startConversation(userId, type, context)
- sendMessage(conversationId, message, tools?)
- streamResponse(conversationId, message, tools?)
- getConversation(conversationId)
```

#### 2. Tool Definitions (`/lib/llm/tools/`)
```javascript
// Modular tool definitions
- fileTools.js (create, update, delete files)
- githubTools.js (create repo, commit, push)
- searchTools.js (search codebase, docs)
- analysisTools.js (analyze code, suggest improvements)
```

#### 3. Conversation Types (`/lib/llm/patterns/`)
```javascript
// Simple conversation patterns, not plugins
- projectGeneration.js (system prompt + file tools)
- codeEdit.js (system prompt + search/edit tools)
- codeReview.js (system prompt + analysis tools)
```

### API Routes (`/routes/llm.js`)
```
POST   /api/llm/conversations          - Start conversation
POST   /api/llm/conversations/:id/messages - Send message (streaming SSE)
GET    /api/llm/conversations/:id      - Get conversation
DELETE /api/llm/conversations/:id      - Delete conversation
POST   /api/llm/conversations/:id/github - Push to GitHub (for project gen)
```

## Migration Steps

### Step 1: Create Legacy Folder
Move to `/lib/legacy/`:
- elevenClient.js
- patientMemory.js
- fiche.js
- Old project generation files we're replacing

### Step 2: Build Core LLM Service
1. Simple conversation.js with OpenAI client
2. Basic tool execution framework
3. Streaming SSE support

### Step 3: Implement Patterns
1. Project generation = system prompt + file tools + GitHub push
2. Code editing = system prompt + search/edit tools
3. Keep it simple - just composed prompts and tools

### Step 4: Clean Routes
1. Single llm.js route file
2. Clean SSE streaming implementation
3. No complex middleware or abstractions

## Key Principles

1. **KISS** - Keep It Stupidly Simple
2. **Tools over Plugins** - Just functions the LLM can call
3. **Patterns over Frameworks** - Simple composed behaviors
4. **Direct Integration** - GitHub API, no intermediate storage
5. **Stateless where possible** - Conversations in DB, but minimal state

## What We're NOT Building

- ❌ Complex plugin architecture
- ❌ Abstract base classes
- ❌ Project storage system (use GitHub)
- ❌ Memory management system
- ❌ Multi-provider abstraction (just OpenAI)

## Expected Outcome

A clean, simple LLM conversation system where:
- Starting a project generation conversation is ~50 lines of code
- Adding a new tool is just exporting a function
- The entire system is understandable in 15 minutes
- No abstractions you need to learn