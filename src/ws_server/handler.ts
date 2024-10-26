import { RawData } from 'ws';
import { jsonParse, jsonStringify, log, rawDataToStr } from '../utils/utils';
import db, { Ship } from '../db';

export interface Response {
    responseMsg: string;
    broadcast?: boolean; // if we send to all clients
    to?: string[]; // if we send to particular clients
}

interface ReqDataReg {
    name: string;
    password: string;
}

interface ReqDataAddToRoom {
    indexRoom: string;
}

interface ReqDataAddShips {
    gameId: string;
    ships: Ship[];
    indexPlayer: string;
}

interface ReqDataAttack {
    gameId: string;
    x: number;
    y: number;
    indexPlayer: string;
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
                case 'attack':
                case 'randomAttack':
                    if (prsdData) {
                        const eventResponses = this.handleRequestTypeAttack(prsdData, type === 'randomAttack');

                        responses.push(...eventResponses);
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
            const winnerId = gameToFinish.players.filter((playerId) => playerId !== userId)[0];

            if (winnerId) {
                db.addWinner(winnerId);

                const responseMsg = this.createResponseMessage('finish', { winPlayer: winnerId });
                responses.push({ responseMsg, to: [winnerId] });

                const eventResponses = this.handleResponseTypeUpdateWinners();
                responses.push(...eventResponses);
            }
        }

        return responses;
    }

    private handleRequestTypeReg(prsdData: ReqDataReg, loggedUsers: string[]) {
        const { name, password } = prsdData;
        let user = db.getUserByName(name);
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

        const responseMsg = this.createResponseMessage('reg', { user, error, errorText });

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
        const responseMsg = this.createResponseMessage('update_room', rooms);

        return [{ responseMsg, broadcast: true }];
    }

    private handleRequestTypeAddToRoom(prsdData: ReqDataAddToRoom, userId: string) {
        const { indexRoom } = prsdData;
        let responses: Response[] = [];

        const room = db.addUserToRoom(indexRoom, userId);
        if (room && db.roomIsFull(room)) {
            const userIds = room.roomUsers.map((roomUser) => roomUser.index);
            const newGame = db.createGame(userIds);

            userIds.forEach((roomUserId) => {
                const responseMsg = this.createResponseMessage('create_game', {
                    idGame: newGame.gameId,
                    idPlayer: roomUserId,
                });

                responses.push({
                    responseMsg,
                    to: [roomUserId],
                });
            });
        }

        return responses;
    }

    private handleRequestTypeAddShips(prsdData: ReqDataAddShips) {
        const { gameId, ships, indexPlayer } = prsdData;
        const game = db.addUserShipsToGame(gameId, ships, indexPlayer);
        const responses: Response[] = [];

        if (game) {
            const playersIds = db.getGamePlayersIds(game);

            if (playersIds.length === 2) {
                const nextTurn = playersIds.filter((id) => id !== game.turn)[0];

                playersIds.forEach((id) => {
                    const responseMsg1 = this.createResponseMessage('start_game', {
                        ships: db.getPlayerShips(game, id),
                        currentPlayerIndex: id,
                    });

                    responses.push({ responseMsg: responseMsg1, to: [id] });
                });

                game.turn = nextTurn;
                const responseMsg2 = this.createResponseMessage('turn', { currentPlayer: nextTurn });

                responses.push({ responseMsg: responseMsg2, to: playersIds });
            }
        }

        return responses;
    }

    private handleResponseTypeUpdateWinners() {
        const winners = db.getWinners();
        const responseMsg = this.createResponseMessage('update_winners', winners);

        return [{ responseMsg, broadcast: true }];
    }

    private handleRequestTypeAttack(prsdData: ReqDataAttack, random = false) {
        const { gameId, indexPlayer } = prsdData;
        let { x, y } = prsdData;
        const game = db.getGameById(gameId);
        const responses: Response[] = [];

        if (game && (!game.turn || indexPlayer === game.turn)) {
            if (random) {
                const randomPos = db.getRandomEnemyPosition(game, indexPlayer);
                x = randomPos.x;
                y = randomPos.y;
            }

            const playersIds = db.getGamePlayersIds(game);
            const { result, extraMove, win } = db.performAttack(game, { x, y }, indexPlayer);
            const nextTurn = extraMove ? indexPlayer : playersIds.filter((id) => id !== game.turn)[0];

            if (result) {
                result.forEach((res) => {
                    playersIds.forEach((playerId) => {
                        const responseMsg = this.createResponseMessage('attack', {
                            position: res.position,
                            currentPlayer: indexPlayer,
                            status: res.status,
                        });

                        responses.push({ responseMsg, to: [playerId] });
                    });
                });

                if (win) {
                    db.addWinner(indexPlayer);
                    playersIds.forEach((playerId) => {
                        db.removeUserFromRooms(playerId);
                        db.removeUserFromGames(playerId);
                    });
                    const eventResponses = this.handleResponseTypeUpdateWinners();
                    const responseMsg = this.createResponseMessage('finish', { winPlayer: indexPlayer });

                    responses.push({ responseMsg, to: playersIds }, ...eventResponses);
                } else {
                    game.turn = nextTurn;
                    const responseMsg2 = this.createResponseMessage('turn', { currentPlayer: nextTurn });

                    responses.push({ responseMsg: responseMsg2, to: playersIds });
                }
            }
        }

        return responses;
    }

    private createResponseMessage(type: string, data: unknown): string {
        return jsonStringify({
            type,
            data: jsonStringify(data),
            id: 0,
        });
    }
}
