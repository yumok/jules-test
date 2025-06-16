// shared/llm-processor.js

/**
 * Processes a task, simulating an LLM operation like embedding calculation.
 * @param {object} task - The task object to process.
 * @param {string} agentId - The ID of the agent performing this processing (for logging).
 * @returns {Promise<object>} The processed task object with results.
 */
async function processLlmTask(task, agentId) {
  console.log(`LLM Processor (Agent ${agentId}) starting processing for task: ${task.description} (ID: ${task.id})`);

  // Simulate asynchronous LLM work (e.g., API call to an embedding model)
  // Adding a bit more delay to simulate a more intensive task
  await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 3500)); // 2.5-6 seconds

  // Simulate an embedding result
  const dummyEmbedding = Array.from({length: 10}, () => parseFloat(Math.random().toFixed(3))); // Ensure they are numbers
  task.result = {
    text: task.description,
    embedding: dummyEmbedding,
    processedBy: agentId, // Record which agent (via llm-processor) did this
    taskType: task.taskType
  };
  task.status = 'completed';

  console.log(`LLM Processor (Agent ${agentId}) completed processing for task: ${task.id}. Result:`, task.result);
  return task; // Return the mutated task object
}

// Expose the function if using modules or just make it globally accessible via script tag
// For simple script tag inclusion, it will be available globally.
// If using ES modules in the future, you would use: export { processLlmTask };
