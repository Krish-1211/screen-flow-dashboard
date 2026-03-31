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

// Helper to convert HH:mm:ss or HH:mm to total seconds from midnight
const toSeconds = (t) => {
    if (!t) return 0;
    const parts = t.split(':').map(Number);
    const [h = 0, m = 0, s = 0] = parts;
    return h * 3600 + m * 60 + s;
};

// Tree Helper
function transformToTree(items) {
    const map = {};
    const roots = [];
    
    items.forEach(item => {
        item.children = [];
        map[item.id] = item;
    });

    items.forEach(item => {
        if (item.parent_id && map[item.parent_id]) {
            map[item.parent_id].children.push(item);
        } else {
            roots.push(item);
        }
    });

    return roots;
}

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

// ── Step 5: Diagnostics ──
async function checkSupabase() {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
            logger.error({ error }, 'Supabase Storage Diagnostics Failed');
        } else {
            const hasMedia = buckets.some(b => b.name === 'media');
            logger.info({ buckets: buckets.map(b => b.name) }, `Supabase Connected. Bucket 'media' exists: ${hasMedia}`);
            if (!hasMedia) {
                logger.warn('Bucket "media" NOT FOUND. Uploads will fail until created in Supabase dashboard.');
            }
        }
    } catch (e) {
        logger.error({ error: e }, 'Supabase Connection Error');
    }
}
checkSupabase();

// SCREENS


app.post('/screens', async (req, res) => {
    const deviceId = req.body.device_id || req.body.deviceId || crypto.randomUUID();
    
    // Check if screen exists with device_id
    const { data: existing } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .eq('device_id', deviceId)
        .maybeSingle();

    const screenName = req.body.name || "";
    if (screenName.startsWith("Screen-")) {
        return res.status(400).json({ error: "Reserved name prefix 'Screen-' is forbidden. Please provide a descriptive name." });
    }

    const screenData = {
        name: screenName,
        playlist_id: req.body.playlistId || req.body.playlist_id,
        node_id: req.body.nodeId || req.body.node_id || null,
        status: 'online',
        last_ping: new Date().toISOString()
    };

    if (existing) {
        // Update
        const { data, error } = await supabase
            .from('screens')
            .update(screenData)
            .eq('id', existing.id)
            .select()
            .single();
        if (error) return res.status(500).json({ error });
        return res.json(data);
    } else {
        // Create
        const screen = {
            id: Date.now().toString(),
            client_id: CLIENT_ID,
            device_id: deviceId,
            ...screenData
        };
        const { error } = await supabase.from('screens').insert(screen);
        if (error) return res.status(500).json({ error });
        res.json(screen);
    }
});

app.put('/screens/:id', async (req, res) => {
    const updates = {
        name: req.body.name,
        device_id: req.body.device_id || req.body.deviceId,
        playlist_id: req.body.playlistId || req.body.playlist_id,
        node_id: req.body.nodeId || req.body.node_id,
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
    
    // 1. First, search for a screen with this exact deviceId
    let { data: existing } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .eq('device_id', deviceId)
        .maybeSingle();

    // 2. Adoption Flow: Claim a screen pre-created by NAME
    const requestedName = name || "";
    if (!existing && requestedName && !requestedName.startsWith("Screen-")) {
        const { data: byName } = await supabase
            .from('screens')
            .select('*')
            .eq('client_id', CLIENT_ID)
            .eq('name', requestedName)
            .maybeSingle();
        
        if (byName) {
            existing = byName;
            logger.info({ screenId: existing.id, name: requestedName }, 'Screen Adoption: Linking machine to existing record');
        }
    }

    if (existing) {
        // Update record (even if we just adopted it, we now save the persistent deviceId)
        const { data: updated, error } = await supabase
            .from('screens')
            .update({ 
                device_id: deviceId, // Secure the link
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
        // PERMANENT FIX: Disable automatic creation of screen records to prevent 'Ghost Screens'.
        // To register a screen, it MUST be pre-created in the dashboard by Name.
        logger.warn({ deviceId, name }, 'Registration rejected: No matching screen record found in dashboard.');
        return res.status(404).json({ 
            error: 'Screen not found', 
            message: 'You must first create this screen in the dashboard before the player can connect.' 
        });
    }
});

// ── Step 6: Hierarchical Nodes (Folders) API ──

app.get('/nodes', async (req, res) => {
    const { parent_id } = req.query;
    
    let query = supabase
        .from('nodes')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (parent_id === 'root' || !parent_id) {
        query = query.is('parent_id', null);
    } else {
        query = query.eq('parent_id', parent_id);
    }

    const { data: nodes, error } = await query.order('name');
    if (error) return res.status(500).json({ error });

    const enrichedNodes = await Promise.all((nodes || []).map(async node => {
        const [{ count: screenCount }, { count: subspaceCount }] = await Promise.all([
          supabase.from('screens').select('*', { count: 'exact', head: true }).eq('node_id', node.id),
          supabase.from('nodes').select('*', { count: 'exact', head: true }).eq('parent_id', node.id)
        ]);

        return {
            ...node,
            screenCount: screenCount || 0,
            subspaceCount: subspaceCount || 0
        };
    }));

    res.json(enrichedNodes);
});


app.get('/nodes/path/:id', async (req, res) => {
    // Helper to get breadcrumb path
    const { id } = req.params;
    const path = [];
    let currentId = id;

    while (currentId) {
        const { data, error } = await supabase
            .from('nodes')
            .select('id, name, parent_id')
            .eq('id', currentId)
            .maybeSingle();
        
        if (error || !data) break;
        path.unshift(data);
        currentId = data.parent_id;
        if (path.length > 10) break; // Absolute depth safety
    }

    res.json(path);
});

app.post('/nodes', async (req, res) => {
    const { name, parent_id } = req.body;
    const node = {
        id: crypto.randomUUID(),
        name: name || 'New Folder',
        parent_id: parent_id === 'root' ? null : parent_id,
        client_id: CLIENT_ID,
        created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('nodes').insert(node);
    if (error) return res.status(500).json({ error });
    res.json(node);
});

app.put('/nodes/:id', async (req, res) => {
    const { name, parent_id } = req.body;
    const { id } = req.params;

    // Prevention of circular reference
    if (parent_id && parent_id === id) {
        return res.status(400).json({ error: "A folder cannot be its own parent" });
    }

    if (parent_id && parent_id !== 'root') {
        // Basic circular check (is parent_id a descendant of id?)
        let checkId = parent_id;
        while (checkId) {
            const { data } = await supabase
                .from('nodes')
                .select('parent_id')
                .eq('id', checkId)
                .maybeSingle();
            if (!data) break;
            if (data.parent_id === id) {
                return res.status(400).json({ error: "Circular reference detected" });
            }
            checkId = data.parent_id;
        }
    }

    const updates = {};
    if (name) updates.name = name;
    if (parent_id !== undefined) updates.parent_id = parent_id === 'root' ? null : parent_id;

    const { data, error } = await supabase
        .from('nodes')
        .update(updates)
        .eq('id', id)
        .eq('client_id', CLIENT_ID)
        .select()
        .single();

    if (error) return res.status(500).json({ error });
    res.json(data);
});

app.delete('/nodes/:id', async (req, res) => {
    const { id } = req.params;

    // Move children nodes to root or delete? User said "handle safely"
    // We will move child nodes and screens to the parent of the deleted node
    const { data: node } = await supabase
        .from('nodes')
        .select('parent_id')
        .eq('id', id)
        .maybeSingle();

    const newParent = node ? node.parent_id : null;

    // Update child nodes
    await supabase.from('nodes').update({ parent_id: newParent }).eq('parent_id', id);
    // Update screens
    await supabase.from('screens').update({ node_id: newParent }).eq('node_id', id);

    const { error } = await supabase
        .from('nodes')
        .delete()
        .eq('id', id)
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });
    res.status(204).send();
});

// Update Screen logic for node_id
app.get('/screens', async (req, res) => {
    const { node_id } = req.query;
    let query = supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (node_id === 'root') {
        query = query.is('node_id', null);
    } else if (node_id) {
        query = query.eq('node_id', node_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error });

    const normalized = (data || []).map(s => ({
        ...s,
        playlistId: s.playlist_id,
        lastPing: s.last_ping,
        deviceId: s.device_id,
        nodeId: s.node_id
    }));
    res.json(normalized);
});

// MEDIA
app.get('/media', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { tree, parent_id } = req.query;
    let query = supabase
        .from('media')
        .select('*')
        .eq('client_id', CLIENT_ID);

    if (parent_id) {
        query = query.eq('parent_id', parent_id === 'root' ? null : parent_id);
    }

    const { data, error } = await query.order('name');

    if (error) return res.status(500).json({ error });

    if (tree === 'true') {
        return res.json(transformToTree(data || []));
    }
    res.json(data);
});

app.post('/media/folder', async (req, res) => {
    const { name, parent_id } = req.body;
    const folder = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: name || 'New Folder',
        type: 'folder', // legacy compatibility if needed
        node_type: 'folder',
        parent_id: parent_id || null,
        url: '',
        size: 0
    };

    const { error } = await supabase.from('media').insert(folder);
    if (error) return res.status(500).json({ error });
    res.json(folder);
});

const sanitizeFileName = (name) => {
    return name
        .normalize("NFKD")                  // remove weird unicode
        .replace(/[^\w.-]/g, "_")           // replace anything not safe
        .replace(/_+/g, "_");               // collapse multiple _
};

app.post('/media/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const cleanName = sanitizeFileName(req.file.originalname);
    const fileName = `${Date.now()}-${cleanName}`;

    const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
        });

    if (uploadError) {
        logger.error({ error: uploadError, fileName }, 'Supabase Storage upload failed');
        return res.status(500).json({ 
            error: "Storage error", 
            details: uploadError.message || uploadError 
        });
    }

    const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

    const media = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.body.name || req.file.originalname,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        node_type: 'file',
        parent_id: req.body.parent_id || null,
        url: urlData.publicUrl,
        size: req.file.size
    };

    const { error: dbError } = await supabase.from('media').insert(media);

    if (dbError) {
        logger.error({ error: dbError, media }, 'Supabase Database insert failed');
        return res.status(500).json({ 
            error: "Database error", 
            details: dbError.message || dbError 
        });
    }

    io.emit('media-updated');
    res.json(media);
});
app.post('/media/youtube', async (req, res) => {
    const media = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.body.name || "YouTube",
        type: 'youtube',
        node_type: 'file',
        parent_id: req.body.parent_id || null,
        url: req.body.url,
        size: 0
    };

    // 1. Save to Supabase
    const { error: dbError } = await supabase.from('media').insert(media);
    if (dbError) {
        logger.error({ error: dbError, media }, 'YouTube insert to Supabase failed');
        return res.status(500).json({ error: dbError });
    }

    // 2. Save to local JSON for safety
    const db = readDB();
    if (!db.media) db.media = [];
    db.media.push(media);
    writeDB(db);

    io.emit('media-updated');
    res.json(media);
});
app.delete('/media/:id', async (req, res) => {
    const { id } = req.params;

    // 1. Get media info from Supabase to find the storage filename
    const { data: media, error: getError } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .eq('client_id', CLIENT_ID)
        .maybeSingle();

    if (getError) return res.status(500).json({ error: getError });

    if (media) {
        // Move children to parent of deleted node
        const newParent = media.parent_id || null;
        await supabase.from('media').update({ parent_id: newParent }).eq('parent_id', id);

        // Delete from Supabase Storage
        const storagePath = media.url.split('/').pop();
        if (storagePath && media.node_type !== 'folder') {
            await supabase.storage.from('media').remove([storagePath]);
        }

        // 3. Delete from Supabase Database
        const { error: dbError } = await supabase
            .from('media')
            .delete()
            .eq('id', id)
            .eq('client_id', CLIENT_ID);
        
        if (dbError) return res.status(500).json({ error: dbError });
    }

    // 4. Update local JSON for safety
    const db = readDB();
    db.media = (db.media || []).filter(m => m.id !== id);
    writeDB(db);

    io.emit('media-updated');
    res.status(204).send();
});

// PLAYLISTS
app.get('/playlists', async (req, res) => {
    const { tree } = req.query;
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

    if (tree === 'true') {
        const treeData = transformToTree(enriched);
        return res.json(treeData);
    }
    
    res.json(enriched);
});

app.post('/playlists', async (req, res) => {
    let { name } = req.body;
    if (!name) name = "New Playlist";

    // 1. Check for duplicates
    const { data: existing } = await supabase
        .from('playlists')
        .select('name')
        .eq('client_id', CLIENT_ID)
        .eq('name', name)
        .maybeSingle();

    if (existing) {
        return res.status(400).json({ error: `A playlist named "${name}" already exists.` });
    }

    const playlist = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name,
        node_type: req.body.node_type || 'playlist',
        parent_id: req.body.parent_id || null,
        items: req.body.items || []
    };

    const { error } = await supabase.from('playlists').insert(playlist);
    if (error) return res.status(500).json({ error });

    res.json(playlist);
});

app.put('/playlists/:id', async (req, res) => {
    const { name, items } = req.body;
    const { id } = req.params;

    // 1. Check for duplicates if name is changing
    if (name) {
        const { data: existing } = await supabase
            .from('playlists')
            .select('id')
            .eq('client_id', CLIENT_ID)
            .eq('name', name)
            .neq('id', id)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: `The name "${name}" is already taken.` });
        }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (items !== undefined) updates.items = items;
    if (req.body.parent_id !== undefined) updates.parent_id = req.body.parent_id;
    if (req.body.node_type !== undefined) updates.node_type = req.body.node_type;

    const { data, error } = await supabase
        .from('playlists')
        .update(updates)
        .eq('id', id)
        .eq('client_id', CLIENT_ID)
        .select();

    if (error) return res.status(500).json({ error });
    if (!data || data.length === 0) return res.status(404).json({ error: "Playlist not found" });

    io.emit('playlist-updated');
    res.json(data[0]);
});

app.delete('/playlists/:id', async (req, res) => {

    const { data: playlist } = await supabase
        .from('playlists')
        .select('parent_id')
        .eq('id', req.params.id)
        .maybeSingle();

    if (playlist) {
        const newParent = playlist.parent_id || null;
        await supabase.from('playlists').update({ parent_id: newParent }).eq('parent_id', req.params.id);
    }

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

// PLAYER Heartbeat & Context Discovery
app.get('/screens/player', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { device_id } = req.query;

    // 1. Get the screen
    const { data: screen, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .or(`device_id.eq.${device_id},id.eq.${device_id}`)
        .maybeSingle();
    
    if (screenError || !screen) {
        return res.status(404).json({ error: "Screen not found" });
    }

    // 2. Fetch all schedules for this screen
    const { data: allSchedules, error: schedError } = await supabase
        .from('schedules')
        .select('*')
        .eq('client_id', CLIENT_ID);

    const relevantSchedules = (allSchedules || [])
        .map(s => s.data)
        .filter(s => String(s.screen_id) === String(screen.id) && s.active !== false);

    // 3. Fetch all playlists involved (default + scheduled)
    const playlistIds = [
        screen.playlist_id,
        ...relevantSchedules.map(s => s.playlist_id)
    ].filter(Boolean);

    const { data: playlists, error: plError } = await supabase
        .from('playlists')
        .select('*')
        .in('id', playlistIds)
        .eq('client_id', CLIENT_ID);

    if (plError || !playlists) {
        return res.status(500).json({ error: "Failed to fetch playlists" });
    }

    // 4. Enrich all playlists with media
    const allMediaIds = [...new Set(playlists.flatMap(pl => (pl.items || []).map(i => i.mediaId)))];
    const { data: mediaList, error: mError } = await supabase
        .from('media')
        .select('*')
        .in('id', allMediaIds);

    const mediaMap = {};
    if (mediaList) {
        mediaList.forEach(m => { mediaMap[m.id] = m; });
    }

    const enrichedPlaylists = playlists.map(pl => {
        let items = (pl.items || []).map(item => ({
            ...item,
            media: mediaMap[item.mediaId]
        }));

        // Inject system gap for solo videos
        if (items.length === 1 && items[0].media?.type === 'video') {
            items.push({
                id: 'system-gap',
                mediaId: 'system-gap',
                order: 999,
                duration: 1,
                media: {
                    id: 'system-gap',
                    name: 'System Gap',
                    type: 'system_gap',
                    url: '/black-screen.svg'
                }
            });
        }
        return { ...pl, items };
    });

    // 5. Return the payload
    res.json({
        screen: {
            id: screen.id,
            name: screen.name,
            defaultPlaylistId: screen.playlist_id
        },
        playlists: enrichedPlaylists,
        schedules: relevantSchedules.map(s => ({
            id: s.id,
            playlistId: s.playlist_id,
            startTime: s.start_time,
            endTime: s.end_time,
            days: s.days_of_week || (s.day_of_week !== undefined ? [s.day_of_week] : [0,1,2,3,4,5,6])
        }))
    });
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

// Cleanup logic
app.post('/admin/cleanup', async (req, res) => {
    logger.info('Performing screen cleanup...');
    const { data, error } = await supabase
        .from('screens')
        .delete()
        .or('device_id.is.null,device_id.eq.null,device_id.eq.undefined,device_id.eq.""');
    
    if (error) {
        logger.error({ error }, 'Cleanup failed');
        return res.status(500).json({ error });
    }
    
    res.json({ message: "Cleanup completed", details: data });
});

// ── Step 5: Launch ──
app.get('/health', (req, res) => res.json({ status: "ok", storage: "json" }));

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Lightweight Backend running on port ${PORT}`);
});
