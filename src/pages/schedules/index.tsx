import { useState } from "react";
import { Plus, Monitor, ListMusic, Clock, RefreshCw, Trash2, Calendar } from "lucide-react";
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
import { toast } from "sonner";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ 
    screen_id: "", 
    playlist_id: "", 
    name: "",
    days_of_week: [0, 1, 2, 3, 4], 
    start_time: "09:00", 
    end_time: "17:00",
    active: true
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.getAll()
  });

  const { data: screens = [] } = useQuery({
    queryKey: ['screens'],
    queryFn: () => screensApi.getAll()
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistsApi.getAll()
  });

  const createMutation = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setOpen(false);
      toast.success("Schedule created successfully");
      setForm({
        screen_id: "", 
        playlist_id: "", 
        name: "",
        days_of_week: [0, 1, 2, 3, 4], 
        start_time: "09:00", 
        end_time: "17:00",
        active: true
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create schedule");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: schedulesApi.delete,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        toast.success("Schedule deleted");
    }
  });

  const addSchedule = () => {
    if (!form.screen_id || !form.playlist_id) return;
    createMutation.mutate({
      screen_id: parseInt(form.screen_id),
      playlist_id: parseInt(form.playlist_id),
      name: form.name,
      days_of_week: form.days_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      active: form.active
    });
  };

  const toggleDay = (dayIndex: number) => {
    setForm(prev => ({
        ...prev,
        days_of_week: prev.days_of_week.includes(dayIndex)
            ? prev.days_of_week.filter(d => d !== dayIndex)
            : [...prev.days_of_week, dayIndex]
    }));
  };

  const getBlocksForDayAndHour = (dayIndex: number, hour: number) => {
    return schedules.filter(
      (s: any) => {
          if (!s.days_of_week.includes(dayIndex)) return false;
          const startH = parseInt(s.start_time.split(':')[0]);
          const endH = parseInt(s.end_time.split(':')[0]);
          return hour >= startH && hour < endH;
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                Schedules
            </h1>
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
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Schedule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Schedule Name (Optional)</Label>
                    <Input 
                        placeholder="e.g. Lunch Menu"
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                        className="bg-secondary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Screen</Label>
                    <Select value={form.screen_id} onValueChange={(v) => setForm({ ...form, screen_id: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select screen" /></SelectTrigger>
                      <SelectContent>
                        {screens.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Playlist</Label>
                    <Select value={form.playlist_id} onValueChange={(v) => setForm({ ...form, playlist_id: v })}>
                      <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select playlist" /></SelectTrigger>
                      <SelectContent>
                        {playlists.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="flex gap-1">
                          {days.map((day, i) => (
                              <button
                                  key={day}
                                  onClick={() => toggleDay(i)}
                                  className={cn(
                                      "flex-1 h-8 rounded text-xs font-medium border transition-all",
                                      form.days_of_week.includes(i)
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                                  )}
                              >
                                  {day[0]}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="bg-secondary" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="bg-secondary" />
                    </div>
                  </div>
                  <Button onClick={addSchedule} className="w-full" disabled={createMutation.isPending || !form.screen_id || !form.playlist_id}>
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
            {days.map((day, dayIndex) => (
              <div key={day} className="grid grid-cols-[80px_repeat(24,1fr)] border-b border-border last:border-0 relative">
                <div className="p-3 text-xs font-medium text-muted-foreground flex items-center bg-card/50 sticky left-0 z-20 border-r border-border">{day}</div>
                {hours.map((h) => {
                  const blocks = getBlocksForDayAndHour(dayIndex, h);
                  return (
                    <div key={h} className="border-l border-border h-12 relative z-0">
                      {blocks.map((b: any) => {
                        const playlistName = playlists.find((p: any) => p.id === b.playlist_id)?.name || "Unknown";
                        const startH = parseInt(b.start_time.split(':')[0]);
                        const endH = parseInt(b.end_time.split(':')[0]);
                        return h === startH && (
                          <div
                            key={b.id}
                            className="absolute top-1 bottom-1 left-0 bg-primary/20 border border-primary/30 rounded text-[9px] text-primary px-1.5 flex items-center overflow-hidden z-10 hover:bg-primary/30 hover:border-primary/50 transition-colors"
                            style={{ width: `calc(${(endH - startH) * 100}% + ${(endH - startH - 1)}px)` }}
                            title={`${b.name || playlistName} (${b.start_time} - ${b.end_time})`}
                          >
                            <span className="truncate whitespace-nowrap font-medium">{b.name || playlistName}</span>
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
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-sm font-medium text-foreground">Active Schedules</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">{schedules.length} Items</span>
          </div>
          <div className="divide-y divide-border">
            {schedules.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    <p className="text-sm">No schedules have been created yet.</p>
                </div>
            ) : schedules.map((s: any) => {
              const screenName = screens.find((sc: any) => sc.id === s.screen_id)?.name || "Unknown Screen";
              const playlistName = playlists.find((p: any) => p.id === s.playlist_id)?.name || "Unknown Playlist";
              return (
                <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-accent/5 transition-colors group">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                        {s.name || screenName}
                        {s.name && <span className="text-[10px] font-normal text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex items-center gap-1"><Monitor className="h-3 w-3" /> {screenName}</span>}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1.5">
                          <ListMusic className="h-3 w-3" />
                          <span>{playlistName}</span>
                      </div>
                      <span className="text-border">•</span>
                      <div className="flex items-center gap-1.5">
                          <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                      </div>
                      <span className="text-border">•</span>
                      <div className="flex items-center gap-0.5">
                          {days.map((d, i) => (
                              <span key={d} className={cn("w-3 text-center", s.days_of_week.includes(i) ? "text-primary font-bold" : "text-muted-foreground/30")}>
                                  {d[0]}
                              </span>
                          ))}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
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
