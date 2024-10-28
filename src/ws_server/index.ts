import WebSocket, { WebSocketServer } from 'ws';
import { Response, WsHandler } from './handler';
import { log } from '../utils/utils';

type WebsocketExtended = WebSocket & { userId: string };

function sendresponses(server: WebSocketServer, ws: WebSocket, responses: Response[]) {
    if (responses.length > 0) {
        responses.forEach((response) => {
            log.magenta(`Response: ${response.responseMsg}`);

            if (response.delay) {
                if (response.broadcast) {
                    setTimeout(() => broadcast(server, response.responseMsg), response.delay);
                } else if (response.to) {
                    const toClients = response.to;
                    setTimeout(() => toSomeClients(server, toClients, response.responseMsg), response.delay);
                } else {
                    setTimeout(() => ws.send(response.responseMsg), response.delay);
                }
            } else {
                if (response.broadcast) {
                    broadcast(server, response.responseMsg);
                } else if (response.to) {
                    toSomeClients(server, response.to, response.responseMsg);
                } else {
                    ws.send(response.responseMsg);
                }
            }
        });
    }
}

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

function getLoggedUsers(server: WebSocketServer): string[] {
    const loggedUsers: string[] = [];

    server.clients.forEach((client) => {
        const clientUserId = (client as WebsocketExtended).userId;
        if (client.readyState === WebSocket.OPEN && clientUserId) {
            loggedUsers.push(clientUserId);
        }
    });

    return loggedUsers;
}

const WS_PORT = 3000;

console.log(`Start websocket server on the ${WS_PORT} port!`);
const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on('connection', function connection(ws: WebsocketExtended) {
    const handler = new WsHandler();
    const server = this;
    ws.userId = '';

    ws.on('error', (err) => {
        if (ws.userId) {
            log.red(`Socket with userId: ${ws.userId} has error: ${err.message}`);

            const responses = handler.removeUserFromRoomsAndGames(ws.userId);
            sendresponses(server, ws, responses);
        }
    });
    ws.on('close', (code) => {
        if (ws.userId) {
            log.red(`Socket with userId: ${ws.userId} closed with code: ${code}`);

            const responses = handler.removeUserFromRoomsAndGames(ws.userId);
            sendresponses(server, ws, responses);
        }
    });

    ws.on('message', function message(rawData) {
        const loggedUsers = getLoggedUsers(server);
        const { responses, currentUserId } = handler.handleRequest(rawData, ws.userId, loggedUsers);
        if (currentUserId) ws.userId = currentUserId;

        sendresponses(server, ws, responses);
    });
});

export default wsServer;
