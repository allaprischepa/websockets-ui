import { RawData } from 'ws';
import { jsonParse, jsonStringify, rawDataToStr } from '../utils/utils';
import db from '../db';

export interface Response {
    responseMsg: string;
    broadcast?: boolean;
}

export class WsHandler {
    handleRequest(rawData: RawData, userId: string): { responses: Response[]; currentUserId: string } {
        const responses = [];
        let currentUserId = userId;
        const msg = jsonParse(rawDataToStr(rawData));
        const { type, data } = msg;
        const prsdData = jsonParse(data);

        if (type) {
            switch (type) {
                case 'reg':
                    if (prsdData) {
                        const { response, id } = this.handleRequestTypeReg(prsdData);
                        currentUserId = id;

                        responses.push(response);
                        responses.push(this.handleResponseTypeUpdateRoom());
                    }

                    break;
                case 'create_room':
                    this.handleRequestTypeCreateRoom(currentUserId);
                    responses.push(this.handleResponseTypeUpdateRoom());
                    break;
                case 'add_user_to_room':
                    if (prsdData) {
                        this.handleRequestTypeAddToRoom(prsdData, currentUserId);
                        responses.push(this.handleResponseTypeUpdateRoom());
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
            response: { responseMsg },
            id: user.id,
        };
    }

    private handleRequestTypeCreateRoom(userId: string) {
        const newRoom = db.createRoom();
        db.addUserToRoom(newRoom.roomId, userId);
    }

    private handleResponseTypeUpdateRoom() {
        const rooms = db.getAvailableRooms();
        const responseMsg = jsonStringify({
            type: 'update_room',
            data: jsonStringify(rooms),
            id: 0,
        });

        return {
            responseMsg,
            broadcast: true,
        };
    }

    private handleRequestTypeAddToRoom(prsdData: { indexRoom: string }, userId: string) {
        const { indexRoom } = prsdData;
        db.addUserToRoom(indexRoom, userId);
    }
}
