import { useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Film, RefreshCw } from "lucide-react";
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

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: mediaApi.getAll
  });

  const deleteMutation = useMutation({
    mutationFn: mediaApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] })
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setUploadOpen(false);
    }
  });

  const youtubeMutation = useMutation({
    mutationFn: (url: string) => mediaApi.addYoutube(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setYoutubeUrl("");
      setUploadOpen(false);
    }
  });

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      youtubeMutation.mutate(youtubeUrl.trim());
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
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
                <div
                  className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors relative ${dragActive ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) uploadMutation.mutate(file);
                  }}
                >
                  {uploadMutation.isPending ? (
                    <div className="flex flex-col items-center">
                      <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
                      <p className="text-sm text-foreground">Uploading to Supabase...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-foreground mb-1">Drag and drop files here</p>
                      <p className="text-xs text-muted-foreground mb-4">JPG, PNG, MP4, WEBM</p>
                      <div className="relative inline-block">
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleFileSelect}
                          accept="image/*,video/*"
                        />
                        <Button variant="outline" size="sm">Select Files</Button>
                      </div>
                    </>
                  )}
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
                        {youtubeMutation.isPending ? "Downloading..." : "Add Video"}
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
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : null}
                  {item.type === "image" ? (
                    <ImageIcon className="h-8 w-8 text-muted-foreground relative z-10" />
                  ) : (
                    <Film className="h-8 w-8 text-muted-foreground relative z-10" />
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-md bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
      </div>
    </DashboardLayout>
  );
}
