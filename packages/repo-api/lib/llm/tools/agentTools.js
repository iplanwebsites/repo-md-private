// Agent Management Tools
// Tools for spawning and managing sub-agents

const spawnSpecialistAgent = {
  definition: {
    name: 'spawnSpecialistAgent',
    description: 'Spawn a specialized agent for a specific task',
    parameters: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          description: 'Type of specialist agent to spawn',
          enum: ['CODE_GENERATOR', 'CODE_REVIEWER', 'DEPLOYMENT_MANAGER', 'PUBLIC_ASSISTANT']
        },
        task: {
          type: 'string',
          description: 'The specific task for the agent'
        },
        context: {
          type: 'object',
          description: 'Additional context to pass to the agent'
        },
        returnTo: {
          type: 'string',
          description: 'How to return results (callback, wait, async)',
          enum: ['callback', 'wait', 'async']
        }
      },
      required: ['agentType', 'task']
    }
  },
  implementation: async (args, context) => {
    const { agentType, task, context: taskContext, returnTo = 'wait' } = args;
    const { toolExecutor, session } = context;
    
    try {
      if (!toolExecutor) {
        throw new Error('Tool executor not available');
      }
      
      // Merge contexts
      const agentContext = {
        ...context,
        ...taskContext,
        parentSession: session?.id,
        task
      };
      
      if (returnTo === 'wait') {
        // Synchronous execution - wait for result
        const result = await toolExecutor.spawnSubAgent(agentType, task, agentContext);
        
        return {
          success: true,
          agentId: result.agentId,
          result: result.result,
          duration: result.duration
        };
      } else if (returnTo === 'async') {
        // Asynchronous execution - return immediately
        const agentId = toolExecutor.generateAgentId();
        
        // Schedule async execution
        setImmediate(async () => {
          try {
            await toolExecutor.spawnSubAgent(agentType, task, agentContext);
          } catch (error) {
            console.error(`Async agent execution failed: ${error.message}`);
          }
        });
        
        return {
          success: true,
          agentId,
          message: 'Agent spawned asynchronously',
          status: 'running'
        };
      } else if (returnTo === 'callback') {
        // Callback-based execution
        if (!taskContext.callbackUrl) {
          throw new Error('Callback URL required for callback mode');
        }
        
        // TODO: Implement callback mechanism
        return {
          success: false,
          error: 'Callback mode not yet implemented'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['toolExecutor', 'session'],
  costEstimate: 'medium'
};

const delegateTask = {
  definition: {
    name: 'delegateTask',
    description: 'Delegate a task to the most appropriate agent',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Description of the task to delegate'
        },
        requirements: {
          type: 'object',
          description: 'Specific requirements or constraints'
        },
        priority: {
          type: 'string',
          description: 'Task priority',
          enum: ['low', 'medium', 'high', 'urgent']
        }
      },
      required: ['task']
    }
  },
  implementation: async (args, context) => {
    const { task, requirements, priority = 'medium' } = args;
    const { toolExecutor } = context;
    
    try {
      // Analyze task to determine best agent
      const taskAnalysis = analyzeTask(task, requirements);
      const recommendedAgent = taskAnalysis.recommendedAgent;
      
      if (!recommendedAgent) {
        throw new Error('Could not determine appropriate agent for task');
      }
      
      // Prepare task context
      const taskContext = {
        requirements,
        priority,
        analysis: taskAnalysis
      };
      
      // Spawn the recommended agent
      const result = await toolExecutor.spawnSubAgent(
        recommendedAgent,
        task,
        taskContext
      );
      
      return {
        success: true,
        delegatedTo: recommendedAgent,
        agentId: result.agentId,
        result: result.result,
        taskAnalysis
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['toolExecutor'],
  costEstimate: 'medium'
};

const coordinateAgents = {
  definition: {
    name: 'coordinateAgents',
    description: 'Coordinate multiple agents to work on a complex task',
    parameters: {
      type: 'object',
      properties: {
        workflow: {
          type: 'string',
          description: 'Predefined workflow name or custom workflow',
          enum: ['clarify_then_execute', 'review_and_improve', 'deploy_with_validation', 'custom']
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agent: { type: 'string' },
              task: { type: 'string' },
              dependsOn: { type: 'string' }
            }
          },
          description: 'Custom workflow tasks (if workflow is custom)'
        },
        context: {
          type: 'object',
          description: 'Shared context for all agents'
        }
      },
      required: ['workflow']
    }
  },
  implementation: async (args, context) => {
    const { workflow, tasks, context: sharedContext } = args;
    const { toolExecutor } = context;
    
    try {
      if (workflow === 'custom' && (!tasks || tasks.length === 0)) {
        throw new Error('Tasks required for custom workflow');
      }
      
      const workflowContext = {
        ...context,
        ...sharedContext
      };
      
      if (workflow !== 'custom') {
        // Execute predefined workflow
        const result = await toolExecutor.executeWorkflow(workflow, workflowContext);
        
        return {
          success: result.success,
          workflowId: result.workflowId,
          steps: result.steps,
          totalDuration: result.duration
        };
      } else {
        // Execute custom workflow
        const results = [];
        const agentResults = new Map();
        
        for (const task of tasks) {
          // Check dependencies
          if (task.dependsOn && !agentResults.has(task.dependsOn)) {
            results.push({
              agent: task.agent,
              task: task.task,
              success: false,
              error: `Dependency not met: ${task.dependsOn}`
            });
            continue;
          }
          
          // Get dependency result if exists
          const dependencyContext = task.dependsOn ? 
            { dependencyResult: agentResults.get(task.dependsOn) } : {};
          
          // Spawn agent
          const result = await toolExecutor.spawnSubAgent(
            task.agent,
            task.task,
            { ...workflowContext, ...dependencyContext }
          );
          
          results.push({
            agent: task.agent,
            task: task.task,
            success: result.success,
            result: result.result,
            duration: result.duration
          });
          
          // Store result for dependencies
          agentResults.set(task.agent, result.result);
        }
        
        return {
          success: results.every(r => r.success),
          workflow: 'custom',
          results,
          totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['toolExecutor'],
  costEstimate: 'high'
};

const getAgentStatus = {
  definition: {
    name: 'getAgentStatus',
    description: 'Get the status of active agents',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Specific agent ID to check (optional)'
        },
        includeHistory: {
          type: 'boolean',
          description: 'Include execution history'
        }
      }
    }
  },
  implementation: async (args, context) => {
    const { agentId, includeHistory = false } = args;
    const { toolExecutor } = context;
    
    try {
      const activeAgents = toolExecutor.getActiveSubAgents();
      
      if (agentId) {
        // Get specific agent
        const agent = activeAgents.find(a => a.id === agentId);
        
        if (!agent) {
          return {
            success: false,
            error: 'Agent not found or no longer active'
          };
        }
        
        return {
          success: true,
          agent: {
            id: agent.id,
            archetype: agent.archetype,
            status: agent.status,
            startTime: agent.startTime,
            task: agent.context.task,
            duration: Date.now() - agent.startTime
          }
        };
      } else {
        // Get all active agents
        const agents = activeAgents.map(agent => ({
          id: agent.id,
          archetype: agent.archetype,
          status: agent.status,
          startTime: agent.startTime,
          task: agent.context.task,
          duration: Date.now() - agent.startTime
        }));
        
        const response = {
          success: true,
          activeAgents: agents,
          count: agents.length
        };
        
        if (includeHistory) {
          response.executionHistory = toolExecutor.getExecutionHistory({
            since: Date.now() - 3600000 // Last hour
          });
        }
        
        return response;
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  requiredContext: ['toolExecutor'],
  costEstimate: 'low'
};

// Helper function to analyze task and recommend agent
function analyzeTask(task, requirements) {
  const taskLower = task.toLowerCase();
  
  // Simple keyword-based analysis (can be enhanced with NLP)
  if (taskLower.includes('generate') || taskLower.includes('create') || 
      taskLower.includes('implement') || taskLower.includes('build')) {
    return {
      recommendedAgent: 'CODE_GENERATOR',
      confidence: 0.8,
      reasoning: 'Task involves code generation or creation'
    };
  }
  
  if (taskLower.includes('review') || taskLower.includes('analyze') || 
      taskLower.includes('check') || taskLower.includes('audit')) {
    return {
      recommendedAgent: 'CODE_REVIEWER',
      confidence: 0.8,
      reasoning: 'Task involves code review or analysis'
    };
  }
  
  if (taskLower.includes('deploy') || taskLower.includes('release') || 
      taskLower.includes('publish')) {
    return {
      recommendedAgent: 'DEPLOYMENT_MANAGER',
      confidence: 0.9,
      reasoning: 'Task involves deployment or release'
    };
  }
  
  // Default to generalist
  return {
    recommendedAgent: 'GENERALIST',
    confidence: 0.5,
    reasoning: 'Task requires general assistance or clarification'
  };
}

export {
  spawnSpecialistAgent,
  delegateTask,
  coordinateAgents,
  getAgentStatus
};