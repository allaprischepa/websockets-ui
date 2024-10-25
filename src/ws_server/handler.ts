import { RawData } from 'ws';
import { jsonParse, jsonStringify, log, rawDataToStr } from '../utils/utils';
import db, { Ship } from '../db';

export interface Response {
    responseMsg: string;
    broadcast?: boolean; // if we send to all clients
    to?: string[]; // if we send to particular clients
}

export class WsHandler {
    handleRequest(
        rawData: RawData,
        userId: string,
        loggedUsers: string[] = []
    ): { responses: Response[]; currentUserId: string } {
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
                        const { eventResponses, id } = this.handleRequestTypeReg(prsdData, loggedUsers);
                        const eventResponses2 = this.handleResponseTypeUpdateRoom();
                        const eventResponses3 = this.handleResponseTypeUpdateWinners();
                        currentUserId = id;

                        responses.push(...eventResponses, ...eventResponses2, ...eventResponses3);
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
                case 'add_ships':
                    if (prsdData) {
                        const eventResponses = this.handleRequestTypeAddShips(prsdData);
                        const eventResponses2 = this.handleResponseTypeUpdateRoom();

                        responses.push(...eventResponses, ...eventResponses2);
                    }
                    break;
            }
        }

        return { responses, currentUserId };
    }

    removeUserFromRoomsAndGames(userId: string): Response[] {
        db.removeUserFromRooms(userId);
        const gameToFinish = db.removeUserFromGames(userId);
        const responses: Response[] = [];

        if (gameToFinish) {
            const winnerId = gameToFinish.ships.filter((shipsArr) => shipsArr.indexPlayer !== userId)[0].indexPlayer;
            db.addWinner(winnerId);

            const responseMsg = jsonStringify({
                type: 'finish',
                data: jsonStringify({ winPlayer: winnerId }),
                id: 0,
            });
            responses.push({ responseMsg, to: [winnerId] });

            const eventResponses = this.handleResponseTypeUpdateWinners();
            responses.push(...eventResponses);
        }

        return responses;
    }

    private handleRequestTypeReg(prsdData: { name: string; password: string }, loggedUsers: string[]) {
        const { name, password } = prsdData;
        let user = db.getUserByName(name);
        let responseMsg = '';
        let error = false;
        let errorText = '';

        if (user) {
            if (password !== user.password) {
                error = true;
                errorText = 'Incorrect password';
            } else if (loggedUsers.includes(user.id)) {
                error = true;
                errorText = 'You already logged in';
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
            id: error ? '' : user.id,
        };
    }

    private handleRequestTypeCreateRoom(userId: string) {
        const userRoom = db.getUserRoom(userId);

        if (!userRoom) {
            const newRoom = db.createRoom();
            db.addUserToRoom(newRoom.roomId, userId);
        }

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
                    to: [roomUserId],
                });
            });
        }

        return responses;
    }

    private handleRequestTypeAddShips(prsdData: { gameId: string; ships: Ship[]; indexPlayer: string }) {
        const { gameId, ships, indexPlayer } = prsdData;
        const game = db.addUserShipsToGame(gameId, ships, indexPlayer);
        const responses: Response[] = [];

        if (game) {
            const playersIds = db.getGamePlayersIds(game);

            if (playersIds.length === 2) {
                playersIds.forEach((id) => {
                    const responseMsg = jsonStringify({
                        type: 'start_game',
                        data: jsonStringify({
                            ships: db.getPlayerShips(game, id),
                            currentPlayerIndex: id,
                        }),
                        id: 0,
                    });

                    responses.push({ responseMsg, to: [id] });
                });
            }
        }

        return responses;
    }

    private handleResponseTypeUpdateWinners() {
        const winners = db.getWinners();
        const responseMsg = jsonStringify({
            type: 'update_winners',
            data: jsonStringify(winners),
            id: 0,
        });

        return [{ responseMsg, broadcast: true }];
    }
}
