import { Playlist, PlayerContext } from '@/types';

/**
 * ── Signage Scheduler (Production Locked Logic) ──
 * This module is extracted from the stable frontend player.
 * DO NOT modify the evaluation algorithm, timing, or day/time matching.
 */

export const localTimeStrShort = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const SAFE_PLACEHOLDER = (): Playlist => ({
  id: 'safe-recovery',
  name: 'Safe Recovery',
  items: [{
    id: 'safe-item',
    mediaId: 'safe-media',
    duration: 60,
    order: 0,
    media: {
      id: 'safe-media',
      name: 'System Recovery',
      type: 'system_gap',
      url: '/black-screen.png'
    }
  } as any]
} as any);

export const evaluateActivePlaylist = (ctx: PlayerContext): Playlist => {
  const evalNow = new Date(); // Using local time as per reference
  const currentDay = evalNow.getDay() === 0 ? 6 : evalNow.getDay() - 1;
  const currentMinutes = evalNow.getHours() * 60 + evalNow.getMinutes();

  console.log("===== STANDALONE EVALUATING PLAYLIST =====");
  console.log("Current Time:", localTimeStrShort(evalNow));
  
  const safeSchedules = (ctx.schedules || []).map(s => ({
    ...s,
    playlistId: String((s as any).playlistId || (s as any).playlist_id)
  }));

  const activeSchedules = safeSchedules.filter(s => {
    const days = (s.days || []).map(Number);
    const isDayMatch = days.includes(currentDay);
    const start = toMin(s.startTime);
    const end = toMin(s.endTime);
    
    let isTimeMatch = false;
    if (end < start) {
      // Overnight case
      isTimeMatch = currentMinutes >= start || currentMinutes < end;
    } else {
      // Normal case
      isTimeMatch = currentMinutes >= start && currentMinutes < end;
    }

    console.log(`[player-core] Eval Sched ${s.id}: dayMatch=${isDayMatch}, timeMatch=${isTimeMatch}`);
    return isDayMatch && isTimeMatch;
  });

  let targetId: string | null = null;
  let strategy = "none";

  if (activeSchedules.length > 0) {
    activeSchedules.sort((a, b) => {
      if (a.startTime !== b.startTime) return b.startTime.localeCompare(a.startTime);
      return String(b.id).localeCompare(String(a.id));
    });
    targetId = String(activeSchedules[0].playlistId);
    strategy = "schedule";
  } 
  else if (ctx.screen.defaultPlaylistId || (ctx.screen as any).playlist_id) {
    targetId = String(ctx.screen.defaultPlaylistId || (ctx.screen as any).playlist_id);
    strategy = "default";
  }

  const findPl = (id: string | null) => {
    if (!id) return null;
    return ctx.playlists.find(p => String(p.id) === id && p.items?.length > 0);
  };

  let resolved = findPl(targetId);

  if (resolved) {
    console.log(`[player-core] RESOLVED: ${resolved.id} (${strategy})`);
    
    // 🔥 SEQUENTIAL LOOP INJECTION (Carbon Copy logic)
    const items = [...(resolved.items || [])];
    if (
      items.length === 1 && 
      items[0].media?.type === 'video' &&
      !items.some(i => i.id === 'auto-loop-buffer')
    ) {
       items.push({
         id: 'auto-loop-buffer',
         mediaId: 'black',
         is_system: true,
         duration: 1,
         order: 1,
         media: {
           id: 'black',
           name: 'loop-gap',
           type: 'system_gap',
           url: '/black-screen.png',
           node_type: 'file'
         }
       } as any);
       resolved = { ...resolved, items };
    }

    return resolved;
  }

  console.warn(`[player-core] No active schedule or default found. Fallback triggered.`);
  return SAFE_PLACEHOLDER();
};
