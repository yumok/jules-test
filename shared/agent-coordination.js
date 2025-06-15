// Basic LLM Agent Coordination Logic

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

  assignTask(task) { // Task assigned to this agent to process
    this.currentTask = task;
    this.status = 'busy';
    task.status = 'in_progress';
    const processingMessage = `Task "${task.description}" (ID: ${task.id}) assigned to agent ${this.id}. Processing...`;
    console.log(processingMessage);

    if (typeof updateAgentRepresentation === 'function') {
      updateAgentRepresentation(this.id, this.status, this.currentTask);
    }

    // Simulate asynchronous work
    const processingTime = 2000 + Math.random() * 3000; // 2-5 seconds
    setTimeout(() => {
      task.result = `Processed result for: ${task.description} by ${this.id}`;
      task.status = 'completed';
      this.completedTasks.push(task);

      const oldTask = this.currentTask;
      this.currentTask = null;
      this.status = 'idle';

      console.log(`Task "${oldTask.description}" (ID: ${oldTask.id}) completed by agent ${this.id}. Result: ${task.result}. Status: ${this.status}`);

      if (typeof updateAgentRepresentation === 'function') {
        updateAgentRepresentation(this.id, this.status, null); // No current task visual
      }

      // If task was assigned by another agent, notify them
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
      // If this agent assigned it to itself (e.g. for local testing via UI)
      if (task.assignerId === this.id) {
         if (this.assignedTasks[task.id]) {
            console.log(`Agent ${this.id} (self-assigned) completed task: ${task.id}`);
            this.assignedTasks[task.id].status = 'completed';
            this.assignedTasks[task.id].result = task.result;
            // Potentially move from assignedTasks to a different list or just update status
         }
      }

    }, processingTime);
  }

  // No direct completeTask method needed if assignTask handles the full lifecycle including completion.
  // completeTask() { ... } // Removed as processing is now part of assignTask

  handleMessage(message) {
    console.log(`Agent ${this.id} received message:`, message);
    try {
      const parsedMessage = JSON.parse(message);
      switch (parsedMessage.type) {
        case 'taskAssignment':
          if (parsedMessage.task) {
            console.log(`Agent ${this.id} is being assigned task ${parsedMessage.task.id} via data channel.`);
            // Ensure task object is robust
            const taskToProcess = { ...parsedMessage.task, status: 'pending' };
            this.assignTask(taskToProcess);
          } else {
            console.warn(`Agent ${this.id} received taskAssignment without task object.`);
          }
          break;
        case 'taskCompleted':
          if (parsedMessage.taskId && parsedMessage.result) {
            console.log(`Agent ${this.id} received notification: Task ${parsedMessage.taskId} completed by ${parsedMessage.completedByAgentId}. Result: ${parsedMessage.result}`);
            const originallyAssignedTask = this.assignedTasks[parsedMessage.taskId];
            if (originallyAssignedTask) {
              originallyAssignedTask.status = 'completed';
              originallyAssignedTask.result = parsedMessage.result;
              this.status = 'idle'; // No longer waiting for this specific task
              // TODO: If multiple tasks assigned, status should be managed more carefully
              console.log(`Agent ${this.id} updated its assigned task ${parsedMessage.taskId} to completed.`);
              if (typeof updateAgentRepresentation === 'function') {
                updateAgentRepresentation(this.id, this.status, null); // Or show next pending task
              }
              // Trigger UI update for completed tasks list
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
function createTask(description, assignerId = null) {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    description: description,
    assignerId: assignerId, // ID of the agent who assigned this task
    status: 'pending', // e.g., pending, assigned, in_progress, completed
    result: null
  };
}

// Basic function to initiate task assignment
function initiateTaskAssignment(assigningAgent, receivingAgentId, taskDescription) {
  if (!assigningAgent) {
    console.error("Assigning agent is not defined for initiateTaskAssignment.");
    return;
  }

  const task = createTask(taskDescription, assigningAgent.id);
  const receivingAgent = agents.find(agent => agent.id === receivingAgentId);

  if (receivingAgent && receivingAgent !== assigningAgent) {
    console.log(`Agent ${assigningAgent.id} is initiating task "${task.description}" (ID: ${task.id}) for Agent ${receivingAgent.id}`);
    if (receivingAgent.dataChannel && receivingAgent.dataChannel.readyState === 'open') {
      receivingAgent.dataChannel.send(JSON.stringify({
        type: 'taskAssignment',
        task: task
        // removed agentId from here, task.assignerId should be used by receiver if needed
      }));
      assigningAgent.assignedTasks[task.id] = task; // Store task that was assigned
      assigningAgent.status = 'waiting_for_completion'; // Or simply remains 'idle' if it can do other things
      task.status = 'assigned';
      if (typeof updateAgentRepresentation === 'function') {
        updateAgentRepresentation(assigningAgent.id, assigningAgent.status, task); // Show assigning agent as busy/waiting
      }
    } else {
      console.warn(`No open data channel to ${receivingAgent.id}. Cannot assign task remotely.`);
      // Optionally, assign to self or queue, but current requirement is to simulate sending.
      // For now, do nothing if channel not open to remote.
    }
  } else { // If receivingAgent is not found, or is the same as assigningAgent
    console.warn(`Assigning task ${task.id} locally to ${assigningAgent.id} (Receiving agent ${receivingAgentId} not found or is self).`);
    // assigningAgent.assignedTasks[task.id] = task; // Track it as if assigned to self
    // task.status = 'assigned'; // not really assigned, but about to be processed by self
    assigningAgent.assignTask(task); // Assign to self for processing
  }
}

// Function to get all agents (e.g., for rendering)
function getAllAgents() {
  return agents;
}

console.log('agent-coordination.js loaded');
