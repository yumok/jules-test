# Distributed LLM Agent System

## Idea and Objective

This project aims to explore the development of a distributed system composed of Large Language Model (LLM) agents. The core idea is to enable these agents to collaborate on complex tasks in a decentralized manner.

The coordination style is inspired by SETI@home, envisioning a future where agents can be discovered and can contribute processing power peer-to-peer. In its current implementation, the peer discovery and signaling aspects are simplified, relying on manual SDP exchange for establishing WebRTC connections.

Key technology choices include:
-   **Progressive Web Applications (PWAs):** Used for the agent frontends, providing a user interface to interact with and monitor individual agents or the system.
-   **WebGL (via Three.js):** Employed for visualizing agent activity, their status (idle, busy, waiting), and potentially their interactions or data flows in a 3D space.
-   **WebRTC (Peer-to-Peer):** Facilitates direct communication (data channels) between agents, enabling them to exchange information, assign tasks, and report results without a central server for these interactions (once connected).

Task processing within this system is designed for asynchronous operations that might require significant processing time, akin to "deep thinking" tasks. Results from these tasks are stored by the completing agent and can be reported back to the assigning agent. The framework supports querying these results locally for now.

**Current Stage:** This repository represents the foundational framework for such a system. It includes the basic components for PWA setup, WebRTC communication, agent representation, task assignment, asynchronous processing simulation, and WebGL visualization. Further development would focus on robust peer discovery, advanced task decomposition, sophisticated agent capabilities, and more complex interaction protocols.

## Project Structure

The project is organized into the following main directories:

-   **`pwa/`**: Contains all files related to the Progressive Web Application. This includes:
    -   `index.html`: The main entry point for the application.
    -   `service-worker.js`: Handles PWA lifecycle events like caching.
    -   `manifest.json`: Provides PWA metadata.
    -   JavaScript for UI interactions and integrating other components (like WebGL and P2P).
    -   `icons/`: Icons for the PWA.

-   **`webgl/`**: Houses the WebGL visualization code.
    -   `main.js`: Script for setting up and managing the Three.js scene, rendering agents, and updating their visual states based on information from the agent coordination module.

-   **`shared/`**: Includes common JavaScript modules used by both the PWA and potentially other parts of the system.
    -   `p2p.js`: Manages WebRTC peer-to-peer connections, data channel setup, and signaling message handling (currently manual SDP exchange).
    -   `agent-coordination.js`: Defines the `Agent` class, task structures, and logic for task assignment, processing (simulated), and status updates. It interacts with `p2p.js` for communication and `webgl/main.js` for visual updates.

-   **`server/`**: This directory is currently a placeholder for any future server-side logic. Potential uses could include:
    -   A signaling server for automated WebRTC peer discovery.
    -   User authentication services.
    -   Persistent storage for agent data or task results, if a more centralized backup or logging is desired.
    For the current client-centric, P2P-focused implementation, this directory is not actively used for the core agent operations.

## Build Instructions

### Prerequisites

To run this project, you primarily need a modern web browser that supports the following web technologies:

-   **WebGL:** For rendering the 3D agent visualizations.
-   **WebRTC:** For enabling peer-to-peer communication between agents.
-   **Service Workers:** For Progressive Web App (PWA) features like offline capabilities (though offline caching is minimal currently) and installability.

Most up-to-date versions of browsers like Google Chrome, Mozilla Firefox, Microsoft Edge, and Safari should be compatible.

**No JavaScript Build Tools Required:**
Currently, the project does not rely on any specific JavaScript build tools (e.g., Webpack, Rollup, Parcel) or package managers (like npm or yarn) for its basic operation. The JavaScript files are vanilla ES6 and are linked directly in the HTML.

### Build Steps

**No Explicit Build Process Needed.**

At this stage, the project is designed to be run directly from the source files. There is no compilation, transpilation, or bundling step required.

Simply serve the project files using a local web server (see 'Running the Project' section) and open the `pwa/index.html` file in your browser.

## Running the Project (Deployment)

### Serving the Application

To run the application and utilize its Progressive Web App (PWA) features (like service workers), you need to serve the files via an HTTP server. Opening the `index.html` file directly from the local filesystem (e.g., using a `file:///` URL) will not work correctly for PWA functionalities and may also restrict WebRTC capabilities depending on browser security settings.

A simple local HTTP server is sufficient for this purpose. Here are a few common ways to start one from the **project root directory**:

1.  **Using Python:**
    *   If you have Python 3 installed:
        ```bash
        python -m http.server 8000
        ```
    *   If you have Python 2 installed:
        ```bash
        python -m SimpleHTTPServer 8000
        ```

2.  **Using Node.js (with `http-server`):**
    *   If you have Node.js and npm installed, you can use `npx` to run `http-server` without installing it globally:
        ```bash
        npx http-server . -p 8000
        ```
    *   Alternatively, you can install it globally first (`npm install -g http-server`) and then run:
        ```bash
        http-server . -p 8000
        ```

3.  **Other Simple Servers:**
    *   Many other tools can serve static files, such as `live-server` for Visual Studio Code, or extensions for your preferred browser or IDE. Any server that can serve static files from the project root will work.

### Accessing the Application

Once your local HTTP server is running (e.g., on port 8000), open your web browser and navigate to:

`http://localhost:8000/pwa/index.html`

This will load the PWA, allowing you to test the WebRTC communication (by opening two instances or tabs and manually exchanging SDP offers/answers), observe the WebGL visualization, and interact with the agent task assignment features.

## Usage Instructions

To explore the current capabilities of the system, follow these steps:

1.  **Opening the Application for Two Peers:**
    *   Open the application (e.g., `http://localhost:8000/pwa/index.html`) in two separate browser windows or tabs. These will represent your two distinct peers/agents.

2.  **Initiating Peer-to-Peer Connection (Manual Signaling):**
    The connection process currently requires manual exchange of signaling data (SDP offers and answers) between the two peers.

    *   **Step 1: Initialize P2P in Both Windows**
        *   In **Window 1**, click the "Initialize P2P Connection" button.
        *   In **Window 2**, click the "Initialize P2P Connection" button.
        *   You should see the "P2P Status" update to "PeerConnection Initialized..." in both windows.

    *   **Step 2: Create Offer (Window 1 - Initiator)**
        *   In **Window 1**, click the "1. Create Offer" button.
        *   An SDP offer will be generated and displayed in the text area below it (labeled "Paste Offer SDP here...").
        *   Copy this entire SDP offer string.

    *   **Step 3: Handle Offer & Create Answer (Window 2 - Receiver)**
        *   In **Window 2**, paste the copied SDP offer into its larger text area (labeled "Paste Offer SDP here...").
        *   Click the "2. Handle Offer / Create Answer" button.
        *   An SDP answer will be generated by Window 2 and displayed in its *lower* text area (labeled "Paste Answer SDP here...").
        *   Copy this entire SDP answer string.

    *   **Step 4: Handle Answer (Window 1 - Initiator)**
        *   Go back to **Window 1**.
        *   Paste the copied SDP answer (from Window 2) into Window 1's *lower* text area (labeled "Paste Answer SDP here...").
        *   Click the "3. Handle Answer" button.

    *   **Confirmation:**
        *   After a few moments, the "P2P Status" in both windows should indicate an established connection (e.g., "ICE: connected, Channel: open").
        *   In the WebGL canvas, you should see representations for "LocalAgent" and "RemoteAgent" appear (initially as grey or blue cubes). The names might vary slightly based on which peer initiated.

3.  **Assigning a Test Task:**
    *   Once the P2P connection is established, in **either window**, click the "Assign Task (Test)" button.
    *   This will typically assign a task from the "Local Agent" in that window to the "Remote Agent" (the agent in the other window).
    *   **Observe:**
        *   The status of the assigning agent (in the UI and WebGL) might change to "waiting_for_completion" (orange cube).
        *   The status of the receiving agent (in the UI and WebGL) should change to "busy" (red cube) while it simulates processing the task.
        *   After a few seconds, the receiving agent will complete the task, its status will change to "idle" (blue cube), and it will send a completion message back.
        *   The assigning agent will then also return to "idle" (blue cube).

4.  **Viewing Task Results:**
    *   In the window of the agent that **originally assigned the task**, its "Completed Tasks" list (at the bottom of the control panel) should update with the result of the task once the remote agent completes it and sends the notification back.
    *   In the window of the agent that **processed the task**, click the "View Local Completed Tasks" button. This will display a list of tasks it has completed, including the one it just processed. You can also click this button in the assigner's window to see a consolidated list.

5.  **WebGL Visualization:**
    *   The 3D canvas displays cubes that represent the agents in the system.
    *   **Colors indicate agent status:**
        *   **Blue:** Idle (available for tasks).
        *   **Red:** Busy (currently processing a task).
        *   **Orange:** Waiting for completion (has assigned a task and is waiting for the result).
        *   **Grey:** Default or unknown state (e.g., before full initialization or if an agent is discovered but status is not yet set).
    *   A green wireframe cube is also present for basic scene reference.

These steps allow you to test the core functionalities: P2P connection, task assignment across peers, asynchronous task simulation, result notification, and visual status updates.

## Diagrams

This section provides visual representations of the system architecture and key interaction flows.

### System Architecture

```mermaid
graph TD
    A[User] -- Interacts with --> B(PWA Interface);
    B -- Manages --> C[WebGL View];
    B -- Manages --> D[Local Agent Logic / Agent Coordination];
    B -- Manages --> E[P2P Communication Module];
    E -- WebRTC Data Channel --> F[Other Peer Agent(s)];
    D -- Updates --> C;
    D -- Uses --> E;

    subgraph futuras_Server [Future: Signaling Server]
        direction LR
        S1[Signaling Server]
    end
    E -. Optional Signaling .-> S1;
    F -. Optional Signaling .-> S1;

    style B fill:#lightblue,stroke:#333,stroke-width:2px
    style C fill:#lightgreen,stroke:#333,stroke-width:2px
    style D fill:#lightyellow,stroke:#333,stroke-width:2px
    style E fill:#orange,stroke:#333,stroke-width:2px
    style F fill:#lightgray,stroke:#333,stroke-width:2px
    style S1 fill:#pink,stroke:#333,stroke-width:2px
```

**Diagram Legend:**
-   **User:** The human operator interacting with the system.
-   **PWA Interface:** The Progressive Web Application running in the browser, serving as the main user entry point and container for other modules.
-   **WebGL View:** Renders the visual representation of agents and their states.
-   **Local Agent Logic / Agent Coordination:** Contains the `Agent` class, task management, and decision-making for the agent running in this PWA instance.
-   **P2P Communication Module:** Handles WebRTC connection setup and data channel communication with other peers.
-   **Other Peer Agent(s):** Other instances of the PWA/agent system running in different browser contexts.
-   **Signaling Server (Future):** A potential future component for automating peer discovery.

### Task Assignment Flow

This sequence diagram illustrates the process of one agent assigning a task to another.

```mermaid
sequenceDiagram
    participant User
    participant Browser1_PWA [Browser 1: PWA (Agent A - Assigner)]
    participant WebGL_A [Browser 1: WebGL View]
    participant P2P_A [Browser 1: P2P Module (Agent A)]
    participant AgentCoord_A [Browser 1: Agent Logic (Agent A)]

    participant Browser2_PWA [Browser 2: PWA (Agent B - Processor)]
    participant WebGL_B [Browser 2: WebGL View]
    participant P2P_B [Browser 2: P2P Module (Agent B)]
    participant AgentCoord_B [Browser 2: Agent Logic (Agent B)]

    User->>Browser1_PWA: Clicks "Assign Task" button
    Browser1_PWA->>AgentCoord_A: initiateTaskAssignment(AgentA, AgentB_ID, "Process data")
    AgentCoord_A->>AgentCoord_A: Create Task_XYZ (assignerId=A)
    AgentCoord_A->>AgentCoord_A: Update Agent A status to 'waiting_for_completion'
    AgentCoord_A->>WebGL_A: updateAgentRepresentation(A, 'waiting_for_completion')
    AgentCoord_A->>P2P_A: Send 'taskAssignment' (Task_XYZ) to Agent B

    P2P_A-->>P2P_B: WebRTC Data: {type: 'taskAssignment', task: Task_XYZ}
    P2P_B->>AgentCoord_B: handleMessage(taskAssignment_data)
    AgentCoord_B->>AgentCoord_B: Update Agent B status to 'busy'
    AgentCoord_B->>WebGL_B: updateAgentRepresentation(B, 'busy')
    AgentCoord_B->>AgentCoord_B: Simulate async work (setTimeout) for Task_XYZ

    Note right of AgentCoord_B: Agent B processes task...

    AgentCoord_B->>AgentCoord_B: Task_XYZ completed, result: "Done"
    AgentCoord_B->>AgentCoord_B: Update Agent B status to 'idle'
    AgentCoord_B->>WebGL_B: updateAgentRepresentation(B, 'idle')
    AgentCoord_B->>P2P_B: Send 'taskCompleted' (Task_XYZ, result) to Agent A

    P2P_B-->>P2P_A: WebRTC Data: {type: 'taskCompleted', taskId: XYZ, result: "Done"}
    P2P_A->>AgentCoord_A: handleMessage(taskCompleted_data)
    AgentCoord_A->>AgentCoord_A: Update Task_XYZ in assignedTasks with result
    AgentCoord_A->>AgentCoord_A: Update Agent A status to 'idle'
    AgentCoord_A->>WebGL_A: updateAgentRepresentation(A, 'idle')
    AgentCoord_A->>Browser1_PWA: Update UI (e.g., completed tasks list)
```

## Future Work / Roadmap

This project lays a basic foundation. Many exciting enhancements and features can be added:

-   **Signaling Server Implementation:**
    -   Develop a robust signaling server (e.g., using WebSockets) to automate the WebRTC handshake. This will eliminate the current manual copy-pasting of SDP offers/answers, making P2P connections seamless.

-   **Actual LLM Integration:**
    -   Integrate real Large Language Model processing capabilities into the agents. This is a core next step and could involve:
        -   Using client-side LLM libraries (e.g., TensorFlow.js, ONNX.js for smaller models).
        -   Making API calls from agents to backend LLM services.
        -   Defining more complex and meaningful task types that leverage LLM strengths (e.g., text generation, analysis, summarization, sub-problem solving).

-   **Dynamic Peer Discovery:**
    -   Implement mechanisms for agents to dynamically discover each other on the network (e.g., using mDNS, a shared discovery server, or network broadcasts if feasible within browser/network constraints).

-   **Advanced Task Orchestration & Management:**
    -   Develop more sophisticated strategies for task decomposition, distribution among available agents, and load balancing.
    -   Implement fault tolerance mechanisms (e.g., task reassignment if an agent disconnects).
    -   Allow for multi-step tasks or task dependencies.

-   **Persistent and Shared Storage:**
    -   Explore robust client-side storage for task results and agent state (e.g., IndexedDB).
    -   For more durable or shared knowledge, consider integrating with a server-side database or distributed storage solutions.

-   **Enhanced WebGL Visualization:**
    -   Add more detailed visual representations of agents and their current tasks.
    -   Visualize data flow, communication links between agents, and task progress more explicitly.
    -   Introduce interactive elements within the WebGL scene.

-   **Security Considerations:**
    -   Thoroughly address security aspects, especially for P2P communication (e.g., data encryption, peer authentication/authorization).
    -   Consider privacy implications if agents handle sensitive data.

-   **UI/UX Improvements:**
    -   Enhance the overall user interface for better clarity, ease of use, and more comprehensive monitoring and control features.
    -   Improve the PWA experience (e.g., more offline content, better install prompts).

-   **Code Refinement and Modularity:**
    -   Refactor and further modularize the codebase for better maintainability and scalability.
    -   Add comprehensive unit and integration tests.
