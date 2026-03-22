const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const pino = require('pino');
const pinoHttp = require('pino-http');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const prisma = new PrismaClient();
const app = express();
const httpServer = http.createServer(app);
const io = socketIo(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const upload = multer();

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// PHASE 1: HELPERS & DATA ENRICHMENT
function enrichMedia(media) {
    if (!media) return null;
    return {
        id: media.id,
        name: media.name,
        type: media.type,
        url: media.url,
        duration: media.duration || 10,
        createdAt: media.createdAt
    };
}

async function enrichPlaylistData(playlist) {
    if (!playlist || !playlist.items) return playlist;
    
    // Fetch all media for the items in one go or individually
    const itemsWithMedia = await Promise.all(playlist.items.map(async (item) => {
        const media = await prisma.media.findUnique({ where: { id: item.mediaId } });
        return {
            ...item,
            media: enrichMedia(media),
            order: item.order !== undefined ? item.order : 0
        };
    }));

    playlist.items = itemsWithMedia
        .filter(item => item.media !== null)
        .sort((a, b) => a.order - b.order);
    
    return playlist;
}

// PHASE 2: SCHEDULING ENGINE
async function getActivePlaylist(screen, clientTime = null, clientDay = null) {
    if (!screen) return null;

    // Fetch schedules for THIS screen OR generic/global schedules
    const schedules = await prisma.schedule.findMany({
        where: {
            OR: [
                { screenId: screen.id },
                { screenId: null },
                { screenId: "" }
            ]
        }
    });

    // Use Client Time if provided, otherwise Fallback to Server Time
    let currentTime = clientTime;
    let currentWeekday = clientDay !== null ? parseInt(clientDay) : null;

    if (!currentTime || currentWeekday === null) {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMin = String(now.getMinutes()).padStart(2, '0');
        currentTime = currentTime || `${currentHour}:${currentMin}`;
        currentWeekday = currentWeekday !== null ? currentWeekday : now.getDay();
    }

    const validSchedules = schedules.filter(sch => {
        let days = [];
        try { 
            days = typeof sch.daysOfWeek === 'string' ? JSON.parse(sch.daysOfWeek) : sch.daysOfWeek;
        } catch { 
            days = String(sch.daysOfWeek).split(',').map(n => parseInt(n.trim(), 10)); 
        }

        if (!days.includes(currentWeekday)) return false;
        if (currentTime < sch.startTime || currentTime > sch.endTime) return false;
        return true;
    });

    if (validSchedules.length > 0) {
        // Find the most recently created or priority schedule
        const activeSchedule = validSchedules[0];
        const playlist = await prisma.playlist.findUnique({
            where: { id: activeSchedule.playlistId },
            include: { items: true }
        });
        if (playlist) return await enrichPlaylistData(playlist);
    }

    // Default Fallback
    if (screen.currentPlaylistId) {
        const fallbackPlaylist = await prisma.playlist.findUnique({
            where: { id: screen.currentPlaylistId },
            include: { items: true }
        });
        if (fallbackPlaylist) return await enrichPlaylistData(fallbackPlaylist);
    }

    return null;
}

// PHASE 3: AUTH & SCREENS API
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

app.get(['/screens', '/screens/'], async (req, res) => {
    try {
        const screens = await prisma.screen.findMany();
        const mapped = await Promise.all(screens.map(async s => {
            const active = await getActivePlaylist(s);
            return {
                id: s.id,
                name: s.name,
                status: s.status,
                lastPing: s.lastSeen,
                playlistId: s.currentPlaylistId,
                device_id: s.deviceId,
                active_playlist_name: active ? active.name : "None",
                is_scheduled: active && active.id !== s.currentPlaylistId
            };
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/screens/:id', async (req, res) => {
    const s = await prisma.screen.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ error: "Screen not found" });
    res.json({ ...s, playlistId: s.currentPlaylistId, device_id: s.deviceId });
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
    res.json({ ...s, playlistId: s.currentPlaylistId, device_id: s.deviceId });
});

app.put('/screens/bulk', async (req, res) => {
    const { screen_ids, playlist_id } = req.body;
    await prisma.screen.updateMany({
        where: { id: { in: screen_ids } },
        data: { currentPlaylistId: playlist_id }
    });
    io.emit('playlist-updated');
    res.json({ success: true, updated: screen_ids.length });
});

app.put('/screens/:id', async (req, res) => {
    const { name, playlist_id, status } = req.body;
    const s = await prisma.screen.update({
        where: { id: req.params.id },
        data: { 
            name, 
            currentPlaylistId: playlist_id,
            status: status || undefined
        }
    });
    io.emit('playlist-updated');
    res.json(s);
});

app.delete('/screens/:id', async (req, res) => {
    await prisma.screen.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

app.post('/screens/heartbeat', async (req, res) => {
    const { device_id } = req.body;
    await prisma.screen.update({
        where: { deviceId: device_id },
        data: { lastSeen: new Date(), status: 'online' }
    }).catch(() => {});
    res.status(204).send();
});

// PHASE 4: MEDIA & PLAYLISTS API
app.get('/media', async (req, res) => {
    const media = await prisma.media.findMany();
    res.json(media.map(m => enrichMedia(m)));
});

app.post('/media', upload.single('file'), async (req, res) => {
    // This is a mockup for local uploads if needed, 
    // usually handled by frontend upload to a cloud storage
    res.status(501).json({ error: "Use Cloud Storage or existing URLs" });
});

app.delete('/media/:id', async (req, res) => {
    await prisma.media.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

app.get('/playlists', async (req, res) => {
    const pl = await prisma.playlist.findMany({ include: { items: true } });
    for (const p of pl) { await enrichPlaylistData(p); }
    res.json(pl);
});

app.get('/playlists/:id', async (req, res) => {
    const p = await prisma.playlist.findUnique({
        where: { id: req.params.id },
        include: { items: true }
    });
    if (!p) return res.status(404).json({ error: "Playlist not found" });
    await enrichPlaylistData(p);
    res.json(p);
});

app.post('/playlists', async (req, res) => {
    const { name, items } = req.body;
    const newPl = await prisma.playlist.create({ data: { name: name || "New Playlist" } });
    if (items && items.length > 0) {
        await prisma.playlistItem.createMany({
            data: items.map((it, i) => ({
                playlistId: newPl.id,
                mediaId: it.mediaId || it.media_id,
                order: it.order !== undefined ? it.order : i,
                duration: it.duration || 10
            }))
        });
    }
    res.json(newPl);
});

app.put('/playlists/:id', async (req, res) => {
    const { name, items } = req.body;
    await prisma.playlist.update({ where: { id: req.params.id }, data: { name } });
    if (items) {
        await prisma.playlistItem.deleteMany({ where: { playlistId: req.params.id } });
        await prisma.playlistItem.createMany({
            data: items.map((it, i) => ({
                playlistId: req.params.id,
                mediaId: it.mediaId || it.media_id,
                order: it.order !== undefined ? it.order : i,
                duration: it.duration || 10
            }))
        });
    }
    io.emit('playlist-updated');
    res.json({ success: true });
});

app.delete('/playlists/:id', async (req, res) => {
    await prisma.playlist.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

// PHASE 5: SCHEDULES API
app.get(['/schedules', '/schedules/'], async (req, res) => {
    const { screen_id } = req.query;
    const where = screen_id ? { screenId: screen_id } : {};
    const schedules = await prisma.schedule.findMany({ where });
    res.json(schedules.map(s => ({
        ...s,
        screen_id: s.screenId,
        playlist_id: s.playlistId,
        days_of_week: JSON.parse(s.daysOfWeek),
        start_time: s.startTime,
        end_time: s.endTime
    })));
});

app.post(['/schedules', '/schedules/'], async (req, res) => {
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

app.delete('/schedules/:id', async (req, res) => {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    io.emit('playlist-updated');
    res.status(204).send();
});

// PHASE 6: PLAYER API
app.get('/screens/player', async (req, res) => {
    try {
        const { device_id, local_time, local_day } = req.query;
        if (!device_id) return res.status(400).json({ error: "device_id is required" });

        const screen = await prisma.screen.findUnique({ where: { deviceId: device_id } });
        if (!screen) return res.status(404).json({ error: "Screen not found" });

        const activePlaylist = await getActivePlaylist(screen, local_time, local_day);
        
        if (!activePlaylist) {
            return res.json({
                id: "fallback",
                name: "No Content",
                items: [{
                    id: "f1",
                    media: { name: "No Content", type: "image", url: "https://placehold.co/1920x1080?text=No+Content" },
                    duration: 10
                }]
            });
        }
        res.json(activePlaylist);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/health', (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
});
