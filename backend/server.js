import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { readDB, writeDB } from './src/lib/storage.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const upload = multer();

// ── Step 1: Middleware ──
app.use(cors({
    origin: ["https://screenflow-dashboard.onrender.com", "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json());
app.use(pinoHttp({ logger }));

// ── Step 2: Static Files (Media) ──
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ── Step 3: Auth API ──
app.post('/auth/token', upload.none(), (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUser && password === adminPass) {
        const secret = process.env.JWT_SECRET_KEY || 'dev_secret_key_change_me_in_production';
        const token = jwt.sign({ sub: username, role: 'admin' }, secret, { expiresIn: '7d' });
        return res.json({ access_token: token, token_type: "bearer" });
    }
    return res.status(401).json({ detail: "Incorrect username or password" });
});

// ── Step 4: Simple Storage API ──

// Generic Helper
const getSection = (name) => readDB()[name] || [];
const saveSection = (name, data) => {
    const db = readDB();
    db[name] = data;
    writeDB(db);
};

// SCREENS
app.get('/screens', (req, res) => res.json(getSection('screens')));
app.post('/screens', (req, res) => {
    const db = readDB();
    const screen = { id: Date.now().toString(), ...req.body, status: 'online', lastPing: new Date().toISOString() };
    db.screens.push(screen);
    writeDB(db);
    res.json(screen);
});
app.put('/screens/:id', (req, res) => {
    const db = readDB();
    const idx = db.screens.findIndex(s => s.id === req.params.id);
    if (idx > -1) {
        db.screens[idx] = { ...db.screens[idx], ...req.body };
        writeDB(db);
        io.emit('playlist-updated');
        return res.json(db.screens[idx]);
    }
    res.status(404).json({ error: "Not found" });
});
app.delete('/screens/:id', (req, res) => {
    const db = readDB();
    db.screens = db.screens.filter(s => s.id !== req.params.id);
    writeDB(db);
    res.status(204).send();
});

// MEDIA
app.get('/media', (req, res) => res.json(getSection('media')));
app.post('/media/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const fileName = `${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), req.file.buffer);
    
    const db = readDB();
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const media = {
        id: Date.now().toString(),
        name: req.body.name || req.file.originalname,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        url: `${protocol}://${host}/uploads/${fileName}`
    };
    db.media.push(media);
    writeDB(db);
    io.emit('media-updated');
    res.json(media);
});
app.post('/media/youtube', (req, res) => {
    const db = readDB();
    const media = { id: Date.now().toString(), name: req.body.name || "YouTube", type: 'youtube', url: req.body.url };
    db.media.push(media);
    writeDB(db);
    res.json(media);
});
app.delete('/media/:id', (req, res) => {
    const db = readDB();
    db.media = db.media.filter(m => m.id !== req.params.id);
    writeDB(db);
    res.status(204).send();
});

// PLAYLISTS
app.get('/playlists', (req, res) => res.json(getSection('playlists')));
app.post('/playlists', (req, res) => {
    const db = readDB();
    const playlist = { id: Date.now().toString(), ...req.body, items: req.body.items || [] };
    db.playlists.push(playlist);
    writeDB(db);
    res.json(playlist);
});
app.delete('/playlists/:id', (req, res) => {
    const db = readDB();
    db.playlists = db.playlists.filter(p => p.id !== req.params.id);
    writeDB(db);
    res.status(204).send();
});

// SCHEDULES
app.get('/schedules', (req, res) => res.json(getSection('schedules')));
app.post('/schedules', (req, res) => {
    const db = readDB();
    const sch = { id: Date.now().toString(), ...req.body };
    db.schedules.push(sch);
    writeDB(db);
    io.emit('playlist-updated');
    res.json(sch);
});

// PLAYER Heartbeat & Playlist Discovery
app.get('/screens/player', (req, res) => {
    const { device_id } = req.query;
    const db = readDB();
    const screen = db.screens.find(s => s.device_id === device_id || s.id === device_id);
    
    if (!screen) {
        return res.json({ name: "Fallback", items: [] });
    }

    const playlist = db.playlists.find(p => p.id === screen.playlistId);
    if (!playlist) return res.json({ name: "No Content", items: [] });

    // Enrich items with media objects
    const enrichedItems = (playlist.items || []).map(item => {
        const media = db.media.find(m => m.id === item.mediaId);
        return { ...item, media };
    }).filter(it => it.media);

    res.json({ ...playlist, items: enrichedItems });
});

app.post('/screens/heartbeat', (req, res) => {
    const { device_id } = req.body;
    const db = readDB();
    const idx = db.screens.findIndex(s => s.device_id === device_id || s.id === device_id);
    if (idx > -1) {
        db.screens[idx].status = 'online';
        db.screens[idx].lastPing = new Date().toISOString();
        writeDB(db);
    }
    res.status(204).send();
});

// ── Step 5: Launch ──
app.get('/health', (req, res) => res.json({ status: "ok", storage: "json" }));

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Lightweight Backend running on port ${PORT}`);
});
