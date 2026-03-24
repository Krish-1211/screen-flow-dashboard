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
import supabase from './src/lib/supabase.js';

const CLIENT_ID = "client_1";

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
// SCREENS
app.get('/screens', async (req, res) => {
    const { data, error } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });

    // Map Supabase fields back to what the frontend expects
    const normalized = (data || []).map(s => ({
        ...s,
        playlistId: s.playlist_id,
        lastPing: s.last_ping,
        deviceId: s.device_id,
        device_id: s.device_id
    }));
    res.json(normalized);
});

app.post('/screens', async (req, res) => {
    const screen = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        device_id: req.body.device_id || req.body.deviceId,
        name: req.body.name,
        status: 'online',
        playlist_id: req.body.playlistId || req.body.playlist_id,
        last_ping: new Date().toISOString()
    };

    const { error } = await supabase.from('screens').insert(screen);
    if (error) {
        logger.error({ error, screen }, 'Failed to insert screen into Supabase');
        return res.status(500).json({ error });
    }
    logger.info({ screenId: screen.id }, 'Screen inserted successfully');
    res.json(screen);
});

app.put('/screens/:id', async (req, res) => {
    const updates = {
        name: req.body.name,
        playlist_id: req.body.playlistId || req.body.playlist_id,
        status: req.body.status,
        last_ping: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('screens')
        .update(updates)
        .eq('id', req.params.id)
        .eq('client_id', CLIENT_ID)
        .select()
        .single();

    if (error) return res.status(500).json({ error });
    io.emit('playlist-updated');
    res.json(data);
});

app.delete('/screens/:id', async (req, res) => {
    const { error } = await supabase
        .from('screens')
        .delete()
        .eq('id', req.params.id)
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.status(204).send();
});

app.post('/screens/register', async (req, res) => {
    const { deviceId, name, playlist_id } = req.body;
    const { data: existing } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .eq('device_id', deviceId)
        .maybeSingle();

    if (existing) {
        const { data: updated, error } = await supabase
            .from('screens')
            .update({ 
                name: name || existing.name, 
                playlist_id: playlist_id || existing.playlist_id,
                status: 'online',
                last_ping: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) return res.status(500).json({ error });
        return res.json(updated);
    } else {
        const newScreen = {
            id: Date.now().toString(),
            client_id: CLIENT_ID,
            device_id: deviceId,
            name: name || "New Screen",
            playlist_id: playlist_id,
            status: 'online',
            last_ping: new Date().toISOString()
        };
        const { error } = await supabase.from('screens').insert(newScreen);
        if (error) {
            logger.error({ error, newScreen }, 'Failed to register brand new screen in Supabase');
            return res.status(500).json({ error });
        }
        logger.info({ screenId: newScreen.id }, 'New screen registered successfully');
        res.json(newScreen);
    }
});

// GROUPS
app.get('/groups', (req, res) => {
    const db = readDB();
    const groups = db.groups || [];
    
    // Always provide at least one default group if none are configured
    if (groups.length === 0) {
        return res.json([{
            id: "default",
            name: "Default Group",
            screen_count: (db.screens || []).filter(s => !s.groupId || s.groupId === "default").length
        }]);
    }

    res.json(groups.map(g => ({
        ...g,
        screen_count: (db.screens || []).filter(s => s.groupId === g.id).length
    })));
});

app.post('/groups', (req, res) => {
    const db = readDB();
    if (!db.groups) db.groups = [];
    const group = { id: Date.now().toString(), name: req.body.name };
    db.groups.push(group);
    writeDB(db);
    res.json(group);
});

app.delete('/groups/:id', (req, res) => {
    const db = readDB();
    db.groups = (db.groups || []).filter(g => g.id !== req.params.id);
    // Unassign screens from this group
    db.screens.forEach(s => { if (s.groupId === req.params.id) delete s.groupId; });
    writeDB(db);
    res.status(204).send();
});

// MEDIA
app.get('/media', async (req, res) => {
    const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.json(data);
});

app.post('/media/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const fileName = `${Date.now()}-${req.file.originalname}`;

    const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
        });

    if (uploadError) return res.status(500).json({ error: uploadError });

    const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

    const media = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.file.originalname,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        url: urlData.publicUrl,
        size: req.file.size
    };

    const { error: dbError } = await supabase.from('media').insert(media);

    if (dbError) return res.status(500).json({ error: dbError });

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
app.get('/playlists', async (req, res) => {
    const { data: playlists, error: plError } = await supabase
        .from('playlists')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (plError) return res.status(500).json({ error: plError });
    
    // Enrichment
    const allMediaIds = [...new Set((playlists || []).flatMap(pl => (pl.items || []).map(i => i.mediaId)))];
    const { data: mediaList, error: mError } = await supabase
        .from('media')
        .select('*')
        .in('id', allMediaIds);

    if (mError) return res.status(500).json({ error: mError });

    const mediaMap = {};
    mediaList.forEach(m => { mediaMap[m.id] = m; });

    const enriched = playlists.map(pl => ({
        ...pl,
        items: (pl.items || []).map(item => ({
            ...item,
            media: mediaMap[item.mediaId]
        }))
    }));
    
    res.json(enriched);
});

app.post('/playlists', async (req, res) => {
    const playlist = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.body.name,
        items: req.body.items || []
    };

    const { error } = await supabase.from('playlists').insert(playlist);
    if (error) return res.status(500).json({ error });

    res.json(playlist);
});

app.put('/playlists/:id', async (req, res) => {
    const { name, items } = req.body;
    const { data, error } = await supabase
        .from('playlists')
        .update({ name, items: items || [] })
        .eq('id', req.params.id)
        .eq('client_id', CLIENT_ID)
        .select();

    if (error) return res.status(500).json({ error });
    if (!data || data.length === 0) return res.status(404).json({ error: "Playlist not found" });

    io.emit('playlist-updated');
    res.json(data[0]);
});

app.delete('/playlists/:id', async (req, res) => {
    const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', req.params.id)
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.status(204).send();
});

// SCHEDULES
app.get('/schedules', async (req, res) => {
    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.json(data.map(s => s.data));
});

app.post('/schedules', async (req, res) => {
    const scheduleId = Date.now().toString();
    const schedule = {
        id: scheduleId,
        client_id: CLIENT_ID,
        data: {
            id: scheduleId,
            ...req.body
        }
    };

    const { error } = await supabase.from('schedules').insert(schedule);
    if (error) return res.status(500).json({ error });

    io.emit('playlist-updated');
    res.json(schedule.data);
});

app.delete('/schedules/:id', async (req, res) => {
    const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('client_id', CLIENT_ID)
        .eq('data->>id', req.params.id);

    if (error) return res.status(500).json({ error });
    res.status(204).send();
});

// PLAYER Heartbeat & Playlist Discovery
app.get('/screens/player', async (req, res) => {
    const { device_id } = req.query;

    const { data: screen, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .or(`device_id.eq.${device_id},id.eq.${device_id}`)
        .maybeSingle();
    
    if (screenError || !screen) {
        return res.json({ name: "Fallback", items: [] });
    }

    const { data: playlists, error: plError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', screen.playlist_id)
        .eq('client_id', CLIENT_ID);

    if (plError || !playlists || playlists.length === 0) return res.json({ name: "No Content", items: [] });
    const playlist = playlists[0];

    // Enrich items with Supabase media objects
    const mediaIds = (playlist.items || []).map(i => i.mediaId);
    const { data: mediaList, error } = await supabase
        .from('media')
        .select('*')
        .in('id', mediaIds);

    if (error) return res.status(500).json({ error });

    const mediaMap = {};
    mediaList.forEach(m => { mediaMap[m.id] = m; });

    const enrichedItems = (playlist.items || []).map(item => ({
        ...item,
        media: mediaMap[item.mediaId]
    })).filter(it => it.media);

    res.json({ ...playlist, items: enrichedItems });
});

app.post('/screens/heartbeat', async (req, res) => {
    const { device_id } = req.body;
    const { error } = await supabase
        .from('screens')
        .update({
            status: 'online',
            last_ping: new Date().toISOString()
        })
        .eq('device_id', device_id)
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.status(204).send();
});

// AUDIT LOGS
app.get('/audit', (req, res) => {
    const db = readDB();
    if (!db.audit) { db.audit = []; writeDB(db); }
    res.json(db.audit);
});

// ── Step 5: Launch ──
app.get('/health', (req, res) => res.json({ status: "ok", storage: "json" }));

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Lightweight Backend running on port ${PORT}`);
});
