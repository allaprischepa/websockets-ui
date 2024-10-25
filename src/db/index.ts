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
        };

        return newGame;
    }

    getUserRoom(userId: string): Room | null {
        const roomInd = this.rooms.findIndex((room) => {
            const roomUsers = this.getRoomUsers(room);

            return roomUsers.includes(userId);
        });

        return roomInd !== -1 ? this.rooms[roomInd] : null;
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

    private removeUserFromRoom(_room: string | Room, _user: string | User) {
        const room = typeof _room === 'string' ? this.getRoomById(_room) : _room;
        const user = typeof _user === 'string' ? this.getUserById(_user) : _user;

        if (room && user) {
            room.roomUsers = room.roomUsers.filter((roomUser) => roomUser.index !== user.id);
        }
    }
}

const db = new Database();

export default db;
