// Tool Execution Framework
// Handles tool execution, sub-agent spawning, and context management

import { AGENT_ARCHETYPES, SUB_AGENT_CONFIGS } from '../chat/aiPromptConfigs.js';

class ToolExecutor {
  constructor(options = {}) {
    this.context = options.context || {};
    this.logger = options.logger || console;
    this.executionHistory = [];
    this.activeSubAgents = new Map();
  }

  // Execute a tool with proper context and error handling
  async executeTool(tool, args, additionalContext = {}) {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    
    try {
      // Merge contexts
      const fullContext = {
        ...this.context,
        ...additionalContext,
        executionId,
        parentAgent: this.context.agentArchetype
      };
      
      // Log execution start
      this.logExecution({
        executionId,
        tool: tool.name,
        args,
        status: 'started',
        timestamp: startTime
      });
      
      // Execute the tool
      const result = await tool.implementation(args, fullContext);
      
      // Log execution complete
      this.logExecution({
        executionId,
        tool: tool.name,
        status: 'completed',
        duration: Date.now() - startTime,
        result: this.sanitizeResult(result)
      });
      
      return {
        success: true,
        result,
        executionId,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Log execution error
      this.logExecution({
        executionId,
        tool: tool.name,
        status: 'failed',
        error: error.message,
        duration: Date.now() - startTime
      });
      
      return {
        success: false,
        error: error.message,
        executionId,
        duration: Date.now() - startTime
      };
    }
  }

  // Execute multiple tools in parallel
  async executeToolsParallel(toolExecutions) {
    const promises = toolExecutions.map(({ tool, args, context }) => 
      this.executeTool(tool, args, context)
    );
    
    return Promise.all(promises);
  }

  // Execute tools in sequence with dependency handling
  async executeToolsSequential(toolExecutions) {
    const results = [];
    const sharedContext = {};
    
    for (const { tool, args, context, dependsOn } of toolExecutions) {
      // Check dependencies
      if (dependsOn) {
        const dependencyMet = this.checkDependency(dependsOn, results);
        if (!dependencyMet) {
          results.push({
            success: false,
            error: `Dependency not met: ${JSON.stringify(dependsOn)}`,
            tool: tool.name
          });
          continue;
        }
      }
      
      // Execute tool with accumulated context
      const result = await this.executeTool(tool, args, {
        ...context,
        ...sharedContext
      });
      
      results.push(result);
      
      // Update shared context if tool provides context updates
      if (result.success && result.result?.contextUpdate) {
        Object.assign(sharedContext, result.result.contextUpdate);
      }
    }
    
    return results;
  }

  // Spawn a sub-agent for specialized tasks
  async spawnSubAgent(archetype, task, parentContext = {}) {
    const agentId = this.generateAgentId();
    const agent = AGENT_ARCHETYPES[archetype];
    
    if (!agent) {
      throw new Error(`Unknown agent archetype: ${archetype}`);
    }
    
    // Create sub-agent context
    const subAgentContext = {
      ...parentContext,
      agentId,
      parentAgent: this.context.agentArchetype,
      parentAgentId: this.context.agentId,
      task,
      spawnedAt: Date.now()
    };
    
    // Initialize sub-agent
    const subAgent = {
      id: agentId,
      archetype,
      context: subAgentContext,
      status: 'active',
      startTime: Date.now(),
      results: []
    };
    
    this.activeSubAgents.set(agentId, subAgent);
    
    try {
      // Execute sub-agent task
      const result = await this.executeSubAgentTask(subAgent);
      
      // Update sub-agent status
      subAgent.status = 'completed';
      subAgent.endTime = Date.now();
      subAgent.result = result;
      
      return {
        agentId,
        success: true,
        result,
        duration: subAgent.endTime - subAgent.startTime
      };
    } catch (error) {
      // Update sub-agent status
      subAgent.status = 'failed';
      subAgent.endTime = Date.now();
      subAgent.error = error.message;
      
      return {
        agentId,
        success: false,
        error: error.message,
        duration: subAgent.endTime - subAgent.startTime
      };
    } finally {
      // Archive sub-agent
      this.archiveSubAgent(agentId);
    }
  }

  // Execute a workflow with multiple agents
  async executeWorkflow(workflowName, initialContext = {}) {
    const workflow = SUB_AGENT_CONFIGS[workflowName];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }
    
    const workflowId = this.generateWorkflowId();
    const workflowContext = {
      ...initialContext,
      workflowId,
      workflowName
    };
    
    const results = [];
    let currentContext = workflowContext;
    
    for (const step of workflow.workflow) {
      // Spawn agent for this step
      const agentResult = await this.spawnSubAgent(
        step.agent,
        step.purpose,
        currentContext
      );
      
      results.push({
        step: step.purpose,
        agent: step.agent,
        result: agentResult
      });
      
      // Check if we should continue to next step
      if (agentResult.success && step.handoff) {
        const shouldHandoff = this.evaluateHandoffCondition(
          step.handoff.condition,
          agentResult.result
        );
        
        if (shouldHandoff) {
          // Prepare context for next agent
          currentContext = this.prepareHandoffContext(
            currentContext,
            agentResult.result,
            step.handoff.context
          );
        } else {
          // Workflow interrupted
          break;
        }
      } else if (!agentResult.success) {
        // Workflow failed
        break;
      }
    }
    
    return {
      workflowId,
      workflowName,
      steps: results,
      success: results.every(r => r.result.success),
      duration: results.reduce((sum, r) => sum + r.result.duration, 0)
    };
  }

  // Tool orchestration for complex operations
  async orchestrateTools(operation) {
    const { strategy, tools, context } = operation;
    
    switch (strategy) {
      case 'parallel':
        return this.executeToolsParallel(tools.map(t => ({
          tool: t,
          args: operation.args[t.name] || {},
          context
        })));
        
      case 'sequential':
        return this.executeToolsSequential(tools.map((t, index) => ({
          tool: t,
          args: operation.args[t.name] || {},
          context,
          dependsOn: operation.dependencies?.[index]
        })));
        
      case 'conditional':
        return this.executeConditionalTools(operation);
        
      case 'iterative':
        return this.executeIterativeTools(operation);
        
      default:
        throw new Error(`Unknown orchestration strategy: ${strategy}`);
    }
  }

  // Execute tools conditionally based on previous results
  async executeConditionalTools(operation) {
    const results = [];
    const { conditions, tools, context } = operation;
    
    for (const condition of conditions) {
      const evaluation = await this.evaluateCondition(condition, results);
      
      if (evaluation.shouldExecute) {
        const tool = tools.find(t => t.name === condition.toolName);
        if (tool) {
          const result = await this.executeTool(
            tool,
            operation.args[tool.name] || {},
            { ...context, conditionMet: condition.name }
          );
          results.push(result);
          
          if (condition.breakOnSuccess && result.success) {
            break;
          }
        }
      }
    }
    
    return results;
  }

  // Execute tools iteratively until a condition is met
  async executeIterativeTools(operation) {
    const results = [];
    const { tool, args, context, maxIterations = 10, stopCondition } = operation;
    
    for (let i = 0; i < maxIterations; i++) {
      const iterationContext = {
        ...context,
        iteration: i,
        previousResults: results
      };
      
      const result = await this.executeTool(tool, args, iterationContext);
      results.push(result);
      
      if (this.evaluateStopCondition(stopCondition, result, results)) {
        break;
      }
    }
    
    return results;
  }

  // Helper methods
  
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateAgentId() {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  logExecution(entry) {
    this.executionHistory.push(entry);
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500);
    }
  }
  
  sanitizeResult(result) {
    // Remove sensitive data from results before logging
    if (typeof result === 'object' && result !== null) {
      const sanitized = { ...result };
      const sensitiveKeys = ['token', 'password', 'secret', 'key', 'auth'];
      
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        }
      }
      
      return sanitized;
    }
    return result;
  }
  
  checkDependency(dependsOn, results) {
    if (typeof dependsOn === 'string') {
      // Simple dependency: check if a tool succeeded
      return results.some(r => r.tool === dependsOn && r.success);
    } else if (typeof dependsOn === 'object') {
      // Complex dependency with conditions
      const { tool, condition } = dependsOn;
      const toolResult = results.find(r => r.tool === tool);
      return toolResult && this.evaluateCondition(condition, toolResult);
    }
    return true;
  }
  
  evaluateHandoffCondition(condition, result) {
    // Evaluate if handoff should occur
    switch (condition) {
      case 'requirements_clear':
        return result.requirementsClarified === true;
      case 'code_generated':
        return result.filesGenerated && result.filesGenerated.length > 0;
      case 'improvements_identified':
        return result.improvements && result.improvements.length > 0;
      case 'validation_passed':
        return result.validationPassed === true;
      default:
        return true;
    }
  }
  
  prepareHandoffContext(currentContext, agentResult, contextKeys) {
    const handoffContext = { ...currentContext };
    
    // Extract specified context keys from agent result
    for (const key of contextKeys) {
      if (agentResult[key] !== undefined) {
        handoffContext[key] = agentResult[key];
      }
    }
    
    // Add handoff metadata
    handoffContext.handoffFrom = currentContext.agentId;
    handoffContext.handoffAt = Date.now();
    
    return handoffContext;
  }
  
  evaluateCondition(condition, context) {
    // Evaluate complex conditions
    if (typeof condition === 'function') {
      return condition(context);
    } else if (typeof condition === 'object') {
      // Evaluate object-based conditions
      const { field, operator, value } = condition;
      const fieldValue = this.getNestedValue(context, field);
      
      switch (operator) {
        case 'equals':
          return fieldValue === value;
        case 'contains':
          return fieldValue?.includes?.(value);
        case 'greater':
          return fieldValue > value;
        case 'exists':
          return fieldValue !== undefined;
        default:
          return false;
      }
    }
    return !!condition;
  }
  
  evaluateStopCondition(condition, currentResult, allResults) {
    if (typeof condition === 'function') {
      return condition(currentResult, allResults);
    } else if (condition === 'success') {
      return currentResult.success;
    } else if (condition === 'failure') {
      return !currentResult.success;
    }
    return false;
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  async executeSubAgentTask(subAgent) {
    // This would integrate with the conversation system
    // For now, return a placeholder
    return {
      completed: true,
      message: `Sub-agent ${subAgent.archetype} completed task: ${subAgent.context.task}`
    };
  }
  
  archiveSubAgent(agentId) {
    const agent = this.activeSubAgents.get(agentId);
    if (agent) {
      agent.archivedAt = Date.now();
      this.activeSubAgents.delete(agentId);
    }
  }
  
  // Get execution history for debugging
  getExecutionHistory(filter = {}) {
    let history = [...this.executionHistory];
    
    if (filter.tool) {
      history = history.filter(h => h.tool === filter.tool);
    }
    if (filter.status) {
      history = history.filter(h => h.status === filter.status);
    }
    if (filter.since) {
      history = history.filter(h => h.timestamp >= filter.since);
    }
    
    return history;
  }
  
  // Get active sub-agents
  getActiveSubAgents() {
    return Array.from(this.activeSubAgents.values());
  }
}

export default ToolExecutor;