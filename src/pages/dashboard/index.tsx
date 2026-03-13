import { Monitor, MonitorPlay, ListMusic, Image, Upload, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { screensApi } from "@/services/api/screens";
import { playlistsApi } from "@/services/api/playlists";
import { mediaApi } from "@/services/api/media";

const recentActivity = [
  { action: "Playlist updated", detail: "Lobby Playlist — 3 items added", time: "2 min ago", icon: RefreshCw },
  { action: "Media uploaded", detail: "promo-spring-2026.mp4", time: "15 min ago", icon: Upload },
  { action: "Screen connected", detail: "Reception-TV-02", time: "1 hour ago", icon: Wifi },
  { action: "Screen offline", detail: "Cafeteria-Display-01", time: "3 hours ago", icon: WifiOff },
];

export default function DashboardPage() {
  const { data: screens = [] } = useQuery({ queryKey: ['screens'], queryFn: screensApi.getAll });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: playlistsApi.getAll });
  const { data: media = [] } = useQuery({ queryKey: ['media'], queryFn: mediaApi.getAll });

  const activeScreensCount = screens.filter((s: any) => s.status === 'online').length;

  const stats = [
    { label: "Total Screens", value: screens.length, icon: Monitor, change: "Live sync", positive: true },
    { label: "Active Screens", value: activeScreensCount, icon: MonitorPlay, change: `${screens.length > 0 ? Math.round((activeScreensCount / screens.length) * 100) : 0}% online`, positive: activeScreensCount > 0 },
    { label: "Playlists", value: playlists.length, icon: ListMusic, change: "Tracked", positive: true },
    { label: "Media Files", value: media.length, icon: Image, change: "Tracked", positive: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your signage network</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <StatsCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity (Still mocked for UI demo purposes) */}
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <a.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Screens Status */}
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-foreground">Live Screens</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">ID</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Playlist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {screens.slice(0, 5).map((s: any) => (
                    <tr key={s.id}>
                      <td className="p-3 text-foreground">{s.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{s.id}</td>
                      <td className="p-3"><StatusBadge status={s.status} /></td>
                      <td className="p-3 text-muted-foreground">{s.playlistId ? `ID: #${s.playlistId}` : 'None'}</td>
                    </tr>
                  ))}
                  {screens.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-muted-foreground">No screens online right now.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
