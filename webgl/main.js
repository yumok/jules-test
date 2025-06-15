// Basic Three.js scene setup
function initWebGL() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error('WebGL canvas not found!');
    return;
  }

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  // Ensure renderer updates if canvas is resized via CSS or parent elements
  new ResizeObserver(() => renderer.setSize(canvas.clientWidth, canvas.clientHeight)).observe(canvas);


  // Geometry (Original Cube)
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
  const rotatingCube = new THREE.Mesh(geometry, material);
  rotatingCube.position.x = -2; // Move it to the side
  scene.add(rotatingCube);

  // Agent representations
  const agentVisuals = {}; // Store agent cubes by ID

  const agentMaterialBusy = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for busy
  const agentMaterialIdle = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue for idle
  const agentMaterialWaiting = new THREE.MeshBasicMaterial({ color: 0xffa500 }); // Orange for waiting_for_completion
  const agentMaterialDefault = new THREE.MeshBasicMaterial({ color: 0x808080 }); // Grey for unknown

  // This function will be called by agent-coordination.js
  window.updateAgentRepresentation = function(agentId, status, task) {
    console.log(`WebGL: Updating representation for ${agentId}, status: ${status}`);
    let agentCube = agentVisuals[agentId];
    if (!agentCube) {
      const agentGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); // Smaller cubes for agents
      // Position agents based on how many are already visualized
      const numAgents = Object.keys(agentVisuals).length;
      agentCube = new THREE.Mesh(agentGeometry, agentMaterialDefault.clone());
      agentCube.position.x = 0 + numAgents * 1.5; // Simple positioning
      agentCube.position.y = 0;
      scene.add(agentCube);
      agentVisuals[agentId] = agentCube;
      console.log(`WebGL: Created new visual for ${agentId} at x=${agentCube.position.x}`);
    }

    if (status === 'busy') {
      agentCube.material = agentMaterialBusy;
    } else if (status === 'idle') {
      agentCube.material = agentMaterialIdle;
    } else if (status === 'waiting_for_completion') {
      agentCube.material = agentMaterialWaiting;
    } else {
      agentCube.material = agentMaterialDefault;
    }
    // Optionally, display task info (e.g., change size, add text sprite - more complex)
    // Could also change cube text label if we add them.
    // For now, task object is logged here.
    if (task) {
      console.log(`WebGL: Agent ${agentId} task: ${task.description}, status: ${task.status}`);
    }
  };

  // Periodically check the global 'agents' array from agent-coordination.js
  // This is a fallback/alternative to ensure visuals are created if updateAgentRepresentation isn't called initially.
  function discoverAgents() {
    if (typeof getAllAgents === 'function') {
      const currentAgents = getAllAgents(); // from agent-coordination.js
      currentAgents.forEach(agent => {
        if (!agentVisuals[agent.id]) {
          // Call updateAgentRepresentation to create and color the visual
          window.updateAgentRepresentation(agent.id, agent.status, agent.task);
        }
      });
    }
  }
  setInterval(discoverAgents, 3000); // Check every 3 seconds


  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    rotatingCube.rotation.x += 0.01;
    rotatingCube.rotation.y += 0.01;

    // Animate agent cubes slightly (e.g., slow rotation)
    for (const id in agentVisuals) {
      agentVisuals[id].rotation.y += 0.005;
    }

    renderer.render(scene, camera);
  }

  // Start animation if Three.js is loaded
  if (typeof THREE !== 'undefined') {
    animate();
    // Initial discovery of agents if agent-coordination.js loaded and populated agents
    setTimeout(discoverAgents, 500);
  } else {
    console.error('THREE.js not loaded. Ensure it is included in your HTML.');
  }
}

// Wait for the DOM to be fully loaded before initializing WebGL
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebGL);
} else {
  initWebGL();
}
