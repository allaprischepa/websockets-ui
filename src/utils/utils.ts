import { RawData } from 'ws';

export function rawDataToStr(rawData: RawData) {
    return rawData.toString('utf-8');
}

export function jsonParse(data: string) {
    let res;

    try {
        res = JSON.parse(data);
    } catch {
        res = null;
    }

    return res;
}

export function jsonStringify(obj: unknown) {
    return JSON.stringify(obj);
}

export const log = {
    red: (text: string) => console.log('\x1b[31m' + text + '\x1b[0m'),
    green: (text: string) => console.log('\x1b[32m' + text + '\x1b[0m'),
    yellow: (text: string) => console.log('\x1b[33m' + text + '\x1b[0m'),
    blue: (text: string) => console.log('\x1b[34m' + text + '\x1b[0m'),
    magenta: (text: string) => console.log('\x1b[35m' + text + '\x1b[0m'),
};
