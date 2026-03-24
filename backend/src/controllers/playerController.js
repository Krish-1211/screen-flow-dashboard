import prisma from '../db/client.js';
import { getActivePlaylist } from '../scheduler/engine.js';
import pino from 'pino';

const logger = pino();

export const playerController = {
    /**
     * Called by players to get their current content
     */
    getPlaylist: async (req, res) => {
        try {
            const { device_id, local_time, local_day } = req.query;
            if (!device_id) return res.status(400).json({ error: "device_id is required" });

            let screen = await prisma.screen.findUnique({ where: { deviceId: device_id } });
            
            // Auto-register new screens
            if (!screen) {
                screen = await prisma.screen.create({
                    data: {
                        deviceId: device_id,
                        name: `New Screen (${device_id.slice(-4)})`,
                        status: 'online',
                        lastSeen: new Date()
                    }
                });
                logger.info({ deviceId: device_id }, 'Auto-registered new screen');
            }

            const activePlaylist = await getActivePlaylist(screen, local_time, local_day);
            
            if (!activePlaylist) {
                return res.json({
                    id: "fallback",
                    name: "No Content",
                    items: [{
                        id: "f1",
                        media: { 
                            name: "No Content", 
                            type: "image", 
                            url: "https://placehold.co/1920x1080?text=No+Content" 
                        },
                        duration: 10
                    }]
                });
            }
            res.json({
                ...activePlaylist,
                version: activePlaylist.updatedAt || new Date().toISOString()
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    },

    /**
     * Heartbeat ping from players
     */
    heartbeat: async (req, res) => {
        const { device_id } = req.body;
        if (!device_id) return res.status(400).json({ error: "device_id is required" });

        try {
            await prisma.screen.update({
                where: { deviceId: device_id },
                data: {
                    status: 'online',
                    lastSeen: new Date()
                }
            });
            res.status(204).send();
        } catch (err) {
            res.status(404).json({ error: "Screen not found" });
        }
    }
};
