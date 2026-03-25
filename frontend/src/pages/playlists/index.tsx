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
 * A debounced/buffered duration input to keep the UI snappy
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

  // Sync with prop if it changes externally
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
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setLocalValue(initialValue.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20 text-primary transition-all">
        <Film className="h-3 w-3" />
        <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Auto Length</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border group-shadow-sm focus-within:border-primary/50 focus-within:bg-secondary/50 transition-all">
      <Clock className="h-3 w-3 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-8 h-5 text-xs bg-transparent border-none text-center p-0 font-bold focus:ring-0 text-foreground"
      />
      <span className="text-[10px] text-muted-foreground font-bold">s</span>
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
      <div className="space-y-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em] mb-3">
              <ListMusic className="h-4 w-4" />
              <span>Curation Engine</span>
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tight">Playlists</h1>
            <p className="text-muted-foreground mt-2 text-lg font-medium opacity-80">Design seamless content sequences for your digital spaces.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['playlists'] })} className="h-12 w-12 rounded-2xl bg-secondary/40 hover:bg-secondary/60">
              <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
            </Button>
            <Button onClick={addPlaylist} disabled={createMutation.isPending} className="h-12 px-6 rounded-2xl shadow-xl shadow-primary/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-5 w-5 mr-2" />New Playlist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Library explorer */}
          <div className="lg:col-span-3 space-y-6">
             <div className="bg-card/50 border border-border/60 rounded-[2rem] overflow-hidden backdrop-blur-sm shadow-xl shadow-foreground/[0.02]">
                <div className="p-6 border-b border-border/40 bg-card/60">
                   <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                     <ImageIcon className="h-4 w-4 text-primary" /> Media Assets
                   </h2>
                </div>
                <div className="p-3 space-y-2 max-h-[640px] overflow-y-auto no-scrollbar">
                  {media.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground/60">
                       <p className="text-xs font-bold uppercase tracking-widest">Library Empty</p>
                    </div>
                  ) : media.map((m: any) => (
                    <div key={m.id} className="group relative bg-card/40 border border-border/40 rounded-2xl p-2.5 flex items-center gap-3 hover:border-primary/40 hover:bg-card transition-all cursor-default">
                      <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                        {m.thumbnail && <img src={m.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" />}
                        {m.type === "image" ? <ImageIcon className="h-4 w-4 relative z-10" /> : <Film className="h-4 w-4 relative z-10" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{m.type}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white"
                        disabled={!selected}
                        onClick={() => addItem(m)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Catalog Selection */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card border border-border/40 rounded-[2rem] overflow-hidden shadow-xl shadow-foreground/[0.02]">
              <div className="p-6 border-b border-border/40 bg-card/60">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Catalog</h2>
              </div>
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[640px]">
                {playlists.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "w-full text-left p-6 flex flex-row items-center justify-between hover:bg-secondary/40 transition-all cursor-pointer group border-l-4 border-transparent",
                      String(selectedId) === String(p.id) && "bg-secondary border-primary"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-base font-bold truncate transition-colors", String(selectedId) === String(p.id) ? "text-primary" : "text-foreground group-hover:text-primary")}>{p.name}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-tighter opacity-60">{p.items?.length || 0} Assets assigned</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                      className="text-muted-foreground hover:text-destructive p-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sequence Editor */}
          <div className="lg:col-span-6 bg-card border border-border/60 rounded-[2.5rem] shadow-2xl shadow-foreground/[0.03] overflow-hidden flex flex-col min-h-[500px]">
            {selected ? (
              <>
                <div className="p-8 border-b border-border/40 bg-card/80 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-4 group/header mb-6">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 flex-1 animate-in fade-in duration-300">
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
                          autoFocus
                          className="text-2xl font-black h-12 bg-secondary/50 border-primary/20 rounded-2xl focus-visible:ring-primary/20"
                        />
                        <Button onClick={() => setIsEditingName(false)} variant="ghost" size="icon" className="h-12 w-12 rounded-2xl"><Check className="h-5 w-5 text-primary" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 flex-1 cursor-pointer group/title" onClick={() => setIsEditingName(true)}>
                        <h2 className="text-3xl font-black text-foreground group-hover/title:text-primary transition-colors tracking-tight">
                          {selected.name}
                        </h2>
                        <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-all" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2 px-4 py-2 bg-secondary/60 rounded-2xl">
                        <ListMusic className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest text-foreground">{selected.items?.length || 0} Items</span>
                     </div>
                     <div className="flex items-center gap-2 px-4 py-2 bg-secondary/60 rounded-2xl">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest text-foreground">
                          {selected.items?.reduce((a: number, i: any) => a + (Number(i.duration) || 0), 0) || 0}s Runtime
                        </span>
                     </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {!selected.items || selected.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-40">
                       <Plus className="h-12 w-12 mb-4" />
                       <p className="text-sm font-bold uppercase tracking-[0.2em]">Add content from the library</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selected.items.map((item: any) => {
                        const m = item.media || {};
                        const isVideo = m.type === 'video';
                        return (
                          <div key={item.id} className="flex flex-row items-center gap-4 p-4 bg-card/60 border border-border/40 rounded-[2rem] hover:border-primary/30 hover:bg-secondary/20 transition-all group overflow-hidden">
                            <div className="flex items-center gap-3">
                               <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
                               <div className="h-16 w-24 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden relative border border-border/40 shadow-sm">
                                  {m.thumbnail ? (
                                    <img src={m.thumbnail} alt={m.name} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-500" />
                                  ) : null}
                                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                     {m.type === "image" ? <ImageIcon className="h-5 w-5 text-white/80" /> : <Film className="h-5 w-5 text-white/80" />}
                                  </div>
                               </div>
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                               <p className="text-base font-bold text-foreground truncate">{m.name || "Unknown Media"}</p>
                               <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg",
                                    isVideo ? "bg-amber-100/50 text-amber-700" : "bg-blue-100/50 text-blue-700"
                                  )}>
                                    {m.type || "unknown"}
                                  </span>
                               </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-4">
                              <PlaylistDurationInput 
                                initialValue={item.duration || 10}
                                onSave={(val) => updateItemDuration(item.id, val)}
                                disabled={isVideo}
                              />
                              <button
                                onClick={() => removeItem(item.id)}
                                className="h-10 w-10 flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
                <div className="w-20 h-20 bg-secondary rounded-[2.5rem] flex items-center justify-center shadow-xl">
                   <ListMusic className="h-10 w-10 text-primary opacity-40" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-foreground tracking-tight">Select a Sequence</h3>
                   <p className="text-muted-foreground text-sm font-medium mt-1">Pick a playlist from the catalog to start curating.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
