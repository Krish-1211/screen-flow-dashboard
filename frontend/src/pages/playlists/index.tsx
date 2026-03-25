import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Clock, Image as ImageIcon, Film, RefreshCw, Edit2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update playlist");
    }
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
    let name = "New Playlist";
    let count = 1;
    while (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      name = `New Playlist (${count})`;
      count++;
    }
    createMutation.mutate(name);
  };

  const selected = playlists.find((p: any) => p.id === selectedId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    if (selected && !isEditingName) {
      setTempName(selected.name);
    }
  }, [selected?.id, selected?.name, isEditingName]);

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
                        "w-full text-left p-4 flex flex-row items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer group",
                        String(selectedId) === String(p.id) && "bg-accent/50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.items?.length || 0} items</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedId(p.id);
                            // Short timeout to ensure selectedId is updated before entering edit mode if it was different
                            setTimeout(() => setIsEditingName(true), 0);
                          }}
                          className="text-muted-foreground hover:text-primary p-2 shrink-0"
                          title="Rename playlist"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                          className="text-muted-foreground hover:text-destructive p-2 shrink-0"
                          title="Delete playlist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
                <div className="p-4 border-b border-border bg-card/50 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 group/header min-h-[40px]">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 flex-1 animate-in fade-in duration-200">
                        <Input
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (tempName.trim() !== "" && tempName !== selected.name) {
                                if (playlists.some(p => p.name.toLowerCase() === tempName.toLowerCase() && p.id !== selected.id)) {
                                  toast.error(`A playlist named "${tempName}" already exists`);
                                  return;
                                }
                                updatePlaylistName(tempName);
                                setIsEditingName(false);
                              } else if (tempName.trim() === "") {
                                toast.error("Playlist name cannot be empty");
                              } else {
                                setIsEditingName(false);
                              }
                            } else if (e.key === 'Escape') {
                              setTempName(selected.name);
                              setIsEditingName(false);
                            }
                          }}
                          onBlur={() => {
                            // Delay slightly to allow button clicks to process
                            setTimeout(() => {
                              if (isEditingName) {
                                setTempName(selected.name);
                                setIsEditingName(false);
                              }
                            }, 200);
                          }}
                          autoFocus
                          className="text-lg font-bold h-9 bg-secondary/50 focus-visible:ring-1 border-primary/20"
                        />
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10" 
                             onClick={(e) => {
                               e.stopPropagation();
                               if (tempName.trim() !== "" && tempName !== selected.name) {
                                 if (playlists.some(p => p.name.toLowerCase() === tempName.toLowerCase() && p.id !== selected.id)) {
                                   toast.error(`A playlist named "${tempName}" already exists`);
                                   return;
                                 }
                                 updatePlaylistName(tempName);
                               }
                               setIsEditingName(false);
                             }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTempName(selected.name);
                              setIsEditingName(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer group/title"
                        onClick={() => setIsEditingName(true)}
                        title="Click to rename"
                      >
                        <h2 className="text-lg font-bold text-foreground group-hover/title:text-primary transition-colors">
                          {selected.name}
                        </h2>
                        <div className="flex items-center gap-2">
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                          {updateMutation.isPending && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-secondary px-2 py-0.5 rounded-full animate-pulse">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Saving...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 ml-0.5">
                    <Clock className="h-3 w-3" />
                    Total: {selected.items?.length || 0} items • {selected.items?.reduce((a: number, i: any) => a + (Number(i.duration) || 0), 0) || 0}s duration
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
