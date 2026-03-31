import { Monitor, MonitorPlay, ListMusic, Image, Upload, Wifi, RefreshCw, Trash2, Plus, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { screensApi } from "@/services/api/screens";
import { playlistsApi } from "@/services/api/playlists";
import { mediaApi } from "@/services/api/media";
import { auditApi, AuditLogItem } from "@/services/api/audit";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { data: screens = [] } = useQuery({ queryKey: ['screens'], queryFn: () => screensApi.getAll() });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: () => playlistsApi.getAll() });
  const { data: media = [] } = useQuery({ queryKey: ['media'], queryFn: () => mediaApi.getAll() });
  const { data: auditLogs = [] } = useQuery({ queryKey: ['audit'], queryFn: () => auditApi.getAll() });

  const getActivityDetails = (log: AuditLogItem) => {
    let title = log.action.charAt(0).toUpperCase() + log.action.slice(1);
    let detail = `${log.resource_type} ${log.resource_id || ''}`;
    let Icon = Info;

    // Custom formatting based on resource and action
    if (log.resource_type === 'playlist') {
      Icon = log.action === 'delete' ? Trash2 : RefreshCw;
      title = log.action === 'create' ? "Playlist Created" : "Playlist Updated";
      detail = log.meta?.name || "Playlist modified";
    } else if (log.resource_type === 'media') {
      Icon = log.action === 'delete' ? Trash2 : Upload;
      title = log.action === 'upload' ? "Media Uploaded" : "Media Deleted";
      detail = log.meta?.name || "Media file change";
    } else if (log.resource_type === 'screen') {
      Icon = log.action === 'register' ? Monitor : Wifi;
      title = log.action === 'register' ? "New Screen Registered" : "Screen Updated";
      detail = log.meta?.name || log.resource_id || "Screen modified";
    }

    if (log.action === 'delete') {
        title = `${log.resource_type.charAt(0).toUpperCase() + log.resource_type.slice(1)} Deleted`;
    }

    return { title, detail, Icon };
  };

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
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border overflow-y-auto max-h-[400px]">
              {auditLogs.length > 0 ? (
                auditLogs.slice(0, 10).map((log) => {
                  const { title, detail, Icon } = getActivityDetails(log);
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-4">
                      <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground truncate">{detail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No recent activity found.
                </div>
              )}
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
