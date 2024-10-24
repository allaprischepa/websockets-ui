import { WebSocketServer } from 'ws';
import { WsHandler } from './handler';

const WS_PORT = 3000;

console.log(`Start websocket server on the ${WS_PORT} port!`);
const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on('connection', function connection(ws) {
    const handler = new WsHandler();
    let userId = '';

    ws.on('error', console.error);

    ws.on('message', function message(rawData) {
        const { responses, currentUserId } = handler.handleRequest(rawData, userId);
        if (currentUserId) userId = currentUserId;
        if (responses.length > 0) {
            responses.forEach((response) => {
                if (response.broadcast) {
                    wsServer.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(response.responseMsg);
                        }
                    });
                } else {
                    ws.send(response.responseMsg);
                }
            });
        }
    });
});

export default wsServer;
