import { useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Film, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialMedia = [
  { id: 1, name: "promo-banner.jpg", type: "image", size: "2.4 MB" },
  { id: 2, name: "welcome-video.mp4", type: "video", size: "18.7 MB" },
  { id: 3, name: "menu-board.png", type: "image", size: "1.1 MB" },
  { id: 4, name: "company-intro.mp4", type: "video", size: "45.2 MB" },
  { id: 5, name: "spring-sale.jpg", type: "image", size: "3.8 MB" },
  { id: 6, name: "logo-animation.webm", type: "video", size: "5.6 MB" },
  { id: 7, name: "schedule-bg.png", type: "image", size: "890 KB" },
  { id: 8, name: "product-showcase.mp4", type: "video", size: "32.1 MB" },
];

export default function MediaLibraryPage() {
  const [media, setMedia] = useState(initialMedia);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const deleteMedia = (id: number) => {
    setMedia(media.filter((m) => m.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Media Library</h1>
            <p className="text-sm text-muted-foreground mt-1">{media.length} files</p>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button><Upload className="h-4 w-4 mr-2" />Upload Media</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Media</DialogTitle>
              </DialogHeader>
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground mb-1">Drag and drop files here</p>
                <p className="text-xs text-muted-foreground mb-4">JPG, PNG, MP4, WEBM</p>
                <Button variant="outline" size="sm">Select Files</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden group animate-fade-in">
              <div className="aspect-video bg-secondary flex items-center justify-center relative">
                {item.type === "image" ? (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Film className="h-8 w-8 text-muted-foreground" />
                )}
                <button
                  onClick={() => deleteMedia(item.id)}
                  className="absolute top-2 right-2 h-7 w-7 rounded-md bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <p className="text-sm text-foreground truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground uppercase">{item.type}</span>
                  <span className="text-xs text-muted-foreground">{item.size}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
