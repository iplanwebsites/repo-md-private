export const NEW_PROJECT_SYSTEM_PROMPT = `You are a helpful project consultant for the Repo.md platform. Your role is to gather all necessary information to create a comprehensive project specification that can be used to generate a complete codebase.

Your conversation style should be:
- Professional yet friendly
- Asking clarifying questions when needed
- Providing suggestions based on best practices
- Ensuring all critical information is collected

INFORMATION TO GATHER:
1. Project Overview
   - Project name and purpose
   - Target audience
   - Core problem being solved
   
2. Technical Requirements
   - Preferred technology stack
   - Performance requirements
   - Scalability needs
   - Security considerations
   
3. Features & Functionality
   - Must-have features
   - Nice-to-have features
   - User workflows
   - Integration requirements
   
4. Design & UX
   - Design preferences (minimal, modern, corporate, etc.)
   - Brand colors or themes
   - Accessibility requirements
   
5. Infrastructure
   - Hosting preferences
   - Database requirements
   - Third-party services needed
   
6. Development Constraints
   - Timeline
   - Budget considerations
   - Team size and expertise

USE FUNCTION CALLING:
When you have gathered sufficient information, use the create_project_brief function to structure the requirements.`;

export const projectBriefTools = [
  {
    type: "function",
    function: {
      name: "create_project_brief",
      description: "Create a structured project brief from gathered requirements",
      parameters: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project"
          },
          projectType: {
            type: "string",
            enum: ["web-app", "api", "mobile-app", "cli-tool", "documentation", "static-site", "e-commerce", "saas", "other"],
            description: "The type of project"
          },
          description: {
            type: "string",
            description: "A comprehensive description of the project"
          },
          techStack: {
            type: "object",
            properties: {
              frontend: {
                type: "array",
                items: { type: "string" },
                description: "Frontend technologies (e.g., React, Vue, Angular)"
              },
              backend: {
                type: "array",
                items: { type: "string" },
                description: "Backend technologies (e.g., Node.js, Python, Go)"
              },
              database: {
                type: "array",
                items: { type: "string" },
                description: "Database technologies (e.g., PostgreSQL, MongoDB)"
              },
              infrastructure: {
                type: "array",
                items: { type: "string" },
                description: "Infrastructure and deployment (e.g., Docker, Kubernetes)"
              }
            }
          },
          features: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["must-have", "nice-to-have", "future"] }
              }
            },
            description: "List of features with priorities"
          },
          targetAudience: {
            type: "string",
            description: "Description of the target audience"
          },
          designPreferences: {
            type: "object",
            properties: {
              style: { type: "string" },
              colors: { type: "array", items: { type: "string" } },
              inspiration: { type: "array", items: { type: "string" } }
            }
          },
          constraints: {
            type: "object",
            properties: {
              timeline: { type: "string" },
              budget: { type: "string" },
              teamSize: { type: "number" },
              expertise: { type: "string" }
            }
          },
          integrations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                service: { type: "string" },
                purpose: { type: "string" },
                required: { type: "boolean" }
              }
            }
          },
          additionalNotes: {
            type: "string",
            description: "Any additional requirements or notes"
          }
        },
        required: ["projectName", "projectType", "description", "techStack", "features", "targetAudience"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_clarifying_question",
      description: "Ask a specific clarifying question to gather more information",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The clarifying question to ask"
          },
          context: {
            type: "string",
            description: "Why this information is important"
          },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "Suggested options or examples"
          }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "provide_recommendation",
      description: "Provide a recommendation based on the requirements gathered so far",
      parameters: {
        type: "object",
        properties: {
          area: {
            type: "string",
            description: "The area of recommendation (e.g., tech stack, architecture)"
          },
          recommendation: {
            type: "string",
            description: "The specific recommendation"
          },
          reasoning: {
            type: "string",
            description: "Why this recommendation makes sense"
          },
          alternatives: {
            type: "array",
            items: { type: "string" },
            description: "Alternative options to consider"
          }
        },
        required: ["area", "recommendation", "reasoning"]
      }
    }
  }
];

export const conversationStarters = [
  "Hi! I'm here to help you create a new project on Repo.md. What kind of project are you looking to build?",
  "Welcome! Let's create something amazing together. Can you tell me about the project you have in mind?",
  "Hello! I'll help you gather all the requirements for your new project. What's the main goal of what you want to build?",
  "Great to meet you! I'm here to help plan your project. What problem are you trying to solve?"
];

export function getConversationContext(conversationHistory) {
  return `Current conversation state:
- Messages exchanged: ${conversationHistory.length}
- Information gathered: ${JSON.stringify(extractGatheredInfo(conversationHistory), null, 2)}

Continue gathering information naturally. When you have enough information to create a comprehensive project, use the create_project_brief function.`;
}

function extractGatheredInfo(conversationHistory) {
  // Extract key information from conversation history
  // This is a simplified version - in production, you'd use more sophisticated NLP
  const info = {
    projectNameMentioned: false,
    techStackDiscussed: false,
    featuresListed: false,
    audienceIdentified: false
  };
  
  conversationHistory.forEach(msg => {
    const content = msg.content?.toLowerCase() || '';
    if (content.includes('project') || content.includes('app') || content.includes('website')) {
      info.projectNameMentioned = true;
    }
    if (content.includes('react') || content.includes('node') || content.includes('python')) {
      info.techStackDiscussed = true;
    }
    if (content.includes('feature') || content.includes('functionality')) {
      info.featuresListed = true;
    }
    if (content.includes('user') || content.includes('audience') || content.includes('customer')) {
      info.audienceIdentified = true;
    }
  });
  
  return info;
}