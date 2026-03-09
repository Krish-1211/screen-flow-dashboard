import { useState } from "react";
import { Plus, Trash2, GripVertical, Clock, Image as ImageIcon, Film } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlaylistItem {
  id: number;
  name: string;
  type: "image" | "video";
  duration: number;
}

interface Playlist {
  id: number;
  name: string;
  items: PlaylistItem[];
}

const initialPlaylists: Playlist[] = [
  {
    id: 1,
    name: "Welcome Loop",
    items: [
      { id: 1, name: "promo-banner.jpg", type: "image", duration: 10 },
      { id: 2, name: "welcome-video.mp4", type: "video", duration: 30 },
      { id: 3, name: "spring-sale.jpg", type: "image", duration: 8 },
    ],
  },
  {
    id: 2,
    name: "Menu Board",
    items: [
      { id: 4, name: "menu-board.png", type: "image", duration: 15 },
    ],
  },
  {
    id: 3,
    name: "Company Info",
    items: [
      { id: 5, name: "company-intro.mp4", type: "video", duration: 60 },
      { id: 6, name: "logo-animation.webm", type: "video", duration: 5 },
    ],
  },
];

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [selectedId, setSelectedId] = useState(1);

  const selected = playlists.find((p) => p.id === selectedId);

  const addPlaylist = () => {
    const newId = Math.max(...playlists.map((p) => p.id)) + 1;
    setPlaylists([...playlists, { id: newId, name: "New Playlist", items: [] }]);
    setSelectedId(newId);
  };

  const deletePlaylist = (id: number) => {
    const updated = playlists.filter((p) => p.id !== id);
    setPlaylists(updated);
    if (selectedId === id && updated.length > 0) setSelectedId(updated[0].id);
  };

  const removeItem = (itemId: number) => {
    setPlaylists(
      playlists.map((p) =>
        p.id === selectedId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p
      )
    );
  };

  const updateDuration = (itemId: number, duration: number) => {
    setPlaylists(
      playlists.map((p) =>
        p.id === selectedId
          ? { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, duration } : i)) }
          : p
      )
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Playlists</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage content playlists</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Playlist list */}
          <div className="lg:col-span-4 bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Playlists</h2>
              <Button size="sm" variant="ghost" onClick={addPlaylist}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full text-left p-4 flex items-center justify-between hover:bg-accent/30 transition-colors",
                    selectedId === p.id && "bg-accent/50"
                  )}
                >
                  <div>
                    <p className="text-sm text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.items.length} items</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePlaylist(p.id); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Playlist editor */}
          <div className="lg:col-span-8 bg-card border border-border rounded-lg">
            {selected ? (
              <>
                <div className="p-4 border-b border-border">
                  <h2 className="text-sm font-medium text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total duration: {selected.items.reduce((a, i) => a + i.duration, 0)}s
                  </p>
                </div>
                {selected.items.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    No items yet. Add media from the library.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selected.items.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 p-4">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                        <div className="h-10 w-14 rounded bg-secondary flex items-center justify-center shrink-0">
                          {item.type === "image" ? (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Film className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="number"
                            value={item.duration}
                            onChange={(e) => updateDuration(item.id, Number(e.target.value))}
                            className="w-16 h-8 text-xs bg-secondary text-center"
                          />
                          <span className="text-xs text-muted-foreground">s</span>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-10 text-center text-muted-foreground text-sm">
                Select a playlist to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
