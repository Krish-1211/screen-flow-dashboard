import prisma from '../db/client.js';
import pino from 'pino';

const logger = pino();

export function enrichMedia(media) {
    if (!media) return null;
    
    // Force HTTPS on all media URLs to prevent mixed-content browser errors
    let url = media.url;
    if (url && url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }

    return {
        id: media.id,
        name: media.name,
        type: media.type,
        url,
        duration: media.duration || 10,
        createdAt: media.createdAt
    };
}

export async function enrichPlaylistData(playlist) {
    if (!playlist || !playlist.items) return playlist;
    
    // Fetch all media for the items
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

/**
 * Returns the currently active playlist based on screen-specific or global schedules
 */
export async function getActivePlaylist(screen, clientTime = null, clientDay = null) {
    if (!screen) return null;

    const schedules = await prisma.schedule.findMany({
        where: {
            OR: [
                { screenId: screen.id },
                { screenId: null },
                { screenId: "" }
            ]
        }
    });

    let currentTime = clientTime;
    let currentWeekday = clientDay !== null ? parseInt(clientDay) : null;

    if (!currentTime || currentWeekday === null) {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMin = String(now.getMinutes()).padStart(2, '0');
        currentTime = currentTime || `${currentHour}:${currentMin}`;
        
        // Map JS 0=Sun to Dashboard 6=Sun
        const jsDay = now.getDay();
        currentWeekday = currentWeekday !== null ? currentWeekday : (jsDay === 0 ? 6 : jsDay - 1);
    }

    const validSchedules = schedules.filter(sch => {
        let days = [];
        try { 
            days = typeof sch.daysOfWeek === 'string' ? JSON.parse(sch.daysOfWeek) : sch.daysOfWeek;
        } catch { 
            days = String(sch.daysOfWeek).split(',').map(n => parseInt(n.trim(), 10)); 
        }

        const dayMatch = days.includes(currentWeekday);
        
        // 1-minute buffer for perfect polling cycle sync
        let schStartH = parseInt(sch.startTime.split(':')[0], 10);
        let schStartM = parseInt(sch.startTime.split(':')[1], 10);
        schStartM -= 1;
        if (schStartM < 0) {
            schStartM = 59;
            schStartH -= 1;
        }
        const effectiveStartTime = `${String(schStartH).padStart(2, '0')}:${String(schStartM).padStart(2, '0')}`;
        const timeMatch = currentTime >= effectiveStartTime && currentTime <= sch.endTime;

        return dayMatch && timeMatch;
    });

    if (validSchedules.length > 0) {
        const activeSchedule = validSchedules[0];
        const playlist = await prisma.playlist.findUnique({
            where: { id: activeSchedule.playlistId },
            include: { items: true }
        });
        
        if (playlist) return await enrichPlaylistData(playlist);
    }

    // Default Fallback to assigned playlist
    if (screen.currentPlaylistId) {
        const fallbackPlaylist = await prisma.playlist.findUnique({
            where: { id: screen.currentPlaylistId },
            include: { items: true }
        });
        if (fallbackPlaylist) return await enrichPlaylistData(fallbackPlaylist);
    }

    return null;
}
