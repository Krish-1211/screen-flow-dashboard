import { useState } from "react";
import { Plus, MoreHorizontal, Copy } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const initialScreens = [
  { name: "Lobby Main", id: "SCR-001", status: "online" as const, playlist: "Welcome Loop", lastSeen: "Just now" },
  { name: "Reception TV", id: "SCR-002", status: "online" as const, playlist: "Company Info", lastSeen: "2 min ago" },
  { name: "Cafeteria Display", id: "SCR-003", status: "offline" as const, playlist: "Menu Board", lastSeen: "3 hours ago" },
  { name: "Meeting Room A", id: "SCR-004", status: "online" as const, playlist: "Schedule", lastSeen: "Just now" },
  { name: "Entrance Panel", id: "SCR-005", status: "online" as const, playlist: "Promotions", lastSeen: "1 min ago" },
  { name: "Hallway Display", id: "SCR-006", status: "offline" as const, playlist: "Unassigned", lastSeen: "1 day ago" },
];

export default function ScreensPage() {
  const [screens, setScreens] = useState(initialScreens);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);

  const addScreen = () => {
    if (!newName.trim()) return;
    const id = `SCR-${String(screens.length + 1).padStart(3, "0")}`;
    setScreens([...screens, { name: newName, id, status: "offline", playlist: "Unassigned", lastSeen: "Never" }]);
    setNewName("");
    setOpen(false);
  };

  const deleteScreen = (id: string) => {
    setScreens(screens.filter((s) => s.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Screens</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your display screens</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Screen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Screen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Screen Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Lobby Display"
                    className="bg-secondary"
                  />
                </div>
                <div className="bg-secondary rounded-lg p-4 text-sm space-y-2">
                  <p className="text-muted-foreground">After adding, open the display URL on your device:</p>
                  <code className="text-xs text-primary block bg-background rounded px-3 py-2 font-mono">
                    /display/{`SCR-${String(screens.length + 1).padStart(3, "0")}`}
                  </code>
                </div>
                <Button onClick={addScreen} className="w-full">Register Screen</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Desktop table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-4 font-medium">Screen Name</th>
                  <th className="text-left p-4 font-medium">Screen ID</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Playlist</th>
                  <th className="text-left p-4 font-medium">Last Seen</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {screens.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-4 text-foreground font-medium">{s.name}</td>
                    <td className="p-4">
                      <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {s.id}
                      </span>
                    </td>
                    <td className="p-4"><StatusBadge status={s.status} /></td>
                    <td className="p-4 text-muted-foreground">{s.playlist}</td>
                    <td className="p-4 text-muted-foreground text-xs">{s.lastSeen}</td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Assign Playlist</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteScreen(s.id)} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {screens.map((s) => (
              <div key={s.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{s.id}</span>
                  <span>{s.lastSeen}</span>
                </div>
                <p className="text-xs text-muted-foreground">Playlist: {s.playlist}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
