import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Clock, Image as ImageIcon, Film, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playlistsApi } from "@/services/api/playlists";
import { mediaApi } from "@/services/api/media";
import { ListMusic } from "lucide-react";
import type { Media } from "@/types";

export default function PlaylistsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string | number, name?: string, items?: any[] }) =>
      playlistsApi.update(vars.id, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] })
  });

  const { data: media = [] } = useQuery<Media[]>({
    queryKey: ['media'],
    queryFn: mediaApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => playlistsApi.create({ name }),
    onSuccess: (newPlaylist) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setSelectedId(newPlaylist.id);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: playlistsApi.delete,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      if (selectedId === deletedId) setSelectedId(null);
    }
  });

  const addPlaylist = () => {
    createMutation.mutate("New Playlist");
  };

  const selected = playlists.find((p: any) => p.id === selectedId);

  const addItem = (m: any) => {
    if (!selected) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      mediaId: m.id,
      duration: m.duration || 10,
      media: m
    };
    const updatedItems = [...(selected.items || []), newItem];
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const removeItem = (itemId: string | number) => {
    if (!selected) return;
    const updatedItems = selected.items.filter((i: any) => String(i.id) !== String(itemId));
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const updateItemDuration = (itemId: string | number, duration: number) => {
    if (!selected) return;
    const updatedItems = selected.items.map((i: any) =>
      String(i.id) === String(itemId) ? { ...i, duration } : i
    );
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const updatePlaylistName = (name: string) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, name });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Playlists</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage content playlists</p>
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['playlists'] })}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Playlist list */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <h2 className="text-sm font-medium text-foreground">Playlists</h2>
                <Button size="sm" variant="ghost" onClick={addPlaylist} disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading playlists...</div>
              ) : playlists.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No playlists created.</div>
              ) : (
                <div className="divide-y divide-border">
                  {playlists.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "w-full text-left p-4 flex flex-row items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer",
                        String(selectedId) === String(p.id) && "bg-accent/50"
                      )}
                    >
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.items?.length || 0} items</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                        className="text-muted-foreground hover:text-destructive p-2 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Playlist editor */}
          <div className="lg:col-span-6 bg-card border border-border rounded-lg">
            {selected ? (
              <>
                <div className="p-4 border-b border-border bg-card/50 flex flex-col gap-2">
                  <Input
                    value={selected.name}
                    onChange={(e) => updatePlaylistName(e.target.value)}
                    className="text-base font-semibold text-foreground bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total duration: {selected.items?.reduce((a: number, i: any) => a + (Number(i.duration) || 0), 0) || 0}s
                  </p>
                </div>
                {!selected.items || selected.items.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-4">
                    <ListMusic className="h-8 w-8 opacity-20" />
                    <p>No items yet. Select media from the library panel.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selected.items.map((item: any) => {
                      const m = item.media || {};
                      return (
                        <div key={item.id} className="flex flex-row items-center gap-3 p-3 hover:bg-accent/10 transition-colors">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                          <div className="h-10 w-14 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative border border-border">
                            {m.thumbnail ? (
                              <img src={m.thumbnail} alt={m.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                            ) : null}
                            {m.type === "image" ? (
                              <ImageIcon className="h-4 w-4 text-muted-foreground relative z-10" />
                            ) : (
                              <Film className="h-4 w-4 text-muted-foreground relative z-10" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.name || "Unknown Media"}</p>
                            <p className="text-xs text-muted-foreground uppercase">{m.type || "unknown"}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 bg-secondary/30 px-2 py-1 rounded border border-border">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <input
                              type="number"
                              value={item.duration || 10}
                              onChange={(e) => updateItemDuration(item.id, Number(e.target.value))}
                              className="w-8 h-5 text-xs bg-transparent border-none text-center p-0 font-medium focus:ring-0"
                            />
                            <span className="text-[10px] text-muted-foreground font-medium">s</span>
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0 p-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                <Plus className="h-6 w-6 opacity-20" />
                {playlists.length > 0 ? "Select a playlist to edit contents" : "Create a playlist to get started"}
              </div>
            )}
          </div>

          {/* Media Selection Panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-border bg-card">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Media Library
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[600px]">
                {media.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground p-4">No media found. Go to Media Library to upload.</p>
                ) : (
                  media.map((m: any) => (
                    <div key={m.id} className="group relative bg-secondary/20 border border-border rounded p-2 flex items-center gap-2 hover:bg-secondary/40 transition-colors">
                      <div className="h-10 w-12 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative">
                        {m.thumbnail && <img src={m.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                        {m.type === "image" ? <ImageIcon className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{m.name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={!selected}
                        onClick={() => addItem(m)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
