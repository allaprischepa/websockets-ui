import { randomUUID } from 'crypto';

interface User {
    id: string;
    name: string;
    password: string;
}

interface Room {
    roomId: string;
    roomUsers: { name: string; index: string }[];
}

export interface Ship {
    position: {
        x: number;
        y: number;
    };
    direction: boolean;
    length: number;
    type: 'small' | 'medium' | 'large' | 'huge';
}

interface Game {
    gameId: string;
    ships: { indexPlayer: string; playerShips: Ship[] }[];
}

interface Winner {
    name: string;
    wins: number;
}

class Database {
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

    createGame() {
        const newGame = {
            gameId: randomUUID(),
            ships: [],
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
            ships = game.ships.filter((shipsArr) => shipsArr.indexPlayer === userId)[0].playerShips;
        }

        return ships;
    }

    getUserGame(userId: string): Game | null {
        const gameInd = this.games.findIndex((game) => {
            return this.userInGame(userId, game);
        });

        return gameInd !== -1 ? this.games[gameInd] : null;
    }

    removeUserFromRooms(userId: string) {
        this.rooms = this.rooms.filter((room) => {
            return !this.userInRoom(userId, room) && room.roomUsers.length;
        });
    }

    removeUserFromGames(userId: string): Game | null {
        const userGame = this.getUserGame(userId);

        if (userGame) {
            this.games = this.games.filter((game) => game !== userGame);
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
            const userInd = game.ships.findIndex((shipsArr) => shipsArr.indexPlayer === userId);
            result = userInd !== -1;
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

    private getGameById(gameId: string): Game | null {
        const gameInd = this.games.findIndex((game) => game.gameId === gameId);
        const game = gameInd !== -1 ? this.games[gameInd] : null;

        return game;
    }

    private userIsInWinnersList(_user: string | User): boolean {
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;
        const userInd = this.winners.findIndex((winner) => winner.name === user?.name);

        return userInd !== -1;
    }
}

const db = new Database();

export default db;
