import { useState, useRef, useEffect, Fragment } from "react";
import { 
  Upload, Image as ImageIcon, Film, RefreshCw, Youtube, 
  Pencil, Folder, FolderPlus, ChevronRight, Home,
  Copy, Scissors, ClipboardPaste, Edit2, Trash2
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaApi } from "@/services/api/media";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  id: string | null;
  name: string;
}

interface Media {
  id: string;
  name: string;
  type: string;
  node_type: string;
  url: string;
  mediaId?: string;
  duration?: number;
  children_count?: number;
}

const ContextMenu = ({ x, y, onClose, onAction, item, hasClipboard }: { 
  x: number; y: number; onClose: () => void; onAction: (action: string) => void; 
  item: Media | null; hasClipboard: boolean 
}) => {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1.5 min-w-[180px] animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {item && (
        <>
          <button onClick={() => onAction('copy')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-sm font-medium transition-colors">
            <Copy className="size-4 opacity-70" /> Copy
          </button>
          <button onClick={() => onAction('cut')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-sm font-medium transition-colors">
            <Scissors className="size-4 opacity-70" /> Cut
          </button>
        </>
      )}
      {hasClipboard && (
        <button onClick={() => onAction('paste')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-sm font-medium transition-colors">
          <ClipboardPaste className="size-4 opacity-70" /> Paste
        </button>
      )}
      {item && (
        <>
          <div className="h-px bg-border my-1" />
          <button onClick={() => onAction('rename')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-sm font-medium text-primary transition-colors">
            <Edit2 className="size-4" /> Rename
          </button>
          <button onClick={() => onAction('delete')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-sm font-medium text-destructive transition-colors">
            <Trash2 className="size-4" /> Delete
          </button>
          {item.node_type === 'file' && (
            <button onClick={() => onAction('delete-permanent')} className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2.5 text-xs font-bold text-destructive/70 transition-colors uppercase tracking-tight">
              <Trash2 className="size-3" /> System Wipe
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: "Library" }]);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Media | null } | null>(null);
  const [clipboard, setClipboard] = useState<{ item: Media, type: 'copy' | 'cut' } | null>(null);
  
  // Dialog/Edit State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [editingMedia, setEditingMedia] = useState<any>(null);
  const [newName, setNewName] = useState("");

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['media', currentFolderId],
    queryFn: () => mediaApi.getAll(currentFolderId)
  });

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    console.log(`[NAV DEBUG] Moving to: ${folderName} (ID: ${folderId})`);
    setCurrentFolderId(folderId);
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: "Library" }]);
    } else {
      setBreadcrumbs(prev => {
        const idx = prev.findIndex(b => b.id === folderId);
        if (idx !== -1) return prev.slice(0, idx + 1);
        return [...prev, { id: folderId, name: folderName }];
      });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => mediaApi.createFolder(name, currentFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: "Folder created" });
    }
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string | number, parentId: string | null }) => {
      console.log(`[MOVE DEBUG] Mutating Item: ${id} → Target: ${parentId}`);
      return mediaApi.update(id, { parent_id: parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: "Item moved" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: mediaApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: "Media deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name?: string }) => 
      mediaApi.upload(file, currentFolderId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setUploadOpen(false);
      setUploadName("");
      toast({ title: "Upload successful" });
    }
  });

  const youtubeMutation = useMutation({
    mutationFn: ({ url, name }: { url: string; name?: string }) => 
      mediaApi.addYoutube(url, currentFolderId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setYoutubeUrl("");
      setUploadName("");
      setUploadOpen(false);
      toast({ title: "YouTube embed added" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => mediaApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      setEditingMedia(null);
      toast({ title: "Media renamed" });
    }
  });

  const pasteMutation = useMutation({
    mutationFn: ({ mediaId, targetFolderId, type }: { mediaId: string; targetFolderId: string | null; type: 'copy' | 'cut' }) => 
      mediaApi.paste(mediaId, targetFolderId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setClipboard(null);
      toast({ title: "Pasted successfully" });
    }
  });

  const handleContextMenu = (e: React.MouseEvent, item: Media | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleAction = (action: string) => {
    if (!contextMenu) return;
    const { item } = contextMenu;

    switch (action) {
      case 'copy':
        if (item) setClipboard({ item, type: 'copy' });
        break;
      case 'cut':
        if (item) setClipboard({ item, type: 'cut' });
        break;
      case 'paste':
        if (clipboard) {
          pasteMutation.mutate({ 
            mediaId: (clipboard.item as any).mediaId || clipboard.item.id, 
            targetFolderId: currentFolderId, 
            type: clipboard.type 
          });
        }
        break;
      case 'rename':
        if (item) {
          setEditingMedia(item);
          setNewName(item.name);
        }
        break;
      case 'delete':
        if (item) deleteMutation.mutate(item.id);
        break;
      case 'delete-permanent':
        if (item && confirm("Are you sure? This will remove the file from ALL folders and playlists permanently.")) {
           const id = (item as any).mediaId || item.id;
           // We'll need a way to pass permanent=true to the delete mutation
           // I'll adjust the mediaApi service next
           deleteMutation.mutate(`${id}?permanent=true`);
        }
        break;
    }
    setContextMenu(null);
  };

  const getYoutubeThumbnail = (url: string) => {
    if (!url) return "/placeholder-youtube.png";
    
    // Robust extraction regex
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
        // Fallback: check if the URL itself is the ID
        if (url.length === 11 && !url.includes("/") && !url.includes(".")) {
            return `https://img.youtube.com/vi/${url}/hqdefault.jpg`;
        }
        return "/placeholder-youtube.png";
    }

    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Media Library</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {breadcrumbs.map((b, i) => (
                <div key={b.id || 'root'} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                  <button 
                    onClick={() => navigateToFolder(b.id, b.name)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('text-primary', 'font-bold', 'scale-110');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('text-primary', 'font-bold', 'scale-110');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.remove('text-primary', 'font-bold', 'scale-110');
                      try {
                        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                        const targetId = b.id; // Breadcrumb folder ID
                        if (data.targetMediaId && data.targetMediaId !== String(targetId)) {
                           console.log(`[DROP DEBUG] Breadcrumb Target: ${targetId}`);
                           moveMutation.mutate({ id: data.targetMediaId, parentId: targetId });
                        }
                      } catch (err) {
                         console.error("Breadcrumb drop failed", err);
                      }
                    }}
                    className={cn(
                      "hover:text-primary transition-all flex items-center gap-1 p-1 rounded-md",
                      i === breadcrumbs.length - 1 && "text-foreground font-medium"
                    )}
                  >
                    {i === 0 && <Home className="h-3.5 w-3.5" />}
                    {b.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => createFolderMutation.mutate(prompt("Folder name:", "New Folder") || "")}>
              <FolderPlus className="h-4 w-4 mr-2" />New Folder
            </Button>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button><Upload className="h-4 w-4 mr-2" />Upload Media</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Media</DialogTitle>
                  <DialogDescription>
                    Uploading into: <strong>{breadcrumbs[breadcrumbs.length-1].name}</strong>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Display Name (Optional)</p>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g. Lobby Entrance Video"
                      className="w-full bg-secondary rounded-md px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-10 text-center transition-colors relative cursor-pointer",
                      dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) uploadMutation.mutate({ file, name: uploadName.trim() || undefined });
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadMutation.isPending ? (
                      <div className="flex flex-col items-center">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
                        <p className="text-sm text-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-foreground mb-1">Drag and drop or click</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadMutation.mutate({ file, name: uploadName.trim() || undefined });
                          }}
                          accept="image/*,video/*"
                        />
                        <Button variant="outline" size="sm">Select Files</Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">OR</span>
                  </div>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (youtubeUrl.trim()) youtubeMutation.mutate({ url: youtubeUrl.trim(), name: uploadName.trim() || undefined });
                }} className="space-y-3">
                  <p className="text-sm font-medium">Add via YouTube URL</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/..."
                      className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                    />
                    <Button type="submit" disabled={youtubeMutation.isPending || !youtubeUrl.trim()}>
                      {youtubeMutation.isPending ? "Adding..." : "Add Video"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
 
        {/* Media Grid */}
        <div 
          className="min-h-[500px] p-4 bg-secondary/5 rounded-xl border border-dashed border-border/50"
          onContextMenu={(e) => handleContextMenu(e, null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            // Drop on background = move to current folder (root if applicable)
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData("text/plain"));
              if (data.targetMediaId && data.targetMediaId !== currentFolderId) {
                 console.log(`[DROP DEBUG] Grid Background Drop (Current: ${currentFolderId})`);
                 moveMutation.mutate({ id: data.targetMediaId, parentId: currentFolderId });
              }
            } catch (err) {
              console.error("Grid drop failed", err);
            }
          }}
        >
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-lg">Loading...</div>
          ) : media.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground bg-card border border-border rounded-lg border-dashed">
              <Folder className="h-10 w-10 mx-auto mb-4 opacity-20" />
              <p>This folder is empty.</p>
              <p className="text-xs mt-2">Drag files here to add them to this folder</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {media.map((item: any) => {
                const isFolder = item.node_type === 'folder';
                
                return (
                  <div 
                    key={item.id} 
                    draggable 
                    onDragStart={(e) => {
                      // We provide two IDs: 
                      // 1. mediaId: The ID from the list (could be FolderItem UUID)
                      // 2. targetMediaId: The actual file ID from the 'media' table
                      const targetMediaId = (item as any).actualMediaId || item.id;
                      e.dataTransfer.setData("text/plain", JSON.stringify({ 
                        mediaId: item.id,
                        targetMediaId: targetMediaId
                      }));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (isFolder) {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20', 'scale-[1.05]', 'z-10');
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20', 'scale-[1.05]', 'z-10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation(); // STOP BUBBLING TO GRID
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20', 'scale-[1.05]', 'z-10');
                      try {
                        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                        if (isFolder && data.targetMediaId && data.targetMediaId !== String(item.id)) {
                          console.log(`[DROP DEBUG] Target Media: ${data.targetMediaId} → Folder: ${item.id}`);
                          moveMutation.mutate({ id: data.targetMediaId, parentId: String(item.id) });
                        }
                      } catch (err) {
                        console.error("Drop failed", err);
                      }
                    }}
                    className={cn(
                      "bg-card border border-border rounded-lg overflow-hidden group transition-all animate-fade-in cursor-pointer relative",
                      isFolder ? "hover:border-primary/50 shadow-sm" : "hover:shadow-md",
                      clipboard?.item.id === item.id && "opacity-50 grayscale"
                    )}
                    onClick={() => isFolder && navigateToFolder(String(item.id), item.name)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, item);
                    }}
                  >
                    <div className="aspect-video bg-secondary flex items-center justify-center relative overflow-hidden">
                      {isFolder ? (
                        <div className="flex flex-col items-center gap-2 group-hover:scale-110 transition-transform">
                          <Folder className="h-12 w-12 text-primary" fill="currentColor" fillOpacity={0.2} />
                        </div>
                      ) : item.type === "image" ? (
                        <img src={item.url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : item.type === "youtube" ? (
                        <img src={getYoutubeThumbnail(item.url)} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <Film className="h-8 w-8 text-muted-foreground" />
                      )}
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                      
                      <div className="absolute top-2 right-2 flex gap-1 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMedia(item);
                            setNewName(item.name);
                          }}
                          className="h-7 w-7 rounded-md bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.id); }}
                          className="h-7 w-7 rounded-md bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {isFolder ? 'Folder' : item.type}
                        </span>
                        {isFolder ? (
                          <span className="text-[10px] text-primary font-bold">{item.children_count || 0} items</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{item.duration ? `${item.duration}s` : 'Static'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!editingMedia} onOpenChange={(open) => !open && setEditingMedia(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename {editingMedia?.node_type === 'folder' ? 'Folder' : 'Media'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingMedia && newName.trim()) updateMutation.mutate({ id: editingMedia.id, name: newName.trim() });
            }} className="space-y-4 pt-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-secondary rounded-md px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => setEditingMedia(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {contextMenu && (
        <ContextMenu 
          {...contextMenu} 
          onClose={() => setContextMenu(null)}
          onAction={handleAction}
          hasClipboard={!!clipboard}
        />
      )}
    </DashboardLayout>
  );
}
