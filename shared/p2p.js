// Basic WebRTC client-side logic

let localAgent; // Will hold an Agent instance for the local peer
let remoteAgent; // Will hold an Agent instance for the remote peer

let peerConnection;
let dataChannel;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Example STUN server
};

function initializePeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE Candidate:', JSON.stringify(event.candidate));
      // In a real application, this candidate would be sent to the remote peer via a signaling server
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE Connection State:', peerConnection.iceConnectionState);
  };

  // Setup data channel (initiator side)
  function setupDataChannel() {
    dataChannel = peerConnection.createDataChannel('myDataChannel');

    dataChannel.onopen = () => {
      console.log('Data channel opened');
      dataChannel.send('Hello from initiator!');
    };

    dataChannel.onmessage = (event) => {
      console.log('Message received:', event.data);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  // If this peer is the one initiating the connection, it creates the data channel.
  // The other peer will receive it via the 'datachannel' event.
  // For simplicity in this basic setup, we'll call it here.
  // In a full app, you'd coordinate this.
  // setupDataChannel(); // Let's call this when creating an offer or explicitly by user action

  // Handle incoming data channels (non-initiator side)
  peerConnection.ondatachannel = (event) => {
    console.log('Incoming data channel detected');
    dataChannel = event.channel;

    dataChannel.onopen = () => {
      console.log('Data channel (remote) opened on ondatachannel');
      if (typeof Agent !== 'undefined') { // Check if agent-coordination.js is loaded
        if (!remoteAgent) {
          remoteAgent = new Agent('RemoteAgent_Receiver', dataChannel);
        } else {
          remoteAgent.dataChannel = dataChannel; // Update dataChannel if agent already exists
          // Ensure onmessage is reassigned if dataChannel is new
          dataChannel.onmessage = (event) => remoteAgent.handleMessage(event.data);
        }
        console.log('RemoteAgent associated with data channel by receiver.');
      } else {
        console.warn('Agent class not defined. Ensure agent-coordination.js is loaded.');
      }
    };

    // dataChannel.onmessage is now primarily handled by the Agent instance.
    // Similar to the initiator side, we assume Agent constructor handles onmessage.
    // dataChannel.onmessage = (event) => {
    //   console.log('Message received (remote, p2p.js fallback):', event.data);
    //   // Echo message back
    //   // dataChannel.send(`Echo: ${event.data}`);
    // };

    dataChannel.onclose = () => {
      console.log('Data channel (remote) closed');
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel (remote) error:', error);
    };
  };

  console.log('RTCPeerConnection initialized.');
  return peerConnection;
}

async function createOfferAndSetLocal() {
  if (!peerConnection) {
    console.error('PeerConnection not initialized. Call initializePeerConnection() first.');
    return;
  }

  // Create data channel before creating offer if this peer is the initiator
  if (!dataChannel) {
    console.log('Creating data channel as initiator.');
    dataChannel = peerConnection.createDataChannel('myDataChannel');

    dataChannel.onopen = () => {
      console.log('Data channel opened (initiator in createOfferAndSetLocal)');
      if (typeof Agent !== 'undefined') { // Check if agent-coordination.js is loaded
        if (!localAgent) {
          localAgent = new Agent('LocalAgent_Initiator', dataChannel);
        } else {
          localAgent.dataChannel = dataChannel; // Update dataChannel if agent already exists
          // Ensure onmessage is reassigned if dataChannel is new
          dataChannel.onmessage = (event) => localAgent.handleMessage(event.data);
        }
        console.log('LocalAgent associated with data channel by initiator.');
        // Agent might want to send a message upon connection, handled by Agent logic or app logic
      } else {
        console.warn('Agent class not defined. Ensure agent-coordination.js is loaded.');
      }
      // Original message for basic P2P test:
      dataChannel.send('Hello from p2p.js initiator after agent setup attempt!');
    };

    // dataChannel.onmessage is now primarily handled by the Agent instance.
    // If Agent is not defined, this original handler would be active IF NOT OVERWRITTEN.
    // However, the Agent constructor, if called, WILL overwrite dataChannel.onmessage.
    // So, we can remove this explicit original onmessage for clarity,
    // or leave it as a fallback if Agent creation fails.
    // For now, let's assume Agent will take over.
    // dataChannel.onmessage = (event) => {
    //   console.log('Message received (initiator, p2p.js fallback):', event.data);
    // };

    dataChannel.onclose = () => {
      console.log('Data channel closed (initiator)');
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error (initiator):', error);
    };
  }

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Offer created and local description set:');
    console.log(JSON.stringify(peerConnection.localDescription));
    // In a real app, send this offer to the other peer via signaling server
  } catch (error) {
    console.error('Error creating offer:', error);
  }
}

async function handleOfferAndCreateAnswer(offerSdp) {
  if (!peerConnection) {
    console.error('PeerConnection not initialized. Call initializePeerConnection() first.');
    return;
  }
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
    console.log('Remote description (offer) set.');
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('Answer created and local description set:');
    console.log(JSON.stringify(peerConnection.localDescription));
    // In a real app, send this answer to the other peer via signaling server
  } catch (error) {
    console.error('Error handling offer/creating answer:', error);
  }
}

async function handleAnswer(answerSdp) {
  if (!peerConnection) {
    console.error('PeerConnection not initialized. Call initializePeerConnection() first.');
    return;
  }
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
    console.log('Remote description (answer) set.');
  } catch (error) {
    console.error('Error handling answer:', error);
  }
}

// Example usage (manual signaling via console):
// Peer A (Initiator):
// 1. initializePeerConnection();
// 2. createOfferAndSetLocal(); -> Copy the offer from console
//
// Peer B:
// 1. initializePeerConnection();
// 2. handleOfferAndCreateAnswer(offerFromPeerA); -> Copy the answer from console
//
// Peer A:
// 3. handleAnswer(answerFromPeerB);
//
// ... dataChannel should now open and messages can be exchanged.

// To make it easier to test in a single browser window:
function getPeerConnection() { return peerConnection; }
function getDataChannel() { return dataChannel; } // This returns the last active datachannel
function getLocalAgent() { return localAgent; }
function getRemoteAgent() { return remoteAgent; }

console.log('p2p.js loaded');
