import { useState } from "react";
import { toast } from "sonner";
import { Plus, MoreHorizontal, RefreshCw, Monitor, CheckCircle2, X, Calendar, Copy } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { screensApi } from "@/services/api/screens";
import { playlistsApi } from "@/services/api/playlists";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ScreenDetailModal } from "@/components/screens/ScreenDetailModal";

export default function ScreensPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPlaylistId, setBulkPlaylistId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newPlaylistId, setNewPlaylistId] = useState<string>("none");
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);

  const { data: screens = [], isLoading: loadingScreens } = useQuery({
    queryKey: ['screens'],
    queryFn: screensApi.getAll,
    refetchInterval: 5000
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string, playlist_id?: number }) => screensApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      setNewName("");
      setNewPlaylistId("none");
      setOpen(false);
      toast.success("Screen registered successfully");
    },
    onError: (error: any) => {
      console.error("Failed to register screen:", error);
      toast.error(error.message || "Failed to register screen. Please try again.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string, payload: any }) => screensApi.update(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      toast.success("Screen updated");
    },
    onError: (error: any) => {
      console.error("Failed to update screen:", error);
      toast.error(error.message || "Failed to update screen");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: screensApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      toast.success("Screen deleted");
    },
    onError: (error: any) => {
      console.error("Failed to delete screen:", error);
      toast.error(error.message || "Failed to delete screen");
    }
  });

  const bulkMutation = useMutation({
    mutationFn: (vars: { ids: number[], playlistId: number }) => 
      screensApi.bulkUpdate(vars.ids, vars.playlistId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      toast.success(`Playlist assigned to ${data.updated} screens.`);
      setSelectedIds(new Set());
      setBulkPlaylistId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Bulk update failed");
    }
  });

  const addScreen = () => {
    if (!newName.trim()) {
      toast.error("Screen name is required");
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      playlist_id: newPlaylistId === "none" ? undefined : parseInt(newPlaylistId)
    });
  };

  const copyPlayerUrl = (deviceId: string) => {
    const url = `${window.location.origin}/display?device_id=${deviceId}`;
    navigator.clipboard.writeText(url);
    toast.success("Player URL copied to clipboard");
  };

  const handlePlaylistChange = (screenId: string, playlistId: string) => {
    updateMutation.mutate({
      id: screenId,
      payload: { playlistId: playlistId === "none" ? null : playlistId }
    });
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === screens.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(screens.map((s: any) => s.id)));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkPlaylistId || bulkPlaylistId === "none") return;
    bulkMutation.mutate({
      ids: Array.from(selectedIds),
      playlistId: parseInt(bulkPlaylistId)
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Screens</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your display screens</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['screens'] })}>
              <RefreshCw className={cn("h-4 w-4", loadingScreens && "animate-spin")} />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Register Screen</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Screen</DialogTitle>
                  <DialogDescription>
                    Create a screen record and assign a playlist. You can then copy the player URL to your device.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Screen Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Lobby Display"
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Initial Playlist</Label>
                    <Select value={newPlaylistId} onValueChange={setNewPlaylistId}>
                      <SelectTrigger className="bg-secondary">
                        <SelectValue placeholder="Select Playlist" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Playlist</SelectItem>
                        {playlists.map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addScreen} disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? "Registering..." : "Register Screen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loadingScreens ? (
            <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin opacity-20" />
              <p>Loading screens from network...</p>
            </div>
          ) : screens.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-4">
              <Monitor className="h-10 w-10 opacity-10" />
              <p>No screens registered yet. Click Add Screen to pair your first display.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="p-4 w-10">
                        <Checkbox 
                          checked={screens.length > 0 && selectedIds.size === screens.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="text-left p-4 font-semibold">Screen Name</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Active Playlist</th>
                      <th className="text-left p-4 font-semibold">Last Ping</th>
                      <th className="text-right p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {screens.map((s: any) => (
                      <tr key={s.id} className={cn("hover:bg-accent/10 transition-colors group", selectedIds.has(s.id) && "bg-accent/20")}>
                        <td className="p-4">
                          <Checkbox 
                            checked={selectedIds.has(s.id)}
                            onCheckedChange={() => toggleSelect(s.id)}
                            className={cn(
                              "transition-opacity",
                              selectedIds.size === 0 && "opacity-0 group-hover:opacity-100",
                              selectedIds.has(s.id) && "opacity-100"
                            )}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col group/name cursor-pointer" onClick={() => { setSelectedScreen(s); setDetailOpen(true); }}>
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-medium group-hover/name:text-primary transition-colors">{s.name}</span>
                              {s.schedule_count > 0 && (
                                <div className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20">
                                  <Calendar className="h-2.5 w-2.5" />
                                  <span>{s.schedule_count}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.id}</span>
                          </div>
                        </td>
                        <td className="p-4"><StatusBadge status={s.status} /></td>
                        <td className="p-4">
                          <Select
                            value={s.playlistId || "none"}
                            onValueChange={(val) => handlePlaylistChange(s.id, val)}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs bg-secondary/50">
                              <SelectValue placeholder="Select Playlist" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Playlist</SelectItem>
                              {playlists.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs font-mono">
                          {s.lastPing ? new Date(s.lastPing).toLocaleString() : 'Never'}
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/display?device_id=${s.device_id}`, '_blank')}>Open Player</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyPlayerUrl(s.device_id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Player URL
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteMutation.mutate(s.id)} className="text-destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {screens.map((s: any) => (
                  <div key={s.id} className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col cursor-pointer" onClick={() => { setSelectedScreen(s); setDetailOpen(true); }}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{s.name}</span>
                          {s.schedule_count > 0 && (
                            <div className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20">
                              <Calendar className="h-2.5 w-2.5" />
                              <span>{s.schedule_count}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{s.id}</span>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] text-muted-foreground uppercase">Assign Playlist</Label>
                      <Select
                        value={s.playlistId || "none"}
                        onValueChange={(val) => handlePlaylistChange(s.id, val)}
                      >
                        <SelectTrigger className="w-full h-9 text-xs bg-secondary/50">
                          <SelectValue placeholder="Select Playlist" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Playlist</SelectItem>
                          {playlists.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/50 pt-3">
                      <span>Last: {s.lastPing ? new Date(s.lastPing).toLocaleTimeString() : 'Never'}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(`/display?device_id=${s.device_id}`, '_blank')}>Open</Button>
                        <Button variant="outline" size="sm" onClick={() => copyPlayerUrl(s.device_id)}><Copy className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(s.id)} className="text-destructive">Delete</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-card border border-primary/50 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 backdrop-blur-md">
            <div className="flex items-center gap-2 pr-4 border-r border-border">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={bulkPlaylistId} onValueChange={setBulkPlaylistId}>
                <SelectTrigger className="w-[180px] h-9 bg-secondary/50 rounded-full border-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Assign Playlist..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Playlist</SelectItem>
                  {playlists.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                size="sm" 
                className="rounded-full px-4" 
                disabled={!bulkPlaylistId || bulkPlaylistId === "none" || bulkMutation.isPending}
                onClick={handleBulkAssign}
              >
                {bulkMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ScreenDetailModal 
        screen={selectedScreen} 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
      />
    </DashboardLayout>
  );
}
