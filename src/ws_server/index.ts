import WebSocket, { WebSocketServer } from 'ws';
import { WsHandler } from './handler';
import { log } from '../utils/utils';

type WebsocketExtended = WebSocket & { userId: string };

function broadcast(server: WebSocketServer, msg: string) {
    server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

function toSomeClients(server: WebSocketServer, ids: string[], msg: string) {
    server.clients.forEach((client) => {
        const clientUserId = (client as WebsocketExtended).userId;
        if (client.readyState === WebSocket.OPEN && clientUserId && ids.includes(clientUserId)) {
            client.send(msg);
        }
    });
}

const WS_PORT = 3000;

console.log(`Start websocket server on the ${WS_PORT} port!`);
const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on('connection', function connection(ws: WebsocketExtended) {
    const handler = new WsHandler();
    const server = this;
    ws.userId = '';

    ws.on('error', console.error);

    ws.on('message', function message(rawData) {
        const { responses, currentUserId } = handler.handleRequest(rawData, ws.userId);

        if (currentUserId) ws.userId = currentUserId;

        if (responses.length > 0) {
            responses.forEach((response) => {
                log.magenta(`Response: ${response.responseMsg}`);

                if (response.broadcast) {
                    broadcast(server, response.responseMsg);
                } else if (response.to) {
                    toSomeClients(server, response.to, response.responseMsg);
                } else {
                    ws.send(response.responseMsg);
                }
            });
        }
    });
});

export default wsServer;
