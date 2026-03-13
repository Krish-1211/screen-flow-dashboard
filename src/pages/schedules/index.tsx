import { useState } from "react";
import { Plus, Monitor, ListMusic, Clock, RefreshCw, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedulesApi } from "@/services/api/schedules";
import { screensApi } from "@/services/api/screens";
import { playlistsApi } from "@/services/api/playlists";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ screenId: "", playlistId: "", day: "Mon", startHour: "9", endHour: "17" });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.getAll
  });

  const { data: screens = [] } = useQuery({
    queryKey: ['screens'],
    queryFn: screensApi.getAll
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: schedulesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] })
  });

  const addSchedule = () => {
    if (!form.screenId || !form.playlistId) return;
    createMutation.mutate({
      screenId: form.screenId,
      playlistId: form.playlistId,
      day: form.day,
      startHour: Number(form.startHour),
      endHour: Number(form.endHour)
    });
  };

  const getBlocksForDayAndHour = (day: string, hour: number) => {
    return schedules.filter(
      (s) => s.day === day && hour >= s.startHour && hour < s.endHour
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Schedules</h1>
            <p className="text-sm text-muted-foreground mt-1">Assign playlists to time slots</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['schedules'] })}>
              <RefreshCw className={cn("h-4 w-4", loadingSchedules && "animate-spin")} />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Schedule</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Schedule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Screen</Label>
                    <Select value={form.screenId} onValueChange={(v) => setForm({ ...form, screenId: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select screen" /></SelectTrigger>
                      <SelectContent>
                        {screens.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Playlist</Label>
                    <Select value={form.playlistId} onValueChange={(v) => setForm({ ...form, playlistId: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select playlist" /></SelectTrigger>
                      <SelectContent>
                        {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Hour</Label>
                      <Input type="number" min={0} max={23} value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} className="bg-secondary" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Hour</Label>
                      <Input type="number" min={0} max={24} value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} className="bg-secondary" />
                    </div>
                  </div>
                  <Button onClick={addSchedule} className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Timeline grid */}
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-[80px_repeat(24,1fr)] border-b border-border">
              <div className="p-2" />
              {hours.map((h) => (
                <div key={h} className="p-1 text-center text-[10px] text-muted-foreground border-l border-border">
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>
            {/* Days */}
            {days.map((day) => (
              <div key={day} className="grid grid-cols-[80px_repeat(24,1fr)] border-b border-border last:border-0">
                <div className="p-3 text-xs font-medium text-muted-foreground flex items-center">{day}</div>
                {hours.map((h) => {
                  const blocks = getBlocksForDayAndHour(day, h);
                  return (
                    <div key={h} className="border-l border-border h-12 relative">
                      {blocks.map((b) => {
                        const playlistName = playlists.find(p => p.id === b.playlistId)?.name || "Unknown";
                        return h === b.startHour && (
                          <div
                            key={b.id}
                            className="absolute inset-y-1 left-0 bg-primary/20 border border-primary/30 rounded text-[9px] text-primary px-1 flex items-center overflow-hidden z-10"
                            style={{ width: `${(b.endHour - b.startHour) * 100}%` }}
                          >
                            <span className="truncate">{playlistName}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule list */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Active Schedules</h2>
          </div>
          <div className="divide-y divide-border">
            {schedules.map((s) => {
              const screenName = screens.find(sc => sc.id === s.screenId)?.name || "Unknown Screen";
              const playlistName = playlists.find(p => p.id === s.playlistId)?.name || "Unknown Playlist";
              return (
                <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-accent/5 transition-colors">
                  <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{screenName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <ListMusic className="h-3 w-3" />
                      <span>{playlistName}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{s.day} {s.startHour}:00–{s.endHour}:00</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
