import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import pkg from '@prisma/client';
import pino from 'pino';
import { z } from 'zod';
import multer from 'multer';
import jwt from 'jsonwebtoken';
const { PrismaClient } = pkg;

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

const prisma = new PrismaClient();
const app = express();
const upload = multer();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:8080'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// PHASE 9: LOGGING (API Requests)
app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins.includes('*') ? "*" : allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// PHASE 3: HEARTBEAT SYSTEM BACKGROUND JOB
setInterval(async () => {
    try {
        const now = new Date();
        const staleLimit = new Date(now.getTime() - 60000); // 60 seconds

        const offlineScreens = await prisma.screen.findMany({
            where: {
                lastSeen: { lt: staleLimit },
                status: 'online'
            }
        });

        if (offlineScreens.length > 0) {
            await prisma.screen.updateMany({
                where: { id: { in: offlineScreens.map(s => s.id) } },
                data: { status: 'offline' }
            });

            offlineScreens.forEach(s => {
                logger.info({ screenId: s.id }, 'Screen went offline due to heartbeat timeout');
                // PHASE 7: Emit updates only to affected screens
                io.emit('screen-status-updated', { screenId: s.id, status: 'offline' });
                io.to(s.id).emit('screen-status-updated', { status: 'offline' });
            });
        }
    } catch (err) {
        logger.error({ err }, 'Error in heartbeat job');
    }
}, 30000);

// PHASE 8: Populate Media
async function enrichPlaylistData(playlist) {
    if (!playlist) return null;
    const mediaIds = playlist.items.map(item => item.mediaId);
    
    // Fetch related media
    const mediaRefs = await prisma.media.findMany({
        where: { id: { in: mediaIds } }
    });
    
    // Normalize order automatically and skip missing media
    playlist.items.sort((a, b) => a.order - b.order);
    
    const enrichedItems = playlist.items.reduce((acc, item) => {
        const media = mediaRefs.find(m => m.id === item.mediaId);
        if (media) { // if missing -> skip item
            acc.push({
                mediaId: item.mediaId,
                type: media.type,
                url: media.url,
                duration: item.duration || media.duration || 10,
                order: acc.length // Normalize order
            });
        }
        return acc;
    }, []);

    return {
        id: playlist.id,
        items: enrichedItems
    };
}

// PHASE 4: SCHEDULING ENGINE
async function getActivePlaylist(screen) {
    if (!screen) return null;

    const schedules = await prisma.schedule.findMany({
        where: { screenId: screen.id }
    });

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMin}`;
    const currentWeekday = now.getDay();

    const validSchedules = schedules.filter(sch => {
        let days = [];
        try { days = JSON.parse(sch.daysOfWeek); } 
        catch { days = sch.daysOfWeek.split(',').map(n => parseInt(n.trim(), 10)); }

        if (!days.includes(currentWeekday)) return false;
        if (currentTime < sch.startTime || currentTime > sch.endTime) return false;
        return true;
    });

    if (validSchedules.length > 0) {
        const activeSchedule = validSchedules[0];
        const playlist = await prisma.playlist.findUnique({
            where: { id: activeSchedule.playlistId },
            include: { items: true }
        });
        if (playlist) return await enrichPlaylistData(playlist);
    }

    // fallback
    if (screen.currentPlaylistId) {
        const fallbackPlaylist = await prisma.playlist.findUnique({
            where: { id: screen.currentPlaylistId },
            include: { items: true }
        });
        if (fallbackPlaylist) return await enrichPlaylistData(fallbackPlaylist);
    }

    return null;
}

// ----------------- CRUD API -----------------

// Authentication
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

// Screens
app.get('/screens', async (req, res) => {
    try {
        let screens = await prisma.screen.findMany();
        if (req.path === '/screens/') {
            // Frontend workaround
        }
        res.json(screens);
    } catch (e) {
        logger.error({ err: e }, 'Get Screens Error');
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Allow fetching with a trailing slash as per screens.ts frontend mapping
app.get('/screens/', async (req, res) => {
    try {
        const screens = await prisma.screen.findMany();
        res.json(screens);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PHASE 5: PLAYER CONFIG API
app.get('/screens/player', async (req, res) => {
    const deviceId = req.query.device_id;
    if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: "device_id is required" });
    }

    try {
        const screen = await prisma.screen.findUnique({
            where: { deviceId: deviceId }
        });

        if (!screen) {
            return res.status(404).json({ error: "Screen not found" });
        }

        const activePlaylist = await getActivePlaylist(screen);
        
        // Empty Playlist Handling (Phase 8 edge case)
        if (!activePlaylist || !activePlaylist.items || activePlaylist.items.length === 0) {
            return res.json({
                playlist: {
                    id: "fallback",
                    items: [
                        { type: "image", url: "https://via.placeholder.com/1920x1080?text=No+Content", duration: 10 }
                    ]
                }
            });
        }

        res.json({ playlist: activePlaylist });
    } catch (e) {
        logger.error({ err: e }, 'Player Config Error');
        res.status(500).json({ error: "Internal error" });
    }
});

app.get('/screens/:id', async (req, res) => {
    const screen = await prisma.screen.findUnique({ where: { id: req.params.id } });
    if (!screen) return res.status(404).json({ error: "Not found" });
    res.json(screen);
});

app.post('/screens/register', async (req, res) => {
    try {
        const newScreen = await prisma.screen.create({ 
            data: { 
                name: req.body.name || "New Screen", 
                deviceId: req.body.device_id || `dev_${Date.now()}`,
                status: 'offline',
                currentPlaylistId: req.body.playlist_id?.toString() || null
            } 
        });
        io.emit('screen-status-updated', { screenId: newScreen.id, status: 'offline' });
        res.json(newScreen);
    } catch (e) {
        logger.error(e, 'Register error');
        res.status(500).json({ error: "Failed to create" });
    }
});
app.put('/screens/:id', async (req, res) => {
    try {
        const dataPayload = {};
        if (req.body.name) dataPayload.name = req.body.name;
        if (req.body.playlist_id) dataPayload.currentPlaylistId = req.body.playlist_id.toString();

        const updated = await prisma.screen.update({
            where: { id: req.params.id },
            data: dataPayload
        });
        io.emit('screen-status-updated', { screenId: updated.id, status: updated.status });
        if (dataPayload.currentPlaylistId) {
            io.to(updated.id).emit('playlist-updated');
        }
        res.json(updated);
    } catch (e) {
        res.status(404).json({ error: "Not found" });
    }
});
app.delete('/screens/:id', async (req, res) => {
    try {
        await prisma.screen.delete({ where: { id: req.params.id } });
        io.emit('screen-status-updated', { screenId: req.params.id, status: 'deleted' });
        res.status(204).send();
    } catch {
        res.status(404).json({ error: "Not found" });
    }
});

// Media
app.get('/media', async (req, res) => {
    const media = await prisma.media.findMany();
    res.json(media);
});
app.delete('/media/:id', async (req, res) => {
    await prisma.media.delete({ where: { id: req.params.id } }).catch(() => {});
    io.emit('playlist-updated');
    res.status(204).send();
});

// Playlists
app.get('/playlists', async (req, res) => {
    const pl = await prisma.playlist.findMany({ include: { items: { orderBy: { order: 'asc' } } } });
    for (const p of pl) { await enrichPlaylistData(p); }
    res.json(pl);
});
app.get('/playlists/:id', async (req, res) => {
    const p = await prisma.playlist.findUnique({
        where: { id: req.params.id },
        include: { items: { orderBy: { order: 'asc' } } }
    });
    if (!p) return res.status(404).json({ error: "Playlist not found" });
    await enrichPlaylistData(p);
    res.json(p);
});
app.post('/playlists', async (req, res) => {
    try {
        const newPl = await prisma.playlist.create({
            data: { name: req.body.name || 'New Playlist' }
        });
        if (req.body.items && req.body.items.length > 0) {
            const items = req.body.items.map((item, i) => ({
                playlistId: newPl.id, mediaId: item.mediaId, order: i, duration: item.duration || null
            }));
            await prisma.playlistItem.createMany({ data: items });
        }
        res.json(newPl);
    } catch (e) { res.status(500).json({ error: "Failed to create playlist" }); }
});
app.put('/playlists/:id', async (req, res) => {
    try {
        const updated = await prisma.playlist.update({
            where: { id: req.params.id },
            data: { name: req.body.name }
        });
        if (req.body.items) {
            await prisma.playlistItem.deleteMany({ where: { playlistId: updated.id } });
            const items = req.body.items.map((item, i) => ({
                playlistId: updated.id, mediaId: item.mediaId, order: i, duration: item.duration || null
            }));
            await prisma.playlistItem.createMany({ data: items });
        }
        io.emit('playlist-updated');
        res.json(updated);
    } catch (e) { res.status(404).json({ error: "Not found" }); }
});
app.delete('/playlists/:id', async (req, res) => {
    await prisma.playlistItem.deleteMany({ where: { playlistId: req.params.id } }).catch(() => {});
    await prisma.playlist.delete({ where: { id: req.params.id } }).catch(() => {});
    res.status(204).send();
});

// PHASE 3: HEARTBEAT API
const heartbeatSchema = z.object({ device_id: z.string().min(1) });
const handleValidation = (schema, req, res, part = 'body') => {
    try {
        return schema.parse(req[part]);
    } catch (e) {
        res.status(400).json({ error: "Validation Error", details: e.errors });
        return null;
    }
};

app.post('/screens/heartbeat', async (req, res) => {
    const parsed = handleValidation(heartbeatSchema, req, res);
    if (!parsed) return;

    try {
        const screen = await prisma.screen.findUnique({
            where: { deviceId: parsed.device_id }
        });

        if (!screen) {
            return res.status(404).json({ error: "Screen not found" });
        }

        const updated = await prisma.screen.update({
            where: { id: screen.id },
            data: {
                lastSeen: new Date(),
                status: 'online'
            }
        });

        io.emit('screen-status-updated', { screenId: updated.id, status: 'online' });
        res.json({ success: true, status: 'online' });
    } catch (e) {
        logger.error({ err: e }, 'Heartbeat Error');
        res.status(500).json({ error: "Internal error" });
    }
});



// ----------------- WebSocket -----------------
io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('join-screen', async (screenId) => {
        socket.join(screenId); // Dedicated room
        logger.info({ socketId: socket.id, screenId }, 'Joined screen channel');

        try {
            const screen = await prisma.screen.findUnique({ where: { id: screenId } });
            if (screen) {
                await prisma.screen.update({
                    where: { id: screenId },
                    data: { status: 'online', lastSeen: new Date() }
                });
                io.emit('screen-status-updated', { screenId, status: 'online' });
            }

            socket.on('disconnect', async () => {
                const s = await prisma.screen.findUnique({ where: { id: screenId } });
                if (s) {
                    await prisma.screen.update({
                        where: { id: screenId },
                        data: { status: 'offline' }
                    });
                    io.emit('screen-status-updated', { screenId, status: 'offline' });
                }
            });
        } catch (e) {
            logger.error({ err: e }, 'Socket join error');
        }
    });
});

const PORT = process.env.PORT || 8000; // Binding to 8000 ensures React frontend continues normally
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Backend WebSocket + API Server running natively with SQLite on port ${PORT}`);
});
