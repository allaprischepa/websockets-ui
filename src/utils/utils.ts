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
