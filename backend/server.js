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
import crypto from 'crypto';
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

// ── Step 1.1: CSP Headers for Production Stability ──
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval'; " +
        "connect-src * 'unsafe-inline'; " +
        "img-src * data: blob:; " +
        "frame-src *; " +
        "style-src * 'unsafe-inline';"
    );
    next();
});

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
    
    // Normalize parent_id
    const folderId = (parent_id === 'root' || parent_id === 'null' || !parent_id) ? null : parent_id;

    if (tree === 'true') {
        // 1. Fetch ALL folders (metadata)
        const { data: allFolders } = await supabase
            .from('folders')
            .select('*')
            .eq('client_id', CLIENT_ID)
            .order('name');

        // 2. Fetch ALL links (files in folders)
        const { data: allRefs } = await supabase
            .from('folder_items')
            .select('*, media:media_id(*)')
            .eq('client_id', CLIENT_ID);

        // Normalize folders for UI
        const folders = (allFolders || []).map(f => ({ ...f, node_type: 'folder' }));

        // Normalize items for UI
        const items = (allRefs || []).map(ref => ({
            ...(ref.media || {}),
            id: ref.id, // The link ID for UI actions
            actualMediaId: ref.media_id,
            parent_id: ref.folder_id,
            node_type: 'file'
        })).filter(i => i.name);

        // Fetch Root orphans (media with NO folder_items entries)
        const refMediaIds = (allRefs || []).map(r => r.media_id);
        const { data: orphans } = await supabase
            .from('media')
            .select('*')
            .eq('client_id', CLIENT_ID)
            .not('id', 'in', `(${refMediaIds.join(',') || '0'})`);

        const rootOrphans = (orphans || []).map(m => ({ ...m, node_type: 'file' }));

        const treeData = transformToTree([...folders, ...items]);
        return res.json([...treeData, ...rootOrphans]);
    }

    // ── LIST VIEW ──

    // 1. Fetch Folders for current level
    let folderQuery = supabase.from('folders').select('*').eq('client_id', CLIENT_ID);
    if (folderId === null) {
        folderQuery = folderQuery.is('parent_id', null);
    } else {
        folderQuery = folderQuery.eq('parent_id', folderId);
    }
    const { data: rawFolders } = await folderQuery.order('name');
    const folders = (rawFolders || []).map(f => ({ ...f, node_type: 'folder' }));

    // 2. Fetch Items for current level
    let items = [];
    if (folderId === null) {
        // ROOT: Find media NOT in any folder_items
        const { data: allRefs } = await supabase.from('folder_items').select('media_id').eq('client_id', CLIENT_ID);
        const refIds = (allRefs || []).map(r => String(r.media_id));
        
        let orphanQuery = supabase.from('media').select('*').eq('client_id', CLIENT_ID);
        if (refIds.length > 0) {
            orphanQuery = orphanQuery.not('id', 'in', `(${refIds.join(',')})`);
        }
        const { data: orphanData } = await orphanQuery;
        items = (orphanData || []).map(m => ({ ...m, node_type: 'file' }));
    } else {
        // INSIDE FOLDER: Fetch via folder_items
        const { data: refs } = await supabase
            .from('folder_items')
            .select('*, media:media_id(*)')
            .eq('client_id', CLIENT_ID)
            .eq('folder_id', folderId);
        
        items = (refs || []).map(ref => ({
            ...(ref.media || {}),
            id: ref.id,
            actualMediaId: ref.media_id,
            parent_id: ref.folder_id,
            node_type: 'file'
        })).filter(i => i.name);
    }

    // Calculate folder counts (how many files in each folder)
    const { data: counts } = await supabase.from('folder_items').select('folder_id').eq('client_id', CLIENT_ID);
    const countMap = (counts || []).reduce((acc, curr) => {
        if (curr.folder_id) acc[curr.folder_id] = (acc[curr.folder_id] || 0) + 1;
        return acc;
    }, {});

    const foldersWithCounts = folders.map(f => ({
        ...f,
        children_count: countMap[f.id] || 0
    }));

    res.json([...foldersWithCounts, ...items]);
});

app.post('/media/folder', async (req, res) => {
    const { name, parent_id } = req.body;
    const folder = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: name || 'New Folder',
        parent_id: (parent_id === 'root' || !parent_id) ? null : parent_id,
        created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('folders').insert(folder);
    if (error) return res.status(500).json({ error });
    res.json({ ...folder, node_type: 'folder' });
});

const sanitizeFileName = (name) => {
    return name
        .normalize("NFKD")
        .replace(/[^\w.-]/g, "_")
        .replace(/_+/g, "_");
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

    const mediaRecord = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.body.name || req.file.originalname,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        node_type: 'file',
        parent_id: null, // Files are now independent
        url: urlData.publicUrl,
        size: req.file.size
    };

    const { error: dbError } = await supabase.from('media').insert(mediaRecord);
    if (dbError) {
        logger.error({ error: dbError, media: mediaRecord }, 'Supabase Database insert failed');
        return res.status(500).json({ 
            error: "Database error", 
            details: dbError.message || dbError 
        });
    }

    // CREATE FOLDER REFERENCE (Mandatory for placement)
    const rawTarget = req.body.parent_id;
    const folderId = rawTarget === 'root' ? null : (rawTarget || null);
    
    if (folderId) {
        // Verify folder exists in new folders table
        const { data: folderExists } = await supabase.from('folders').select('id').eq('id', folderId).maybeSingle();
        if (folderExists) {
            await supabase.from('folder_items').insert({
                client_id: CLIENT_ID,
                media_id: mediaRecord.id,
                folder_id: folderId
            });
        } else {
            logger.warn({ folderId, mediaId: mediaRecord.id }, 'Upload Target Folder not found in dedicated folders table. Item will remain at root.');
        }
    }

    io.emit('media-updated');
    res.json(mediaRecord);
});
app.post('/media/youtube', async (req, res) => {
    // Extract YouTube ID for clean storage/preview
    const extractId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : url;
    };

    const youtubeId = extractId(req.body.url);

    const mediaRecord = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: req.body.name || "YouTube Video",
        type: 'youtube',
        node_type: 'file',
        parent_id: null,
        url: req.body.url, // Original URL preserved
        size: 0
    };

    const { error: dbError } = await supabase.from('media').insert(mediaRecord);
    if (dbError) return res.status(500).json({ error: dbError });

    const rawTarget = req.body.parent_id;
    const folderId = rawTarget === 'root' ? null : (rawTarget || null);
    
    if (folderId) {
        const { data: folderExists } = await supabase.from('folders').select('id').eq('id', folderId).maybeSingle();
        if (folderExists) {
            await supabase.from('folder_items').insert({
                client_id: CLIENT_ID,
                media_id: mediaRecord.id,
                folder_id: folderId
            });
        }
    }

    io.emit('media-updated');
    res.json(mediaRecord);
});

app.put('/media/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;

        const isLinkUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let actualMediaId = id;
        let isFolder = false;

        // Check if ID belongs to a Folder or a Media entity
        const { data: folderInstance } = await supabase.from('folders').select('id').eq('id', id).maybeSingle();
        if (folderInstance) {
            isFolder = true;
        } else if (isLinkUUID) {
            const { data: ref } = await supabase.from('folder_items').select('media_id').eq('id', id).maybeSingle();
            if (ref) actualMediaId = ref.media_id;
        }

        // A. Handle Rename
        if (name) {
            const table = isFolder ? 'folders' : 'media';
            await supabase.from(table).update({ name }).eq('id', actualMediaId);
        }

        // B. Handle Move
        if (parent_id !== undefined) {
            const targetFolderId = (parent_id === 'root' || parent_id === null) ? null : parent_id;

            if (isFolder) {
                // Moving a Folder
                await supabase.from('folders').update({ parent_id: targetFolderId }).eq('id', actualMediaId);
            } else {
                // Moving a Media Item (File)
                // 1. Verify Media Exists
                const { data: mediaItem } = await supabase.from('media').select('id').eq('id', actualMediaId).maybeSingle();
                if (!mediaItem) return res.status(404).json({ error: "Media not found", mediaId: actualMediaId });

                // 2. Verify Target Folder Exists
                if (targetFolderId) {
                    const { data: targetFolder } = await supabase.from('folders').select('id').eq('id', targetFolderId).maybeSingle();
                    if (!targetFolder) return res.status(400).json({ error: "Target folder missing", folderId: targetFolderId });
                }

                // 3. Clear old placements and insert new
                await supabase.from('folder_items').delete().eq('media_id', actualMediaId);
                if (targetFolderId) {
                    await supabase.from('folder_items').insert({
                        client_id: CLIENT_ID,
                        media_id: actualMediaId,
                        folder_id: targetFolderId
                    });
                }
            }
            io.emit('media-updated');
        }

        return res.json({ success: true, isFolder, mediaId: actualMediaId });

    } catch (err) {
        console.error("MOVE ERROR:", err);
        res.status(500).json({ error: "Move operation failed", details: err.message });
    }
});

// COPY/PASTE SUPPORT
app.post('/media/paste', async (req, res) => {
    try {
        const { mediaId, targetFolderId, type } = req.body; // type: 'copy' or 'cut'
        const folderId = (targetFolderId === 'root' || targetFolderId === null) ? null : targetFolderId;

        if (!mediaId) return res.status(400).json({ error: "Missing mediaId" });

        // Resolve 'Physical' Media ID if a UUID was passed
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId);
        let actualMediaId = mediaId;
        if (isUUID) {
            const { data: ref } = await supabase.from('folder_items').select('media_id').eq('id', mediaId).maybeSingle();
            if (ref) actualMediaId = ref.media_id;
        }

        console.log(`[PASTE DEBUG] Type: ${type}, InputMediaID: ${mediaId}, ActualID: ${actualMediaId}, TargetFolder: ${folderId}`);

        // Prevent duplicate placement in same folder
        if (folderId) {
            const { data: existing } = await supabase
                .from('folder_items')
                .select('*')
                .eq('media_id', actualMediaId)
                .eq('folder_id', folderId)
                .maybeSingle();
                
            if (existing) {
                if (type === 'cut') return res.json({ message: "Already there", ref: existing });
                return res.status(409).json({ error: "Item already exists in this folder" });
            }
        }

        if (type === 'copy') {
            if (folderId) {
                const { error } = await supabase.from('folder_items').insert({
                    id: crypto.randomUUID(),
                    client_id: CLIENT_ID,
                    media_id: actualMediaId,
                    folder_id: folderId
                });
                if (error) return res.status(500).json({ error: "Copy failed", details: error.message });
            }
        } else if (type === 'cut') {
            // Cut = Move: Clear all previous references
            await supabase.from('folder_items').delete().eq('media_id', actualMediaId);
            
            if (folderId) {
                const { error } = await supabase.from('folder_items').insert({
                    id: crypto.randomUUID(),
                    client_id: CLIENT_ID,
                    media_id: actualMediaId,
                    folder_id: folderId
                });
                if (error) return res.status(500).json({ error: "Move placement failed", details: error.message });
            }
        }
        
        io.emit('media-updated');
        return res.json({ success: true, type, mediaId: actualMediaId, folderId });
    } catch (err) {
        console.error("[PASTE CRASH]", err);
        res.status(500).json({ error: "Server error during paste", details: err.message });
    }
});
app.delete('/media/:id', async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;

    // 1. Check if it's a folder
    const { data: folder } = await supabase.from('folders').select('*').eq('id', id).maybeSingle();
    if (folder) {
        // Move children up to parent of deleted folder
        const newParent = folder.parent_id || null;
        await supabase.from('folders').update({ parent_id: newParent }).eq('parent_id', id);
        await supabase.from('folder_items').update({ folder_id: newParent }).eq('folder_id', id);
        await supabase.from('folders').delete().eq('id', id);
        io.emit('media-updated');
        return res.status(204).send();
    }

    // 2. Try to find as a Link Reference
    const { data: folderItem } = await supabase.from('folder_items').select('*').eq('id', id).maybeSingle();
    if (folderItem) {
        await supabase.from('folder_items').delete().eq('id', id);
        if (permanent === 'true') await deleteMediaPermanently(folderItem.media_id);
    } else {
        // 3. Direct Media ID (Orphan)
        await deleteMediaPermanently(id);
    }

    async function deleteMediaPermanently(mediaId) {
        // First delete all remaining references
        await supabase.from('folder_items').delete().eq('media_id', mediaId);
        
        const { data: media } = await supabase.from('media').select('*').eq('id', mediaId).maybeSingle();
        if (media && media.node_type === 'file') {
            // Delete from Storage if it's an uploaded file
            if (media.url && !media.url.includes('youtube.com')) {
                const storagePath = media.url.split('/').pop();
                if (storagePath) {
                    await supabase.storage.from('media').remove([storagePath]);
                }
            }
            await supabase.from('media').delete().eq('id', mediaId);
            
            // Cleanup Playlists
            const { data: playlists } = await supabase.from('playlists').select('id, items').eq('client_id', CLIENT_ID);
            if (playlists) {
                for (const pl of playlists) {
                    const cleanedItems = (pl.items || []).filter(item => String(item.mediaId) !== String(mediaId));
                    if (cleanedItems.length !== (pl.items || []).length) {
                        await supabase.from('playlists').update({ items: cleanedItems }).eq('id', pl.id);
                    }
                }
            }
        }
    }

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
    const { name: rawName, parent_id, node_type, items } = req.body;
    let name = rawName || "New Playlist";
    let finalName = name;
    let counter = 1;
    
    // 1. Loop until we find a unique name
    while (true) {
        const { data: existing } = await supabase
            .from('playlists')
            .select('name')
            .eq('client_id', CLIENT_ID)
            .eq('name', finalName)
            .maybeSingle();

        if (!existing) break;
        finalName = `${name} (${counter++})`;
    }

    const playlist = {
        id: Date.now().toString(),
        client_id: CLIENT_ID,
        name: finalName,
        node_type: node_type || 'playlist',
        parent_id: parent_id || null,
        items: items || []
    };

    const { error } = await supabase.from('playlists').insert(playlist);
    if (error) {
        logger.error({ error, playlist }, 'Playlist insertion failed');
        return res.status(500).json({ error: "Failed to create playlist" });
    }

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
    let query = supabase
        .from('schedules')
        .select('*')
        .eq('client_id', CLIENT_ID);

    const { screen_id } = req.query;
    if (screen_id) {
        query = query.or(`data->>screen_id.eq.${screen_id},id.eq.${screen_id}`);
    }

    const { data, error } = await query;
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

app.put('/schedules/:id', async (req, res) => {
    const { id } = req.params;
    const schedule = {
        client_id: CLIENT_ID,
        data: {
            id,
            ...req.body
        }
    };

    const { error } = await supabase
        .from('schedules')
        .update(schedule)
        .eq('id', id)
        .eq('client_id', CLIENT_ID);

    if (error) return res.status(500).json({ error });

    io.emit('playlist-updated');
    res.json(schedule.data);
});

app.delete('/schedules/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('client_id', CLIENT_ID)
        .eq('id', id);

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

    // Phase 1: Robust attribute extraction (handles both raw columns and JSONB '.data' field)
    const normalizeSchedule = (s) => {
        const sid = s.screen_id || s.data?.screen_id;
        const pid = s.playlist_id || s.data?.playlist_id;
        const active = s.active !== false && (s.data?.active !== false);
        const st = s.start_time || s.data?.start_time || "00:00";
        const et = s.end_time || s.data?.end_time || "23:59";
        const d = s.days_of_week || s.data?.days_of_week || 
                  (s.day_of_week !== undefined ? [s.day_of_week] : undefined) || 
                  (s.data?.day_of_week !== undefined ? [s.data.day_of_week] : [0,1,2,3,4,5,6]);

        if (String(sid) === String(screen.id)) {
            logger.info({ sid, pid, st, et, d, screenId: screen.id }, 'Found potentially relevant schedule');
        }

        return { sid, pid, active, st, et, d, rawId: s.id || s.data?.id };
    };

    logger.info({ screenId: screen.id, totalSchedules: allSchedules?.length }, 'Checking schedules');

    const relevantSchedules = (allSchedules || []).filter(s => {
        const norm = normalizeSchedule(s);
        return String(norm.sid) === String(screen.id) && norm.active && norm.pid;
    });

    // Phase 2: Complete playlist discovery
    const playlistIds = Array.from(new Set([
        screen.playlist_id,
        ...relevantSchedules.map(s => normalizeSchedule(s).pid)
    ].filter(Boolean)));

    const { data: playlists, error: plError } = await supabase
        .from('playlists')
        .select('*')
        .in('id', playlistIds)
        .eq('client_id', CLIENT_ID);

    if (plError || !playlists) {
        console.error("Failed to fetch playlists:", plError);
        return res.status(500).json({ error: "Failed to fetch playlists" });
    }

    // Phase 5: Defensive checks
    if (playlists.length === 0) {
        console.error("NO PLAYLISTS SENT TO PLAYER - Screen ID:", screen.id);
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

    // Phase 3: Validate and normalize
    const validSchedules = relevantSchedules
        .filter(s => {
            const norm = normalizeSchedule(s);
            return enrichedPlaylists.some(pl => String(pl.id) === String(norm.pid));
        })
        .map(s => {
            const norm = normalizeSchedule(s);
            let days = norm.d;
            if (!Array.isArray(days)) days = [days];

            return {
                id: String(norm.rawId),
                playlistId: String(norm.pid),
                startTime: norm.st,
                endTime: norm.et,
                days: days.map(Number)
            };
        });

    if (validSchedules.length === 0) {
        console.warn("NO VALID SCHEDULES FOR THIS SCREEN - Screen ID:", screen.id);
    }

    console.log("===== DATA INTEGRITY CHECK =====", {
        screenId: screen.id,
        schedulesCount: validSchedules.length,
        playlistIdsCount: playlistIds.length,
        actualPlaylistsCount: enrichedPlaylists.length
    });

    const payload = {
        screen: {
            id: screen.id,
            name: screen.name,
            defaultPlaylistId: screen.playlist_id
        },
        playlists: enrichedPlaylists,
        schedules: validSchedules
    };

    // 5. Return the payload
    logger.info({ 
        screenId: screen.id, 
        schedules: payload.schedules.length, 
        playlists: payload.playlists.map(p => p.id) 
    }, 'PLAYER CONTEXT RESPONSE');
    
    res.json(payload);
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
