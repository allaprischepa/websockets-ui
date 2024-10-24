import { RawData } from 'ws';
import { jsonParse, jsonStringify, log, rawDataToStr } from '../utils/utils';
import db from '../db';

export interface Response {
    responseMsg: string;
    broadcast?: boolean; // if we send to all clients
    to?: string[]; // if we send to particular clients
}

export class WsHandler {
    handleRequest(rawData: RawData, userId: string): { responses: Response[]; currentUserId: string } {
        const responses = [];
        let currentUserId = userId;
        const rawDataStr = rawDataToStr(rawData);
        const msg = jsonParse(rawDataStr);
        const { type, data } = msg;
        const prsdData = jsonParse(data);

        log.green(`Request: ${rawDataStr}`);

        if (type) {
            switch (type) {
                case 'reg':
                    if (prsdData) {
                        const { eventResponses, id } = this.handleRequestTypeReg(prsdData);
                        const eventResponses2 = this.handleResponseTypeUpdateRoom();
                        currentUserId = id;

                        responses.push(...eventResponses, ...eventResponses2);
                    }

                    break;
                case 'create_room':
                    const eventResponses = this.handleRequestTypeCreateRoom(currentUserId);
                    const eventResponses2 = this.handleResponseTypeUpdateRoom();

                    responses.push(...eventResponses, ...eventResponses2);
                    break;
                case 'add_user_to_room':
                    if (prsdData) {
                        const eventResponses = this.handleRequestTypeAddToRoom(prsdData, currentUserId);
                        const eventResponses2 = this.handleResponseTypeUpdateRoom();

                        responses.push(...eventResponses, ...eventResponses2);
                    }
                    break;
            }
        }

        return { responses, currentUserId };
    }

    private handleRequestTypeReg(prsdData: { name: string; password: string }) {
        const { name, password } = prsdData;
        let user = db.getUserByName(name);
        let responseMsg = '';
        let error = false;
        let errorText = '';

        if (user) {
            if (password !== user.password) {
                error = true;
                errorText = 'Incorrect password';
            }
        } else {
            user = db.createUser(name, password);
        }

        responseMsg = jsonStringify({
            type: 'reg',
            data: jsonStringify({ user, error, errorText }),
            id: 0,
        });

        return {
            eventResponses: [{ responseMsg }],
            id: user.id,
        };
    }

    private handleRequestTypeCreateRoom(userId: string) {
        const newRoom = db.createRoom();
        db.addUserToRoom(newRoom.roomId, userId);

        return [];
    }

    private handleResponseTypeUpdateRoom() {
        const rooms = db.getAvailableRooms();
        const responseMsg = jsonStringify({
            type: 'update_room',
            data: jsonStringify(rooms),
            id: 0,
        });

        return [{ responseMsg, broadcast: true }];
    }

    private handleRequestTypeAddToRoom(prsdData: { indexRoom: string }, userId: string) {
        const { indexRoom } = prsdData;
        let responses: Response[] = [];

        const room = db.addUserToRoom(indexRoom, userId);
        if (room && db.roomIsFull(room)) {
            const newGame = db.createGame();
            const userIds = room.roomUsers.map((roomUser) => roomUser.index);

            userIds.forEach((roomUserId) => {
                const responseMsg = jsonStringify({
                    type: 'create_game',
                    data: jsonStringify({
                        idGame: newGame.gameId,
                        idPlayer: roomUserId,
                    }),
                    id: 0,
                });

                responses.push({
                    responseMsg,
                    to: userIds,
                });
            });
        }

        return responses;
    }
}
