import { Monitor, MonitorPlay, ListMusic, Image, Upload, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";

const stats = [
  { label: "Total Screens", value: 24, icon: Monitor, change: "+2 this week", positive: true },
  { label: "Active Screens", value: 18, icon: MonitorPlay, change: "75% uptime", positive: true },
  { label: "Playlists", value: 12, icon: ListMusic, change: "+3 this month", positive: true },
  { label: "Media Files", value: 156, icon: Image, change: "+15 this week", positive: true },
];

const recentActivity = [
  { action: "Playlist updated", detail: "Lobby Playlist — 3 items added", time: "2 min ago", icon: RefreshCw },
  { action: "Media uploaded", detail: "promo-spring-2026.mp4", time: "15 min ago", icon: Upload },
  { action: "Screen connected", detail: "Reception-TV-02", time: "1 hour ago", icon: Wifi },
  { action: "Screen offline", detail: "Cafeteria-Display-01", time: "3 hours ago", icon: WifiOff },
];

const screens = [
  { name: "Lobby Main", id: "SCR-001", status: "online" as const, playlist: "Welcome Loop" },
  { name: "Reception TV", id: "SCR-002", status: "online" as const, playlist: "Company Info" },
  { name: "Cafeteria Display", id: "SCR-003", status: "offline" as const, playlist: "Menu Board" },
  { name: "Meeting Room A", id: "SCR-004", status: "online" as const, playlist: "Schedule" },
  { name: "Entrance Panel", id: "SCR-005", status: "online" as const, playlist: "Promotions" },
];

export default function DashboardPage() {
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
          {/* Recent Activity */}
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

          {/* Screens Status */}
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-foreground">Screens Status</h2>
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
                  {screens.map((s) => (
                    <tr key={s.id}>
                      <td className="p-3 text-foreground">{s.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{s.id}</td>
                      <td className="p-3"><StatusBadge status={s.status} /></td>
                      <td className="p-3 text-muted-foreground">{s.playlist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
