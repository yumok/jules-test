const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid'); // Use ws's built-in uuid or install uuid package

// If not using 'uuid' package explicitly, generate simple IDs:
// const generateUniqueId = () => `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients: Map<clientId, WebSocketConnection>
const clients = new Map();

console.log('Signaling server started on ws://localhost:8080');

wss.on('connection', (ws) => {
    // const clientId = generateUniqueId(); // Using simple generator
    const clientId = uuidv4(); // Using uuid library if installed with ws or separately
    clients.set(clientId, ws);

    console.log(`Client connected: ${clientId}`);

    // Send assigned client ID back to the newly connected client
    ws.send(JSON.stringify({
        type: 'client_id_assigned',
        clientId: clientId
    }));

    // Broadcast new peer to others (optional, could also use discover_peers)
    // broadcastToOthers(clientId, { type: 'new_peer', peerId: clientId });

    ws.on('message', (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) {
            console.error(`Failed to parse message from ${clientId}: ${message}`, e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message received.'}));
            return;
        }

        // Add senderId to the message for context if not present (or use clientId from connection)
        // parsedMessage.senderId = clientId;

        console.log(`Received message from ${clientId}:`, parsedMessage);

        const targetId = parsedMessage.targetId;
        const targetClient = clients.get(targetId);

        switch (parsedMessage.type) {
            case 'discover_peers':
                const peerIds = Array.from(clients.keys()).filter(id => id !== clientId);
                ws.send(JSON.stringify({
                    type: 'peer_list',
                    peerIds: peerIds
                }));
                break;

            case 'offer':
            case 'answer':
            case 'icecandidate': // Note: 'icecandidate' should be 'iceCandidate' typically in WebRTC
                if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                    // Add sender's ID to the message so the recipient knows who it's from
                    const messageToSend = { ...parsedMessage, senderId: clientId };
                    console.log(`Relaying ${parsedMessage.type} from ${clientId} to ${targetId}`);
                    targetClient.send(JSON.stringify(messageToSend));
                } else {
                    const errorMsg = `Target client ${targetId} not found or not open. Cannot relay ${parsedMessage.type}.`;
                    console.warn(errorMsg);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: errorMsg,
                        targetId: targetId
                    }));
                }
                break;

            // Heartbeat or keep-alive can be handled here if needed
            // case 'ping':
            //   ws.send(JSON.stringify({ type: 'pong' }));
            //   break;

            default:
                console.log(`Unknown message type from ${clientId}: ${parsedMessage.type}`);
                // Optionally send an error or ignore
                // ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${parsedMessage.type}`}));
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        clients.delete(clientId);
        // Notify other clients that this peer has disconnected
        broadcastToOthers(clientId, {
            type: 'peer_disconnected',
            peerId: clientId
        });
    });

    ws.on('error', (error) => {
        console.error(`Error on connection ${clientId}:`, error);
        // No need to delete from clients here, 'close' will be called eventually.
    });
});

function broadcastToOthers(senderId, message) {
    for (const [clientId, clientWs] of clients) {
        if (clientId !== senderId && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(message));
        }
    }
}

// For UUID generation, if not using 'ws' built-in or 'uuid' package:
// Ensure `uuid` is installed (`npm install uuid`) and required:
// const { v4: uuidv4 } = require('uuid');
// Or use the simple generator:
// const generateUniqueId = () => `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
// For this implementation, I'll assume the 'uuid' package is available
// as it's a common dependency or can be added easily.
// If 'ws' includes it or a similar robust generator, that's fine too.
// For now, I've used `require('uuid')` which implies it should be in package.json
// If not, the simple generator is a fallback.
// The `ws` package itself does not bundle `uuid`. So, let's add `uuid` to package.json.

// Graceful shutdown (optional, but good practice)
process.on('SIGINT', () => {
    console.log('Shutting down signaling server...');
    wss.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
