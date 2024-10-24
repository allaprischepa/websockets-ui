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

interface Ship {
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

class Database {
    private users: User[] = [];
    private rooms: Room[] = [];
    private games: Game[] = [];
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

    addUserToRoom(roomId: string, userId: string): Room | null {
        const userInd = this.users.findIndex((user) => user.id === userId);
        const roomInd = this.rooms.findIndex((room) => room.roomId === roomId);
        const room = roomInd !== -1 ? this.rooms[roomInd] : null;
        const user = userInd !== -1 ? this.users[userInd] : null;

        if (room && user && !this.userInRoom(user, room)) {
            room.roomUsers.push({ name: user.name, index: user.id });
        }

        return room;
    }

    roomIsFull(room: Room) {
        return room.roomUsers.length > 1;
    }

    getAvailableRooms(): Room[] {
        return this.rooms.filter((room) => room.roomUsers.length < 2);
    }

    createGame() {
        const newGame = {
            gameId: randomUUID(),
        };

        return newGame;
    }

    private userInRoom(user: User, room: Room) {
        const userInd = room.roomUsers.findIndex((userInRoom) => userInRoom.index === user.id);

        return userInd !== -1;
    }
}

const db = new Database();

export default db;
