import { randomUUID } from 'crypto';
import { getRandomInt } from '../utils/utils';

interface User {
    id: string;
    name: string;
    password: string;
}

interface Room {
    roomId: string;
    roomUsers: { name: string; index: string }[];
}

export interface Position {
    x: number;
    y: number;
}

export interface Ship {
    position: Position;
    direction: boolean;
    length: number;
    type: 'small' | 'medium' | 'large' | 'huge';
}

interface ShipExtended {
    positions: Position[];
    shotDown: Position[];
    around: Position[];
    played: Position[];
    killed: boolean;
}
interface Game {
    gameId: string;
    ships: {
        indexPlayer: string;
        playerShips: Ship[];
        shipsExtended: ShipExtended[];
    }[];
    players: string[];
    turn: string;
    botId: string;
}

interface Winner {
    name: string;
    wins: number;
}

export class Database {
    private users: User[] = [];
    private rooms: Room[] = [];
    private games: Game[] = [];
    private winners: Winner[] = [];
    private static instance: Database;

    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        Database.instance = this;
    }

    createUser(name: string, password: string): User {
        const newUser = {
            id: randomUUID(),
            name,
            password,
        };

        this.users.push(newUser);

        return newUser;
    }

    getUserByName(name: string): User | null {
        const userInd = this.users.findIndex((user) => user.name === name);

        return userInd !== -1 ? this.users[userInd] : null;
    }

    createRoom(): Room {
        const newRoom = { roomId: randomUUID(), roomUsers: [] };
        this.rooms.push(newRoom);

        return newRoom;
    }

    addUserToRoom(_room: string | Room, _user: string | User): Room | null {
        const room = typeof _room === 'string' ? this.getRoomById(_room) : _room;
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;

        if (room && user && !this.userInRoom(user, room)) {
            const userRoom = this.getUserRoom(user.id);
            if (userRoom) this.removeUserFromRoom(userRoom, user);

            room.roomUsers.push({ name: user.name, index: user.id });
        }

        return room;
    }

    roomIsFull(room: Room) {
        return room.roomUsers.length === 2;
    }

    getAvailableRooms(): Room[] {
        return this.rooms.filter((room) => room.roomUsers.length === 1);
    }

    createGame(userIds: string[], botId = '') {
        const newGame: Game = {
            gameId: randomUUID(),
            ships: [],
            players: userIds,
            turn: '',
            botId,
        };
        this.games.push(newGame);

        return newGame;
    }

    getUserRoom(userId: string): Room | null {
        const roomInd = this.rooms.findIndex((room) => {
            const roomUsers = this.getRoomUsers(room);

            return roomUsers.includes(userId);
        });

        return roomInd !== -1 ? this.rooms[roomInd] : null;
    }

    addUserShipsToGame(_game: string | Game, ships: Ship[], _user: string | User): Game | null {
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        const userId = typeof _user === 'string' ? _user : _user.id;

        if (game) {
            game.ships.push({
                playerShips: ships,
                indexPlayer: userId,
                shipsExtended: this.getShipsExtended(ships),
            });
        }

        return game;
    }

    getGamePlayersIds(_game: string | Game): string[] {
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        let ids: string[] = [];

        if (game) ids = game.ships.map((shipsArr) => shipsArr.indexPlayer);

        return ids;
    }

    getPlayerShips(_game: string | Game, _user: string | User): Ship[] {
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        const userId = typeof _user === 'string' ? _user : _user.id;
        let ships: Ship[] = [];

        if (game) {
            ships = game.ships.filter((shipsArr) => shipsArr.indexPlayer === userId)[0]?.playerShips;
        }

        return ships;
    }

    getUserGame(userId: string): Game | null {
        const gameInd = this.games.findIndex((game) => {
            return this.userInGame(userId, game);
        });

        return gameInd !== -1 ? this.games[gameInd] : null;
    }

    removeUserFromRooms(userId: string): Room | null {
        const userRoom = this.getUserRoom(userId);

        if (userRoom) {
            this.rooms = this.rooms.filter((room) => {
                return !this.userInRoom(userId, room) && room.roomUsers.length;
            });
        }

        return userRoom;
    }

    removeUserFromGames(userId: string): Game | null {
        const userGame = this.getUserGame(userId);

        if (userGame) {
            this.games = this.games.filter((game) => game.gameId !== userGame.gameId);
        }

        return userGame;
    }

    addWinner(_user: string | User): Winner[] {
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;

        if (user) {
            if (this.userIsInWinnersList(user)) {
                this.winners = this.winners.map((winner) => {
                    if (winner.name === user.name) winner.wins++;

                    return winner;
                });
            } else {
                this.winners.push({ name: user.name, wins: 1 });
            }
        }

        return this.winners;
    }

    getWinners(): Winner[] {
        return this.winners;
    }

    performAttack(_game: string | Game, position: Position, indexPlayer: string) {
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        const result: { status: string; position: Position }[] = [];
        let extraMove = false;
        let win = false;

        if (game) {
            const enemyShips = game.ships.find((shipsArr) => shipsArr.indexPlayer !== indexPlayer);

            if (enemyShips) {
                let positionIsUnderShip = false;
                let alreadyPlayed = false;

                enemyShips.shipsExtended.forEach((ship) => {
                    if (!positionIsUnderShip && Database.positionInArray(ship.positions, position)) {
                        positionIsUnderShip = true;
                        alreadyPlayed = Database.positionInArray(ship.played, position);

                        if (!ship.killed) {
                            extraMove = true && !alreadyPlayed;

                            if (ship.positions.length === 1) {
                                ship.shotDown.push(position);
                                ship.killed = true;

                                result.push({ status: 'killed', position });
                                ship.played.push(position);

                                ship.around.forEach((aroundPos) => {
                                    result.push({ status: 'miss', position: aroundPos });
                                    ship.played.push(aroundPos);
                                });
                            } else {
                                if (!Database.positionInArray(ship.shotDown, position)) ship.shotDown.push(position);

                                if (ship.positions.length === ship.shotDown.length) {
                                    ship.killed = true;

                                    ship.positions.forEach((shipPos) => {
                                        result.push({ status: 'killed', position: shipPos });
                                        if (!Database.positionInArray(ship.played, shipPos)) ship.played.push(shipPos);
                                    });

                                    ship.around.forEach((aroundPos) => {
                                        result.push({ status: 'miss', position: aroundPos });
                                        if (!Database.positionInArray(ship.played, aroundPos)) {
                                            ship.played.push(aroundPos);
                                        }
                                    });
                                } else {
                                    result.push({ status: 'shot', position });
                                    ship.played.push(position);
                                }
                            }
                        }
                    }
                });

                if (!positionIsUnderShip) result.push({ status: 'miss', position });

                const stillAliveShips = enemyShips.shipsExtended.filter((ship) => !ship.killed);
                if (stillAliveShips.length === 0) win = true;
            }
        }

        return { result, extraMove, win };
    }

    getRandomEnemyPosition(_game: string | Game, indexPlayer: string) {
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        let x = getRandomInt(9);
        let y = getRandomInt(9);

        if (game) {
            const enemyShips = game.ships.find((shipsArr) => shipsArr.indexPlayer !== indexPlayer);

            if (enemyShips) {
                const played: Position[] = [];
                enemyShips.shipsExtended.forEach((ship) => played.push(...ship.played));

                while (Database.positionInArray(played, { x, y })) {
                    x = getRandomInt(9);
                    y = getRandomInt(9);
                }
            }
        }

        return { x, y };
    }

    static positionInArray(positionsArr: Position[], position: Position) {
        return positionsArr.filter((pos) => pos.x === position.x && pos.y === position.y).length > 0;
    }

    private getRoomById(roomId: string): Room | null {
        const roomInd = this.rooms.findIndex((room) => room.roomId === roomId);
        const room = roomInd !== -1 ? this.rooms[roomInd] : null;

        return room;
    }

    private getUserById(userId: string): User | null {
        const userInd = this.users.findIndex((user) => user.id === userId);
        const user = userInd !== -1 ? this.users[userInd] : null;

        return user;
    }

    private getRoomUsers(room: Room) {
        return room.roomUsers.map((roomUser) => roomUser.index);
    }

    private userInRoom(_user: string | User, _room: string | Room) {
        const userId = typeof _user === 'string' ? _user : _user.id;
        const room = typeof _room === 'string' ? this.getRoomById(_room) : _room;
        let result = false;

        if (room) {
            const userInd = room.roomUsers.findIndex((userInRoom) => userInRoom.index === userId);
            result = userInd !== -1;
        }

        return result;
    }

    private userInGame(_user: string | User, _game: string | Game) {
        const userId = typeof _user === 'string' ? _user : _user.id;
        const game = typeof _game === 'string' ? this.getGameById(_game) : _game;
        let result = false;

        if (game) {
            result = game.players.includes(userId);
        }

        return result;
    }

    private removeUserFromRoom(_room: string | Room, _user: string | User) {
        const room = typeof _room === 'string' ? this.getRoomById(_room) : _room;
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;

        if (room && user) {
            room.roomUsers = room.roomUsers.filter((roomUser) => roomUser.index !== user.id);
        }
    }

    getGameById(gameId: string): Game | null {
        const gameInd = this.games.findIndex((game) => game.gameId === gameId);
        const game = gameInd !== -1 ? this.games[gameInd] : null;

        return game;
    }

    private userIsInWinnersList(_user: string | User): boolean {
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;
        const userInd = this.winners.findIndex((winner) => winner.name === user?.name);

        return userInd !== -1;
    }

    private getShipsExtended(ships: Ship[]): ShipExtended[] {
        const shipsExtended: ShipExtended[] = [];

        ships.forEach((ship) => {
            shipsExtended.push(Database.getShipExtended(ship));
        });

        return shipsExtended;
    }

    static getShipExtended(ship: Ship) {
        const {
            position: { x, y },
            length,
            direction,
        } = ship;
        const positions: Position[] = [];
        const around: Position[] = [];

        if (direction) {
            for (let y1 = y; y1 < y + length; y1++) {
                // Set ship positions
                positions.push({ x, y: y1 });

                if (x - 1 >= 0) around.push({ x: x - 1, y: y1 }); // Set around positions from left
                if (x + 1 <= 9) around.push({ x: x + 1, y: y1 }); // Set around positions from right
            }

            for (let x1 = x - 1; x1 <= x + 1; x1++) {
                if (x1 >= 0 && x1 <= 9) {
                    if (y - 1 >= 0) around.push({ x: x1, y: y - 1 }); // Set around positions from above
                    if (y + length <= 9) around.push({ x: x1, y: y + length }); // Set around positions from below
                }
            }
        } else {
            for (let x1 = x; x1 < x + length; x1++) {
                // Set ship positions
                positions.push({ x: x1, y });

                if (y - 1 >= 0) around.push({ x: x1, y: y - 1 }); // Set around positions from above
                if (y + 1 <= 9) around.push({ x: x1, y: y + 1 }); // Set around positions from below
            }

            for (let y1 = y - 1; y1 <= y + 1; y1++) {
                if (y1 >= 0 && y1 <= 9) {
                    if (x - 1 >= 0) around.push({ x: x - 1, y: y1 }); // Set around positions from left
                    if (x + length <= 9) around.push({ x: x + length, y: y1 }); // Set around positions from below
                }
            }
        }

        return {
            positions,
            shotDown: [],
            around,
            played: [],
            killed: false,
        };
    }
}

const db = new Database();

export default db;
