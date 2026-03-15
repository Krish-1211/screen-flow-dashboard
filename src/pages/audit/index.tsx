import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Search, RefreshCw, Calendar, Target, User, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { auditApi, AuditLogItem } from "@/services/api/audit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function AuditLogPage() {
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', resourceFilter, actionFilter],
    queryFn: () => auditApi.getAll(
      resourceFilter !== "all" ? resourceFilter : undefined,
      actionFilter !== "all" ? actionFilter : undefined
    )
  });

  const getActionColor = (action: string) => {
    switch(action) {
      case "create": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "update": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "delete": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "bulk_assign": return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      default: return "text-gray-500 bg-gray-500/10 border-gray-500/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Audit Log
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Track all administrative actions across the system</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-[200px]">
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="screen">Screens</SelectItem>
                  <SelectItem value="playlist">Playlists</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="webhook">Webhooks</SelectItem>
                  <SelectItem value="schedule">Schedules</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="bulk_assign">Bulk Assign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <RefreshCw className="h-8 w-8 animate-spin opacity-20 mb-4" />
                <p>Loading audit logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Info className="h-10 w-10 opacity-10 mx-auto mb-2" />
                <p>No audit records found matching the filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/30 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="text-left p-4 font-semibold w-[150px]">Timestamp</th>
                      <th className="text-left p-4 font-semibold w-[150px]">User</th>
                      <th className="text-left p-4 font-semibold w-[120px]">Action</th>
                      <th className="text-left p-4 font-semibold w-[150px]">Resource</th>
                      <th className="text-left p-4 font-semibold">Details / Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((log: AuditLogItem) => (
                      <tr key={log.id} className="hover:bg-accent/5 group">
                        <td className="p-4 align-top">
                          <div className="flex items-center gap-2 text-muted-foreground text-xs whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {log.user_email || `User #${log.user_id}`}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] uppercase font-bold border",
                            getActionColor(log.action)
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-col">
                            <span className="text-foreground capitalize font-medium">{log.resource_type}</span>
                            <span className="text-muted-foreground font-mono text-[10px] bg-secondary/50 px-1 py-0.5 rounded w-fit mt-1">
                              ID: {log.resource_id || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          {log.meta && Object.keys(log.meta).length > 0 ? (
                            <div className="bg-secondary/20 border border-border rounded p-2 text-[10px] max-h-32 overflow-y-auto font-mono text-muted-foreground custom-scrollbar">
                              <pre>{JSON.stringify(log.meta, null, 2)}</pre>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No metadata</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
