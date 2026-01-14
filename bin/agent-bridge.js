// Agent Bridge for OpenCode Integration
// Coordinates between GSD's subagent system and OpenCode's agentic capabilities

const fs = require('fs');
const path = require('path');

class AgentBridge {
  constructor(opencodeAPI = null) {
    this.opencodeAPI = opencodeAPI;
    this.activeAgents = new Map();
    this.taskDelegationRules = this.loadTaskDelegationRules();
  }

  loadTaskDelegationRules() {
    // Define which tasks can be delegated to OpenCode agents
    return {
      'code-generation': {
        patterns: ['create', 'generate', 'implement', 'add'],
        agent: 'codegen',
        priority: 'high'
      },
      'debugging': {
        patterns: ['fix', 'debug', 'resolve', 'troubleshoot'],
        agent: 'debugger',
        priority: 'high'
      },
      'testing': {
        patterns: ['test', 'spec', 'assert', 'verify'],
        agent: 'tester',
        priority: 'medium'
      },
      'documentation': {
        patterns: ['document', 'comment', 'readme', 'doc', 'update'],
        agent: 'documentor',
        priority: 'low'
      },
      'analysis': {
        patterns: ['analyze', 'review', 'assess', 'evaluate'],
        agent: 'analyzer',
        priority: 'medium'
      }
    };
  }

  async spawnSubagent(task) {
    // Check if OpenCode can handle this task natively
    if (this.canDelegateToOpenCode(task)) {
      return this.delegateToOpenCodeAgent(task);
    }

    // Fall back to GSD's subagent system
    return this.spawnGSDSubagent(task);
  }

  canDelegateToOpenCode(task) {
    if (!this.opencodeAPI) {
      return false;
    }

    const taskType = this.classifyTask(task);
    const rule = this.taskDelegationRules[taskType];

    return rule && rule.priority === 'high';
  }

  classifyTask(task) {
    const taskText = task.toLowerCase();

    for (const [type, rule] of Object.entries(this.taskDelegationRules)) {
      for (const pattern of rule.patterns) {
        if (taskText.includes(pattern)) {
          return type;
        }
      }
    }

    return 'general';
  }

  async delegateToOpenCodeAgent(task) {
    const taskType = this.classifyTask(task);
    const rule = this.taskDelegationRules[taskType];

    if (!rule) {
      throw new Error(`No delegation rule for task type: ${taskType}`);
    }

    console.log(`Delegating task to OpenCode ${rule.agent} agent: ${task}`);

    // Placeholder for actual OpenCode API integration
    // In a real implementation, this would call the OpenCode agent API
    const agentId = `opencode-${rule.agent}-${Date.now()}`;

    this.activeAgents.set(agentId, {
      type: 'opencode',
      agent: rule.agent,
      task: task,
      status: 'running',
      startTime: Date.now()
    });

    // Simulate agent execution (replace with real API call)
    setTimeout(() => {
      this.activeAgents.set(agentId, {
        ...this.activeAgents.get(agentId),
        status: 'completed',
        endTime: Date.now()
      });
    }, 2000); // Simulate 2-second execution

    return {
      agentId,
      delegated: true,
      agentType: rule.agent,
      estimatedDuration: this.estimateTaskDuration(task, rule)
    };
  }

  async spawnGSDSubagent(task) {
    console.log(`Spawning GSD subagent for task: ${task}`);

    // Placeholder for GSD subagent spawning
    // This would integrate with the existing GSD subagent system
    const agentId = `gsd-${Date.now()}`;

    this.activeAgents.set(agentId, {
      type: 'gsd',
      task: task,
      status: 'running',
      startTime: Date.now()
    });

    return {
      agentId,
      delegated: false,
      agentType: 'gsd',
      estimatedDuration: 30000 // 30 seconds default
    };
  }

  estimateTaskDuration(task, rule) {
    // Simple estimation based on task complexity
    const taskLength = task.length;
    const baseDuration = rule.priority === 'high' ? 5000 : 10000;

    return Math.min(baseDuration + (taskLength * 10), 30000); // Max 30 seconds
  }

  getAgentStatus(agentId) {
    return this.activeAgents.get(agentId) || null;
  }

  getAllAgentStatuses() {
    return Array.from(this.activeAgents.entries()).map(([id, status]) => ({
      id,
      ...status
    }));
  }

  cleanupCompletedAgents() {
    for (const [id, agent] of this.activeAgents) {
      if (agent.status === 'completed' && agent.endTime) {
        const age = Date.now() - agent.endTime;
        if (age > 300000) { // 5 minutes
          this.activeAgents.delete(id);
        }
      }
    }
  }

  // Integration with GSD workflow system
  async executeParallelTasks(tasks) {
    const results = [];

    for (const task of tasks) {
      try {
        const result = await this.spawnSubagent(task);
        results.push(result);
      } catch (error) {
        console.error(`Failed to spawn agent for task: ${task}`, error);
        results.push({
          error: error.message,
          task
        });
      }
    }

    return results;
  }

  // Configuration and capability detection
  async detectOpenCodeCapabilities() {
    if (!this.opencodeAPI) {
      return {};
    }

    // Placeholder for capability detection
    return {
      codegen: true,
      debugger: true,
      tester: true,
      documentor: false,
      analyzer: true
    };
  }

  updateDelegationRules(newRules) {
    this.taskDelegationRules = { ...this.taskDelegationRules, ...newRules };
  }
}

module.exports = AgentBridge;