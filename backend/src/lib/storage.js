import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('src/storage/db.json');

export const readDB = () => {
    if (!fs.existsSync(DB_PATH)) {
        const initial = { screens: [], playlists: [], media: [], schedules: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
};

export const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

export const updateSection = (section, data) => {
    const db = readDB();
    db[section] = data;
    writeDB(db);
};
