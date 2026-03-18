import { useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Film, RefreshCw, Youtube, Pencil, Edit3 } from "lucide-react";
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
import { useRef } from "react";

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [editingMedia, setEditingMedia] = useState<any>(null);
  const [newName, setNewName] = useState("");

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: mediaApi.getAll
  });

  const deleteMutation = useMutation({
    mutationFn: mediaApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: "Media deleted", variant: "default" });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name?: string }) => mediaApi.upload(file, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setUploadOpen(false);
      setUploadName(""); // Reset name
      toast({ title: "Upload successful", variant: "default" });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  });

  const youtubeMutation = useMutation({
    mutationFn: ({ url, name }: { url: string; name?: string }) => mediaApi.addYoutube(url, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setYoutubeUrl("");
      setUploadName(""); // Reset name
      setUploadOpen(false);
      toast({ title: "YouTube embed added", variant: "default" });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast({ title: "YouTube download failed", description: msg, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => mediaApi.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      setEditingMedia(null);
      toast({ title: "Media renamed", variant: "default" });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast({ title: "Rename failed", description: msg, variant: "destructive" });
    },
  });

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      youtubeMutation.mutate({ url: youtubeUrl.trim(), name: uploadName.trim() || undefined });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate({ file, name: uploadName.trim() || undefined });
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMedia && newName.trim()) {
      updateMutation.mutate({ id: editingMedia.id, name: newName.trim() });
    }
  };

  const getYoutubeThumbnail = (url: string) => {
    let videoId = "";
    if (url.includes("v=")) {
      videoId = url.split("v=")[1].split("&")[0];
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1].split("?")[0];
    } else {
      videoId = url;
    }
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Media Library</h1>
            <p className="text-sm text-muted-foreground mt-1">{media.length} files tracked</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['media'] })}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button><Upload className="h-4 w-4 mr-2" />Upload Media</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Media</DialogTitle>
                  <DialogDescription>
                    Choose a file from your computer or provide a YouTube URL.
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
                    className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors relative cursor-pointer ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
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
                        <p className="text-sm text-foreground">Uploading to storage...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-foreground mb-1">Drag and drop files here or click to select</p>
                        <p className="text-xs text-muted-foreground mb-4">JPG, PNG, MP4, WEBM</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleFileSelect}
                          accept="image/*,video/*"
                        />
                        <Button variant="outline" size="sm" type="button">Select Files</Button>
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

                <form onSubmit={handleYoutubeSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Add via YouTube URL</p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 bg-secondary rounded-md px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                      />
                      <Button type="submit" disabled={youtubeMutation.isPending || !youtubeUrl.trim()}>
                        {youtubeMutation.isPending ? "Adding..." : "Add Video"}
                      </Button>
                    </div>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-lg">Loading media from network...</div>
        ) : media.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-lg">No media files uploaded yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((item: any) => (
              <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden group animate-fade-in">
                <div className="aspect-video bg-secondary flex items-center justify-center relative overflow-hidden">
                  {item.type === "image" ? (
                    <img src={item.url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : item.type === "youtube" ? (
                    <img
                      src={getYoutubeThumbnail(item.url)}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('0.jpg')) {
                          target.src = target.src.replace('hqdefault.jpg', '0.jpg');
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Film className="h-8 w-8 mb-2" />
                      <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded uppercase">Video File</span>
                    </div>
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
                  <p className="text-sm text-foreground truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground uppercase">{item.type}</span>
                    <span className="text-xs text-muted-foreground">{item.duration ? `${item.duration}s` : 'Static'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!editingMedia} onOpenChange={(open) => !open && setEditingMedia(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Media</DialogTitle>
              <DialogDescription>
                Give this media a more descriptive name for easier organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Name</p>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full bg-secondary rounded-md px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setEditingMedia(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
