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

/**
 * Snappy buffered duration input
 */
function PlaylistDurationInput({ 
  initialValue, 
  onSave, 
  disabled 
}: { 
  initialValue: number, 
  onSave: (val: number) => void,
  disabled?: boolean
}) {
  const [localValue, setLocalValue] = useState(initialValue.toString());

  useEffect(() => {
    setLocalValue(initialValue.toString());
  }, [initialValue]);

  const handleBlur = () => {
    const val = parseInt(localValue);
    if (!isNaN(val) && val !== initialValue) {
      onSave(val);
    } else {
      setLocalValue(initialValue.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    else if (e.key === 'Escape') {
      setLocalValue(initialValue.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded border border-primary/20">
        <span className="text-[10px] font-bold text-primary uppercase whitespace-nowrap">Auto Length</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded border border-border">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-8 h-5 text-xs bg-transparent border-none text-center p-0 font-medium focus:ring-0"
      />
      <span className="text-[10px] text-muted-foreground font-medium">s</span>
    </div>
  );
}

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
      duration: m.type === 'video' ? 0 : (m.duration || 10),
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
          {/* Left: Playlists List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">Playlists</h2>
                <Button size="sm" variant="ghost" onClick={addPlaylist} disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
              ) : (
                <div className="divide-y divide-border">
                  {playlists.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "w-full text-left p-4 flex flex-row items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer group",
                        String(selectedId) === String(p.id) && "bg-accent/50 border-l-2 border-primary"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", String(selectedId) === String(p.id) ? "text-primary" : "text-foreground")}>{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.items?.length || 0} items</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                        className="text-muted-foreground hover:text-destructive p-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center: Editor */}
          <div className="lg:col-span-6 bg-card border border-border rounded-lg">
            {selected ? (
              <>
                <div className="p-4 border-b border-border bg-card/50">
                  <div className="flex items-center justify-between gap-2 group/header min-h-[40px]">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (tempName.trim() !== "" && tempName !== selected.name) {
                                if (playlists.some(p => p.name.toLowerCase() === tempName.toLowerCase() && p.id !== selected.id)) {
                                  toast.error(`Playlist "${tempName}" already exists`);
                                  return;
                                }
                                updatePlaylistName(tempName);
                                setIsEditingName(false);
                              } else if (tempName.trim() === "") {
                                toast.error("Name cannot be empty");
                              } else {
                                setIsEditingName(false);
                              }
                            } else if (e.key === 'Escape') {
                              setIsEditingName(false);
                            }
                          }}
                          autoFocus
                          className="text-lg font-bold h-9 bg-secondary/50"
                        />
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}><Check className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-1 cursor-pointer group/title" onClick={() => setIsEditingName(true)}>
                        <h2 className="text-lg font-bold text-foreground group-hover/title:text-primary transition-colors">
                          {selected.name}
                        </h2>
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Total: {selected.items?.length || 0} items • {selected.items?.reduce((a: number, i: any) => a + (Number(i.duration) || 0), 0) || 0}s duration
                  </p>
                </div>
                {!selected.items || selected.items.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    No items yet. Select media from the library panel.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selected.items.map((item: any) => {
                      const m = item.media || {};
                      const isVideo = m.type === 'video';
                      return (
                        <div key={item.id} className="flex flex-row items-center gap-3 p-3 hover:bg-accent/10 transition-colors group">
                          <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab shrink-0" />
                          <div className="h-10 w-14 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative border border-border">
                            {m.thumbnail && <img src={m.thumbnail} alt={m.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                            {m.type === "image" ? <ImageIcon className="h-4 w-4 text-muted-foreground relative z-10" /> : <Film className="h-4 w-4 text-muted-foreground relative z-10" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.name || "Unknown Media"}</p>
                            <p className="text-xs text-muted-foreground uppercase text-[10px] tracking-wider font-bold">{m.type}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <PlaylistDurationInput 
                              initialValue={item.duration || 10}
                              onSave={(val) => updateItemDuration(item.id, val)}
                              disabled={isVideo}
                            />
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Select a playlist to edit contents
              </div>
            )}
          </div>

          {/* Right: Media Library */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col max-h-[600px]">
              <div className="p-4 border-b border-border bg-card">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 uppercase tracking-wider">
                  Media Library
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {media.map((m: any) => (
                  <div key={m.id} className="group relative bg-secondary/20 border border-border rounded p-2 flex items-center gap-2 hover:bg-secondary/40 transition-colors">
                    <div className="h-10 w-12 rounded bg-secondary overflow-hidden relative shrink-0">
                      {m.thumbnail && <img src={m.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {m.type === "image" ? <ImageIcon className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                      </div>
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
