// Basic LLM Agent Coordination Logic

// CONCEPTUAL OVERVIEW FOR DISTRIBUTED TASK PROCESSING:
// The current system supports a basic model for distributing tasks among connected agents.
// A primary agent (either user-driven or programmatically designated) can break down a larger
// computational job (e.g., processing a batch of documents for embeddings) into smaller sub-tasks.
// Each sub-task can then be assigned to an available peer agent using the
// `initiateTaskAssignment(assigningAgent, receivingPeerId, subTaskDescription)` function.
//
// The primary agent would:
// 1. Define the main task and divide it into distributable sub-tasks.
// 2. Discover available peers (e.g., via `window.p2p.getAvailablePeers()`).
// 3. For each sub-task, select an agent and use `initiateTaskAssignment`.
//    - The `assigningAgent.assignedTasks` object will store these outgoing tasks.
// 4. As sub-tasks are completed by remote agents, the `handleMessage` method of the
//    primary agent (specifically the 'taskCompleted' case) will be invoked.
// 5. The primary agent would then aggregate the results from `task.result` for each
//    completed sub-task to form the final result for the main task.
//
// Example Scenario: Batch Embeddings
// - Main Task: Calculate embeddings for 100 text snippets.
// - Sub-tasks: Create 10 sub-tasks, each for calculating embeddings for 10 snippets.
// - Distribution: Assign these 10 sub-tasks to available agents. If 2 other agents are
//   available, each might get 5 sub-tasks, or distribute based on load.
// - Aggregation: Collect all 10 sets of 10 embeddings.
//
// Current limitations/Future considerations:
// - Sophisticated load balancing is not implemented (tasks are assigned manually or round-robin).
// - Fault tolerance (e.g., re-assigning tasks if an agent disconnects) is basic.
// - Task prioritization is not implemented.
// - No explicit mechanism for agents to advertise specific capabilities (e.g., "I can do embeddings").

// For now, agents will be identified by a simple ID.
// Later, this could be tied to a WebRTC peer ID or a data channel.
let agentIdCounter = 0;

// Global list to store agents for easy access/rendering by other modules
const agents = [];

class Agent {
  constructor(name = `Agent-${++agentIdCounter}`, dataChannelRef = null) {
    this.id = name; // Could be peerId in a real WebRTC setup
    this.status = 'idle'; // e.g., idle, busy, completed, waiting_for_completion
    this.currentTask = null; // The task this agent is currently processing
    this.assignedTasks = {}; // Tasks this agent has assigned to others, waiting for completion {taskId: task}
    this.completedTasks = []; // Tasks this agent has completed itself
    this.dataChannel = dataChannelRef; // Reference to a WebRTC data channel

    if (this.dataChannel) {
      this.dataChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    }
    agents.push(this); // Add agent to the global list
  }

  async assignTask(task) {
    this.currentTask = task;
    this.status = 'busy';
    task.status = 'in_progress'; // Mark as in_progress before async call
    const processingMessage = `Task "${task.description}" (ID: ${task.id}, Type: ${task.taskType}) assigned to agent ${this.id}. Handing over to LLM Processor...`;
    console.log(processingMessage);

    if (typeof updateAgentRepresentation === 'function') {
      updateAgentRepresentation(this.id, this.status, this.currentTask);
    }

    // Call the standalone processLlmTask function
    // Ensure processLlmTask is loaded and available globally or imported if using modules
    if (typeof processLlmTask === 'function') {
      await processLlmTask(task, this.id); // Pass task and agent's ID
    } else {
      console.error("processLlmTask function is not defined. Ensure llm-processor.js is loaded.");
      // Fallback or error handling
      task.result = "Error: LLM processor not found.";
      task.status = 'failed';
    }

    // Post-processing logic (after await processLlmTask(task, this.id) completes)
    // task object is mutated by processLlmTask
    this.completedTasks.push(task);

    const oldTask = this.currentTask;
    this.currentTask = null;
    this.status = 'idle';

    console.log(`Task "${oldTask.description}" (ID: ${oldTask.id}) officially completed by agent ${this.id} (via LLM Processor). Status: ${this.status}`);

    if (typeof updateAgentRepresentation === 'function') {
      updateAgentRepresentation(this.id, this.status, null);
    }

    if (task.assignerId && task.assignerId !== this.id) {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        console.log(`Agent ${this.id} sending taskCompleted for task ${task.id} to assigner ${task.assignerId}`);
        this.dataChannel.send(JSON.stringify({
          type: 'taskCompleted',
          taskId: task.id,
          result: task.result,
          completedByAgentId: this.id
        }));
      } else {
        console.warn(`Agent ${this.id}: Data channel not open or not available to send task completion for ${task.id} to ${task.assignerId}.`);
      }
    }

    if (task.assignerId === this.id) {
       if (this.assignedTasks[task.id]) {
          console.log(`Agent ${this.id} (self-assigned) processed task: ${task.id} via LLM Processor.`);
          this.assignedTasks[task.id].status = task.status; // Should be 'completed' or 'failed'
          this.assignedTasks[task.id].result = task.result;
       }
    }
  }
  // ... other Agent methods (handleMessage)
  handleMessage(message) { // Make sure this method exists or is added back if removed accidentally
    console.log(`Agent ${this.id} received message:`, message);
    try {
      const parsedMessage = JSON.parse(message);
      switch (parsedMessage.type) {
        case 'taskAssignment':
          if (parsedMessage.task) {
            console.log(`Agent ${this.id} is being assigned task ${parsedMessage.task.id} (Type: ${parsedMessage.task.taskType}) via data channel.`);
            const taskToProcess = { ...parsedMessage.task, status: 'pending' };
            this.assignTask(taskToProcess); // This is async, but handleMessage doesn't need to await it
          } else {
            console.warn(`Agent ${this.id} received taskAssignment without task object.`);
          }
          break;
        case 'taskCompleted':
          if (parsedMessage.taskId && parsedMessage.result) {
            console.log(`Agent ${this.id} received notification: Task ${parsedMessage.taskId} completed by ${parsedMessage.completedByAgentId}. Result:`, parsedMessage.result);
            const originallyAssignedTask = this.assignedTasks[parsedMessage.taskId];
            if (originallyAssignedTask) {
              originallyAssignedTask.status = 'completed';
              originallyAssignedTask.result = parsedMessage.result;
              // Check if this agent is waiting for other tasks too
              const stillWaiting = Object.values(this.assignedTasks).some(t => t.status === 'assigned_remote' || t.status === 'in_progress');
              if (!stillWaiting) {
                this.status = 'idle';
              } else {
                this.status = 'waiting_for_completion'; // Still has other tasks out
              }
              console.log(`Agent ${this.id} updated its assigned task ${parsedMessage.taskId} to completed. Agent status: ${this.status}`);
              if (typeof updateAgentRepresentation === 'function') {
                // Reflect that this agent might no longer be "busy" with *this* specific task it assigned out
                // but its overall status depends on other activities.
                updateAgentRepresentation(this.id, this.status, null);
              }
              if (typeof window.updateCompletedTasksDisplay === 'function') {
                window.updateCompletedTasksDisplay(this.id, this.assignedTasks[parsedMessage.taskId]);
              }
            } else {
              console.warn(`Agent ${this.id} received completion for unknown task ID: ${parsedMessage.taskId}`);
            }
          } else {
            console.warn(`Agent ${this.id} received taskCompleted message with missing taskId or result.`);
          }
          break;
        default:
          console.warn(`Agent ${this.id} received unknown message type: ${parsedMessage.type}`);
      }
    } catch (error) {
      console.error(`Agent ${this.id} error handling message: ${error}. Message:`, message);
    }
  }
}

// Task structure
function createTask(description, assignerId = null, taskType = 'generic') { // Added taskType, default 'generic'
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    description: description,
    assignerId: assignerId, // ID of the agent who assigned this task
    taskType: taskType, // Added taskType field
    status: 'pending', // e.g., pending, assigned, in_progress, completed
    result: null
  };
}

// Basic function to initiate task assignment
// assigningAgent: The local agent instance (typically window.p2p.getLocalAgent())
// receivingPeerId: The ID of the target peer (from signaling server)
// This function is key for distributing sub-tasks in a multi-agent scenario.
// An agent can call this to offload work to other connected peers.
function initiateTaskAssignment(assigningAgent, receivingPeerId, taskDescription) {
  if (!assigningAgent) {
    console.error("Assigning agent (local agent) is not defined for initiateTaskAssignment.");
    return;
  }

  // Determine task type (simple heuristic for now)
  let taskType = 'generic';
  if (taskDescription.toLowerCase().includes('embedding')) {
    taskType = 'embedding';
  }

  if (!receivingPeerId) {
    console.warn("No receivingPeerId provided. Assigning task locally to self.");
    const selfTask = createTask(taskDescription, assigningAgent.id, taskType); // Pass taskType
    assigningAgent.assignTask(selfTask); // assignTask is now async, but initiateTaskAssignment doesn't need to await it
    return;
  }
  if (assigningAgent.id === receivingPeerId) {
     console.warn("Assigning agent is the same as receiving peer. Assigning task locally.");
     const selfTask = createTask(taskDescription, assigningAgent.id, taskType); // Pass taskType
     assigningAgent.assignTask(selfTask);
     return;
  }

  const task = createTask(taskDescription, assigningAgent.id, taskType); // Pass taskType

  // Get the remote agent instance and its data channel
  // Small correction: window.agents stores agents by their ID.
  // The P2P layer (p2p.js) sets up remoteAgent instances with their peerId as key in window.agents.
  const remotePeerAgent = window.agents && window.agents[receivingPeerId];

  if (remotePeerAgent && remotePeerAgent.dataChannel && remotePeerAgent.dataChannel.readyState === 'open') {
    console.log(`Agent ${assigningAgent.id} is initiating task "${task.description}" (ID: ${task.id}, Type: ${task.taskType}) for Peer ${receivingPeerId}`);

    remotePeerAgent.dataChannel.send(JSON.stringify({
      type: 'taskAssignment',
      task: task
    }));

    assigningAgent.assignedTasks[task.id] = task; // Store task that was assigned
    assigningAgent.status = 'waiting_for_completion';
    task.status = 'assigned_remote';

    if (typeof updateAgentRepresentation === 'function') {
      updateAgentRepresentation(assigningAgent.id, assigningAgent.status, task);
    }
    console.log(`Task ${task.id} (Type: ${task.taskType}) sent to peer ${receivingPeerId}. Local agent ${assigningAgent.id} is waiting_for_completion.`);
  } else {
    console.warn(`Cannot assign task to ${receivingPeerId}: No open data channel or remote agent not found. `+
                 `Remote agent: ${remotePeerAgent}, DC: ${remotePeerAgent ? remotePeerAgent.dataChannel : 'N/A'}`);
    alert(`Could not send task to peer ${receivingPeerId}. Data channel not ready or peer not fully connected. Assigning task locally for now.`);
    const selfTask = createTask(taskDescription + " (originally for " + receivingPeerId + ")", assigningAgent.id, taskType); // Pass taskType
    assigningAgent.assignTask(selfTask);
  }
}

// Function to get all agents (e.g., for rendering)
function getAllAgents() {
  return agents;
}

console.log('agent-coordination.js loaded');
