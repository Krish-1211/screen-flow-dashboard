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

// Modular Imports
import prisma from './src/db/client.js';
import { playerController } from './src/controllers/playerController.js';
import { getActivePlaylist, enrichPlaylistData, enrichMedia } from './src/scheduler/engine.js';

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

// ── Step 4: Player Engine Endpoints (Refactored) ──
app.get('/screens/player', playerController.getPlaylist);
app.post('/screens/heartbeat', playerController.heartbeat);

// ── Step 5: Screen Management API ──
app.get(['/screens', '/screens/'], async (req, res) => {
    try {
        const screens = await prisma.screen.findMany({ include: { group: true } });
        const mapped = await Promise.all(screens.map(async s => {
            const active = await getActivePlaylist(s);
            return {
                id: s.id,
                name: s.name,
                status: s.status,
                lastPing: s.lastSeen,
                playlistId: s.currentPlaylistId,
                device_id: s.deviceId,
                groupId: s.groupId,
                group_name: s.group ? s.group.name : "Unassigned",
                active_playlist_name: active ? active.name : "None",
            };
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/screens/register', async (req, res) => {
    const { name, deviceId, playlist_id } = req.body;
    const s = await prisma.screen.upsert({
        where: { deviceId: deviceId || `dev_${Date.now()}` },
        update: { name, currentPlaylistId: playlist_id },
        create: { 
            name: name || "New Screen", 
            deviceId: deviceId || `dev_${Date.now()}`,
            currentPlaylistId: playlist_id
        }
    });
    res.json(s);
});

app.put('/screens/:id', async (req, res) => {
    const { name, playlist_id, status, groupId } = req.body;
    const s = await prisma.screen.update({
        where: { id: req.params.id },
        data: { 
            name, 
            currentPlaylistId: playlist_id,
            status: status || undefined,
            groupId: groupId === "null" ? null : (groupId || undefined)
        }
    });
    io.emit('playlist-updated');
    res.json(s);
});

app.delete('/screens/:id', async (req, res) => {
    await prisma.screen.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

app.put('/screens/bulk', async (req, res) => {
    try {
        const { screen_ids, playlist_id } = req.body;
        const count = await prisma.screen.updateMany({
            where: { id: { in: screen_ids } },
            data: { currentPlaylistId: playlist_id }
        });
        io.emit('playlist-updated');
        res.json({ updated: count.count, playlist_id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Step 6: Groups API ──
app.get('/groups', async (req, res) => {
    const groups = await prisma.group.findMany({
        include: { _count: { select: { screens: true } } }
    });
    res.json(groups.map(g => ({ ...g, screen_count: g._count.screens })));
});

app.post('/groups', async (req, res) => {
    const { name } = req.body;
    try {
        const group = await prisma.group.create({ data: { name } });
        res.json(group);
    } catch (e) {
        res.status(400).json({ error: "Group already exists" });
    }
});

app.delete('/groups/:id', async (req, res) => {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

// ── Step 7: Media & Playlists ──
app.get('/media', async (req, res) => {
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(media.map(m => enrichMedia(m)));
});

app.post('/media/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);

        const host = req.get('host');
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const url = `${protocol}://${host}/uploads/${fileName}`;
        
        const media = await prisma.media.create({
            data: {
                name: req.body.name || req.file.originalname,
                type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
                url: url,
            }
        });
        io.emit('playlist-updated');
        res.json(enrichMedia(media));
    } catch (e) {
        res.status(500).json({ error: "Failed to upload file" });
    }
});

app.post('/media/youtube', async (req, res) => {
    try {
        const { url, name } = req.body;
        const media = await prisma.media.create({
            data: {
                name: name || "YouTube Video",
                type: 'youtube',
                url: url,
            }
        });
        io.emit('playlist-updated');
        res.json(enrichMedia(media));
    } catch (e) {
        res.status(500).json({ error: "Failed to add YouTube video" });
    }
});

app.patch('/media/:id/rename', async (req, res) => {
    try {
        const { name } = req.body;
        const media = await prisma.media.update({
            where: { id: req.params.id },
            data: { name }
        });
        res.json(enrichMedia(media));
    } catch (e) {
        res.status(500).json({ error: "Failed to rename media" });
    }
});

app.delete('/media/:id', async (req, res) => {
    try {
        await prisma.media.delete({ where: { id: req.params.id } });
        io.emit('playlist-updated');
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: "Failed to delete media" });
    }
});

app.get('/playlists', async (req, res) => {
    const pl = await prisma.playlist.findMany({ include: { items: true } });
    for (const p of pl) { await enrichPlaylistData(p); }
    res.json(pl);
});

app.post('/playlists', async (req, res) => {
    const { name, items } = req.body;
    const newPl = await prisma.playlist.create({ data: { name: name || "New Playlist" } });
    if (items?.length > 0) {
        await prisma.playlistItem.createMany({
            data: items.map((it, i) => ({
                playlistId: newPl.id,
                mediaId: it.mediaId || it.media_id,
                order: i,
                duration: it.duration || 10
            }))
        });
    }
    res.json(newPl);
});

// ── Step 8: Schedules ──
app.get('/schedules', async (req, res) => {
    const schedules = await prisma.schedule.findMany();
    res.json(schedules.map(s => ({
        ...s,
        days_of_week: JSON.parse(s.daysOfWeek),
    })));
});

app.post('/schedules', async (req, res) => {
    const { screen_id, playlist_id, days_of_week, start_time, end_time } = req.body;
    const sch = await prisma.schedule.create({
        data: {
            screenId: screen_id,
            playlistId: playlist_id,
            daysOfWeek: JSON.stringify(days_of_week || []),
            startTime: start_time,
            endTime: end_time
        }
    });
    io.emit('playlist-updated');
    res.json(sch);
});

// ── Step 9: Launch ──
app.get('/health', (req, res) => res.json({ status: "ok", service: "backend" }));

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Backend Server running on port ${PORT}`);
});
