import { useState } from "react";
import { Plus, MoreHorizontal, RefreshCw, Monitor } from "lucide-react";
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
import { cn } from "@/lib/utils";

export default function ScreensPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const { data: screens = [], isLoading: loadingScreens } = useQuery({
    queryKey: ['screens'],
    queryFn: screensApi.getAll
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => screensApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens'] });
      setNewName("");
      setOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string, payload: any }) => screensApi.update(vars.id, vars.payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['screens'] })
  });

  const deleteMutation = useMutation({
    mutationFn: screensApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['screens'] })
  });

  const addScreen = () => {
    if (!newName.trim()) return;
    createMutation.mutate(newName);
  };

  const handlePlaylistChange = (screenId: string, playlistId: string) => {
    updateMutation.mutate({
      id: screenId,
      payload: { playlistId: playlistId === "none" ? null : playlistId }
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
                <Button><Plus className="h-4 w-4 mr-2" />Add Screen</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Screen</DialogTitle>
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
                  <div className="bg-secondary rounded-lg p-4 text-sm space-y-2">
                    <p className="text-muted-foreground">After adding, open the display URL on your device:</p>
                    <code className="text-xs text-primary block bg-background rounded px-3 py-2 font-mono">
                      /display/[auto-generated-id]
                    </code>
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
                      <th className="text-left p-4 font-semibold">Screen Name</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Active Playlist</th>
                      <th className="text-left p-4 font-semibold">Last Ping</th>
                      <th className="text-right p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {screens.map((s: any) => (
                      <tr key={s.id} className="hover:bg-accent/10 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-foreground font-medium">{s.name}</span>
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
                          {s.lastPing ? new Date(s.lastPing).toLocaleTimeString() : 'Never'}
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/display/${s.id}`, '_blank')}>Open Player</DropdownMenuItem>
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
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{s.name}</span>
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
                        <Button variant="outline" size="sm" onClick={() => window.open(`/display/${s.id}`, '_blank')}>Open</Button>
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
    </DashboardLayout>
  );
}
