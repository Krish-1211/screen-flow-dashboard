import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Clock, Image as ImageIcon, Film, RefreshCw, Edit2, Check, X, Loader2, Folder, ChevronRight, ChevronDown, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { playlistsApi } from "@/services/api/playlists";
import { mediaApi } from "@/services/api/media";
import { ListMusic } from "lucide-react";
import type { Media, Playlist } from "@/types";

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
  const [expandedNodes, setExpandedNodes] = useState<Set<string | number>>(new Set());

  const toggleNode = (id: string | number) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ['playlists', 'tree'],
    queryFn: () => playlistsApi.getAll(true)
  });

  const { data: mediaItems = [], isLoading: mediaLoading } = useQuery<Media[]>({
    queryKey: ['media', 'tree'],
    queryFn: () => mediaApi.getAll(null, true)
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string | number, name?: string, items?: any[], parent_id?: string | null }) =>
      playlistsApi.update(vars.id, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update playlist");
    }
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Playlist>) => playlistsApi.create(payload),
    onSuccess: (newPlaylist) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      if (newPlaylist.node_type === 'playlist') {
        setSelectedId(newPlaylist.id);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: playlistsApi.delete,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      if (selectedId === deletedId) setSelectedId(null);
    }
  });

  const createFolderMutation = useMutation<any, any, { name: string, type: 'playlist' | 'media', parentId?: string | null }>({
     mutationFn: (vars) => 
        vars.type === 'playlist' ? playlistsApi.createFolder(vars.name, vars.parentId) : mediaApi.createFolder(vars.name, vars.parentId),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['playlists'] });
        queryClient.invalidateQueries({ queryKey: ['media'] });
     }
  });

  const renameMutation = useMutation<any, any, { id: string | number, name: string, type: 'playlist' | 'media' }>({
    mutationFn: (vars) =>
      vars.type === 'playlist' ? playlistsApi.update(vars.id, { name: vars.name }) : mediaApi.update(vars.id, { name: vars.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    }
  });

  const flatPlaylists = (nodes: Playlist[]): Playlist[] => {
    let flat: Playlist[] = [];
    nodes.forEach(n => {
      if (n.node_type === 'playlist') flat.push(n);
      if (n.children) flat = [...flat, ...flatPlaylists(n.children)];
    });
    return flat;
  };

  const selected = flatPlaylists(playlists).find((p: any) => String(p.id) === String(selectedId));
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    if (selected && !isEditingName) {
      setTempName(selected.name);
    }
  }, [selected?.id, selected?.name, isEditingName]);

  const addItem = (m: Media) => {
    if (!selected) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      mediaId: m.id,
      duration: (m.type === 'video' || m.type === 'youtube') ? 0 : (m.duration || 10),
      media: m
    };
    const updatedItems = [...(selected.items || []), newItem];
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const removeItem = (itemId: string | number) => {
    if (!selected) return;
    const updatedItems = selected.items?.filter((i: any) => String(i.id) !== String(itemId)) || [];
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const updateItemDuration = (itemId: string | number, duration: number) => {
    if (!selected) return;
    const updatedItems = selected.items?.map((i: any) =>
      String(i.id) === String(itemId) ? { ...i, duration } : i
    ) || [];
    updateMutation.mutate({ id: selected.id, items: updatedItems });
  };

  const updatePlaylistName = (name: string) => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, name });
  };

  // RECURSIVE RENDERERS
  const renderPlaylistTree = (nodes: Playlist[], level = 0) => {
    return nodes.map(node => {
      const isFolder = node.node_type === 'folder';
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = String(selectedId) === String(node.id);

      return (
        <div key={node.id}>
          <div
            onClick={() => isFolder ? toggleNode(node.id) : setSelectedId(node.id)}
            className={cn(
              "w-full text-left p-3 flex flex-row items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer group border-l-2 border-transparent",
              isSelected && "bg-accent/50 border-primary",
              level > 0 && "ml-2"
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isFolder ? (
                <>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Folder className="h-4 w-4 text-primary shrink-0" />
                </>
              ) : (
                <ListMusic className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
              )}
              <div className="min-w-0">
                <p className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>{node.name}</p>
                {!isFolder && <p className="text-[10px] text-muted-foreground uppercase">{node.items?.length || 0} items</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      createMutation.mutate({ name: 'New Playlist', parent_id: String(node.id) });
                      if (!isExpanded) toggleNode(node.id);
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Add Playlist"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      createFolderMutation.mutate({ name: 'New Subfolder', type: 'playlist', parentId: String(node.id) });
                      if (!isExpanded) toggleNode(node.id);
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="New Subfolder"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newName = prompt("Enter new name:", node.name);
                  if (newName && newName !== node.name) {
                    renameMutation.mutate({ id: node.id, name: newName, type: 'playlist' });
                  }
                }}
                className="text-muted-foreground hover:text-primary p-1"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(node.id); }}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {isFolder && isExpanded && node.children && (
            <div>{renderPlaylistTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const renderMediaTree = (nodes: Media[], level = 0) => {
    return nodes.map(node => {
      const isFolder = node.node_type === 'folder';
      const isExpanded = expandedNodes.has(node.id);

      if (isFolder) {
        return (
          <div key={node.id}>
            <div 
              onClick={() => toggleNode(node.id)}
              className="flex items-center gap-2 p-2 hover:bg-secondary/40 rounded transition-colors cursor-pointer group"
              style={{ marginLeft: `${level * 12}px` }}
            >
               {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
               <Folder className="h-4 w-4 text-primary shrink-0" />
               <span className="text-[11px] font-bold text-foreground truncate flex-1">{node.name}</span>
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    createFolderMutation.mutate({ name: 'New Folder', type: 'media', parentId: String(node.id) });
                    if (!isExpanded) toggleNode(node.id);
                  }}
                  className="text-muted-foreground hover:text-primary p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="New Subfolder"
               >
                 <FolderPlus className="h-3 w-3" />
               </button>
            </div>
            {isExpanded && node.children && (
              <div>{renderMediaTree(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div key={node.id} className="group relative bg-secondary/20 border border-border rounded p-2 flex items-center gap-2 hover:bg-secondary/40 transition-colors" style={{ marginLeft: `${level * 12 + 16}px` }}>
          <div className="h-10 w-12 rounded bg-secondary overflow-hidden relative shrink-0">
            {node.thumbnail && <img src={node.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
            <div className="absolute inset-0 flex items-center justify-center">
              {node.type === "image" ? <ImageIcon className="h-4 w-4" /> : <Film className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">{node.name}</p>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newName = prompt("Enter new name:", node.name);
                if (newName && newName !== node.name) {
                  renameMutation.mutate({ id: node.id, name: newName, type: 'media' });
                }
              }}
              className="text-muted-foreground hover:text-primary p-1"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              disabled={!selected}
              onClick={() => addItem(node)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      );
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Playlists</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage nested content sequences</p>
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Playlists Tree */}
          <div className="xl:col-span-3 space-y-4 w-full">
            <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-fit max-h-[400px] xl:max-h-[800px]">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">Playlists</h2>
                <div className="flex items-center gap-1">
                   <Button size="sm" variant="ghost" onClick={() => createFolderMutation.mutate({ name: 'New Folder', type: 'playlist' })}>
                     <FolderPlus className="h-4 w-4" />
                   </Button>
                   <Button size="sm" variant="ghost" onClick={() => createMutation.mutate({ name: 'New Playlist' })} disabled={createMutation.isPending}>
                     <Plus className="h-4 w-4" />
                   </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
              ) : (
                <div className="overflow-y-auto flex-1 no-scrollbar">
                   {renderPlaylistTree(playlists)}
                </div>
              )}
            </div>
          </div>

          {/* Center: Editor */}
          <div className="xl:col-span-6 bg-card border border-border rounded-lg flex flex-col h-fit min-h-[400px] xl:max-h-[800px] w-full">
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
                                updatePlaylistName(tempName);
                                setIsEditingName(false);
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
                <div className="overflow-y-auto flex-1 divide-y divide-border">
                  {!selected.items || selected.items.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-sm">
                      No items yet. Select media from the library panel.
                    </div>
                  ) : (
                    selected.items
                      .filter((i: any) => !i.is_system) // 🛡️ Filter out loop buffers/system items
                      .map((item: any) => {
                      const m = item.media || {};
                      const isVideo = m.type === 'video' || m.type === 'youtube';
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
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a playlist from the tree to edit
              </div>
            )}
          </div>

          {/* Right: Media Library Tree */}
          <div className="xl:col-span-3 space-y-4 w-full">
            <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-fit max-h-[400px] xl:max-h-[800px]">
              <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 uppercase tracking-wider">
                  Media Library
                </h2>
                <Button size="sm" variant="ghost" onClick={() => createFolderMutation.mutate({ name: 'New Media Folder', type: 'media' })}>
                   <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                {mediaLoading ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                ) : (
                  renderMediaTree(mediaItems)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
