// Basic WebRTC client-side logic with Signaling Server Integration

let localAgent; // Will hold an Agent instance for the local peer
// Manage multiple remote agents, e.g., in a map: { peerId: Agent }
// For simplicity in current examples, a single 'remoteAgent' might be used contextually.
let remoteAgent;
if (!window.agents) window.agents = {}; // Global store for remote agents: {peerId: Agent}


const activePeerConnections = {}; // Store multiple RTCPeerConnection objects: { peerId: RTCPeerConnection }
const activeDataChannels = {}; // Store multiple RTCDataChannel objects: { peerId: RTCDataChannel }

// Signaling Server related
let signalingSocket;
let myClientId; // Assigned by the signaling server
let availablePeers = []; // List of peerIds from the server
// let currentRemotePeerId; // Context for current P2P negotiation, might not be needed if peerId passed around

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Example STUN server
};

function connectSignalingServer(url = 'ws://localhost:8080') {
  if (signalingSocket && (signalingSocket.readyState === WebSocket.OPEN || signalingSocket.readyState === WebSocket.CONNECTING)) {
    console.log('Signaling server connection already open or connecting.');
    return;
  }

  signalingSocket = new WebSocket(url);

  signalingSocket.onopen = () => {
    console.log('Connected to signaling server.');
    // UI can be updated here, or wait for client_id_assigned
    // Request peer list on connect
    // sendSignalingMessage('discover_peers', {}); // Or do this via UI button
  };

  signalingSocket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.error('Invalid JSON from signaling server:', event.data);
      return;
    }

    console.log('Received from signaling server:', msg);

    switch (msg.type) {
      case 'client_id_assigned':
        myClientId = msg.clientId;
        console.log('My Client ID assigned:', myClientId);
        if (typeof window.updateMyClientIdDisplay === 'function') window.updateMyClientIdDisplay(myClientId);
        break;

      case 'peer_list':
        availablePeers = msg.peerIds || [];
        console.log('Available peers:', availablePeers);
        if (typeof window.updatePeersList === 'function') window.updatePeersList(availablePeers);
        break;

      case 'offer':
        handleOffer(msg.senderId, msg.sdp);
        break;

      case 'answer':
        handleAnswer(msg.senderId, msg.sdp);
        break;

      case 'icecandidate':
        handleIceCandidate(msg.senderId, msg.candidate);
        break;

      case 'peer_disconnected':
        console.log(`Peer ${msg.peerId} disconnected from signaling server.`);
        cleanupPeerConnection(msg.peerId); // Clean up WebRTC resources for this peer
        availablePeers = availablePeers.filter(id => id !== msg.peerId);
        if (typeof window.updatePeersList === 'function') window.updatePeersList(availablePeers);
        if (typeof window.updatePeerDisconnected === 'function') window.updatePeerDisconnected(msg.peerId);
        break;

      case 'error': // Error from signaling server (e.g., target client not found)
        console.error(`Error from signaling server: ${msg.message}`, msg.details || '');
        // alert(`Signaling error: ${msg.message}`);
        break;

      default:
        console.log('Unhandled message type from signaling server:', msg.type);
    }
  };

  signalingSocket.onclose = () => {
    console.log('Disconnected from signaling server.');
    myClientId = null;
    availablePeers = [];
    // Update UI, potentially attempt reconnection
    if (typeof window.updateMyClientIdDisplay === 'function') window.updateMyClientIdDisplay(null);
    if (typeof window.updatePeersList === 'function') window.updatePeersList([]);
  };

  signalingSocket.onerror = (error) => {
    console.error('Signaling server connection error:', error);
    // Update UI
  };
}

function sendSignalingMessage(type, payload, targetId = null) {
  if (!signalingSocket || signalingSocket.readyState !== WebSocket.OPEN) {
    console.error('Signaling socket not connected or not open.');
    return;
  }
  const message = { type, ...payload };
  if (targetId) {
    message.targetId = targetId;
  }
  // The server knows sender by WebSocket connection, but explicit senderId can be useful.
  // message.senderId = myClientId;
  console.log('Sending to signaling server:', message);
  signalingSocket.send(JSON.stringify(message));
}

function initializePeerConnection(peerId) {
  if (activePeerConnections[peerId]) {
    console.log(`PeerConnection already exists or is being set up for ${peerId}`);
    return activePeerConnections[peerId];
  }

  console.log(`Initializing new RTCPeerConnection for peer: ${peerId}`);
  const pc = new RTCPeerConnection(configuration);
  activePeerConnections[peerId] = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE Candidate for ${peerId}:`, event.candidate.candidate.substring(0,30) + "...");
      sendSignalingMessage('icecandidate', { candidate: event.candidate }, peerId);
    }
  };

  pc.oniceconnectionstatechange = () => {
    const connectionState = pc.iceConnectionState;
    console.log(`ICE Connection State for ${peerId}: ${connectionState}`);
    if (typeof window.updateP2PStatus === 'function') window.updateP2PStatus(peerId, connectionState);

    if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
      console.warn(`Connection to ${peerId} ${connectionState}. Cleaning up.`);
      cleanupPeerConnection(peerId);
    } else if (connectionState === 'connected') {
      console.log(`Successfully connected to peer ${peerId} via WebRTC.`);
    }
  };

  pc.ondatachannel = (event) => {
    const incomingChannel = event.channel;
    console.log(`Incoming data channel '${incomingChannel.label}' from peer ${peerId}`);
    activeDataChannels[peerId] = incomingChannel;
    setupDataChannelEventHandlers(incomingChannel, peerId, false); // false: this peer is not the DC initiator
  };

  console.log(`RTCPeerConnection event handlers set up for ${peerId}.`);
  return pc;
}

function setupDataChannelEventHandlers(dc, peerId, isInitiator) {
  dc.onopen = () => {
    console.log(`Data channel to ${peerId} is open. Label: ${dc.label}, Initiator: ${isInitiator}`);
    activeDataChannels[peerId] = dc; // Ensure it's stored

    if (typeof Agent !== 'undefined') {
        if (!localAgent) { // Should be tied to myClientId
            localAgent = new Agent(myClientId || 'LocalUserAgent', null);
            console.log(`Local agent ${localAgent.id} created.`);
        }

        let remotePeerAgent = window.agents[peerId];
        if (!remotePeerAgent) {
            remotePeerAgent = new Agent(peerId, dc); // Pass DC to remote agent
            window.agents[peerId] = remotePeerAgent;
            console.log(`Remote agent ${remotePeerAgent.id} created and associated with data channel to ${peerId}.`);
        } else {
            remotePeerAgent.dataChannel = dc; // Update DC
            // Ensure the Agent's onmessage handler is attached to this specific dc instance
            dc.onmessage = (event) => remotePeerAgent.handleMessage(event.data);
            console.log(`Remote agent ${remotePeerAgent.id} re-associated with new data channel to ${peerId}.`);
        }
        // For simplicity, the global 'remoteAgent' can point to the last interacted one.
        remoteAgent = remotePeerAgent;

    } else {
        console.warn('Agent class not defined. Load agent-coordination.js first.');
        // Fallback message handler if no agent is associated
        dc.onmessage = (event) => {
             console.log(`Message from ${peerId} (no agent handler for DC ${dc.label}):`, event.data);
        };
    }

    if (isInitiator) { // Send a greeting if this client initiated the data channel
         dc.send(JSON.stringify({ type: 'greeting', message: `Hello from ${myClientId || 'Initiator'}!`}));
    }
  };

  // Default onmessage if not overridden by Agent
  dc.onmessage = (event) => {
    console.log(`Default DC onmessage for ${peerId} (label: ${dc.label}):`, event.data);
    // This will likely be replaced by agent.handleMessage if Agent is used.
  };

  dc.onclose = () => {
    console.log(`Data channel with ${peerId} (label: ${dc.label}) closed.`);
    if (activeDataChannels[peerId] === dc) { // Only delete if it's the current one
        delete activeDataChannels[peerId];
    }
    // Don't necessarily cleanup the whole PeerConnection here, might have other DCs or be reconnecting.
  };

  dc.onerror = (error) => {
    console.error(`Data channel error with ${peerId} (label: ${dc.label}):`, error);
  };
}

function cleanupPeerConnection(peerId) {
  const pc = activePeerConnections[peerId];
  if (pc) {
    try { pc.close(); } catch(e) { console.warn("Error closing PeerConnection", e); }
    delete activePeerConnections[peerId];
    console.log(`Cleaned up PeerConnection for ${peerId}`);
  }

  const dc = activeDataChannels[peerId];
  if (dc) {
    try { dc.close(); } catch(e) { console.warn("Error closing DataChannel", e); }
    delete activeDataChannels[peerId];
    console.log(`Cleaned up DataChannel for ${peerId}`);
  }

  if (window.agents && window.agents[peerId]) {
    // Optionally, inform the agent instance about disconnection if it needs to clean up state
    // window.agents[peerId].handleDisconnection();
    delete window.agents[peerId];
    console.log(`Removed agent instance for ${peerId}`);
  }
  // If the global remoteAgent was this peer, nullify it.
  if (remoteAgent && remoteAgent.id === peerId) remoteAgent = null;

  if (typeof window.updatePeerDisconnected === 'function') window.updatePeerDisconnected(peerId);
}

async function handleOffer(senderId, sdp) {
  console.log(`Received offer from ${senderId}. SDP: ${sdp ? sdp.type : 'N/A'}`);
  // currentRemotePeerId = senderId; // Set context for who we are dealing with
  const pc = initializePeerConnection(senderId); // Ensures PC is ready

  // ondatachannel is set in initializePeerConnection to handle the remote's data channel creation.

  try {
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    console.log(`Remote description (offer) set for ${senderId}. Creating answer...`);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log(`Answer created for ${senderId}. SDP:`, answer.sdp.substring(0,30)+"...");
    sendSignalingMessage('answer', { sdp: answer.sdp }, senderId); // Send only sdp part of answer
  } catch (error) {
    console.error(`Error handling offer from ${senderId}:`, error);
    cleanupPeerConnection(senderId);
  }
}

async function handleAnswer(senderId, sdp) {
  console.log(`Received answer from ${senderId}. SDP: ${sdp ? sdp.type : 'N/A'}`);
  const pc = activePeerConnections[senderId];
  if (!pc) {
    console.error(`No PeerConnection found for ${senderId} to handle answer.`);
    return;
  }
  try {
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    console.log(`Remote description (answer) set successfully for ${senderId}.`);
  } catch (error) {
    console.error(`Error handling answer from ${senderId}:`, error);
    cleanupPeerConnection(senderId);
  }
}

async function handleIceCandidate(senderId, candidateInfo) {
  console.log(`Received ICE candidate from ${senderId}:`, candidateInfo ? candidateInfo.candidate.substring(0,30)+"..." : "null candidate");
  const pc = activePeerConnections[senderId];
  if (!pc) {
    console.error(`No PeerConnection found for ${senderId} to handle ICE candidate.`);
    return;
  }
  try {
    if (candidateInfo) {
      await pc.addIceCandidate(new RTCIceCandidate(candidateInfo));
      console.log(`ICE candidate added successfully for ${senderId}.`);
    } else {
      console.log(`Null ICE candidate received from ${senderId}, ignoring.`);
    }
  } catch (error) {
    // Browsers sometimes send a null candidate at the end of the process, which can cause an error if not handled.
    if (candidateInfo) { // Only log error if candidate was not null
        console.error(`Error adding ICE candidate from ${senderId}:`, error, "Candidate:", candidateInfo);
    }
  }
}

async function initiateP2PConnection(targetPeerId) {
  if (!myClientId) {
    alert("Connect to signaling server first to get your Client ID.");
    return false;
  }
  if (myClientId === targetPeerId) {
    alert("Cannot connect to self.");
    return false;
  }
  if (activePeerConnections[targetPeerId] &&
      (activePeerConnections[targetPeerId].connectionState === 'connected' ||
       activePeerConnections[targetPeerId].connectionState === 'connecting')) {
    alert(`Already connected or connecting to ${targetPeerId}.`);
    return false;
  }

  console.log(`Initiating P2P connection to ${targetPeerId}`);
  // currentRemotePeerId = targetPeerId;

  const pc = initializePeerConnection(targetPeerId);

  const dcLabel = `dc_${myClientId}_to_${targetPeerId}`;
  const dc = pc.createDataChannel(dcLabel); // Create data channel
  console.log(`Created data channel for initiator to ${targetPeerId}. Label: ${dc.label}`);
  setupDataChannelEventHandlers(dc, targetPeerId, true); // true: this client is the DC initiator

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log(`Offer created for ${targetPeerId}. SDP:`, offer.sdp.substring(0,30) + "...");
    // Send only the SDP part of the offer
    sendSignalingMessage('offer', { sdp: offer.sdp }, targetPeerId);
    return true;
  } catch (error) {
    console.error(`Error creating offer for ${targetPeerId}:`, error);
    cleanupPeerConnection(targetPeerId);
    return false;
  }
}

// Expose functions to UI / global scope via window.p2p object
window.p2p = {
  connectSignalingServer,
  discoverPeers: () => {
    if (!myClientId) { alert("Connect to signaling server first!"); return; }
    sendSignalingMessage('discover_peers', {});
  },
  initiateP2PConnection,
  getMyClientId: () => myClientId,
  getAvailablePeers: () => availablePeers,
  getLocalAgent: () => localAgent,
  getRemoteAgentById: (peerId) => window.agents[peerId], // Get specific remote agent
  // For simplicity, if a single 'remoteAgent' is often needed:
  // getActiveRemoteAgent: () => remoteAgent,
  closeConnection: (peerId) => {
    if(peerId) cleanupPeerConnection(peerId);
    else console.warn("closeConnection called without peerId");
  }
};

console.log('p2p.js loaded with new signaling server integration and multi-peer capabilities.');
