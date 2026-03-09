import { useState } from "react";
import { Plus, Monitor, ListMusic, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
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

const screens = ["Lobby Main", "Reception TV", "Cafeteria Display", "Meeting Room A"];
const playlists = ["Welcome Loop", "Menu Board", "Company Info", "Promotions"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

interface ScheduleBlock {
  id: number;
  screen: string;
  playlist: string;
  day: string;
  startHour: number;
  endHour: number;
}

const initialSchedules: ScheduleBlock[] = [
  { id: 1, screen: "Lobby Main", playlist: "Welcome Loop", day: "Mon", startHour: 8, endHour: 18 },
  { id: 2, screen: "Lobby Main", playlist: "Promotions", day: "Tue", startHour: 9, endHour: 17 },
  { id: 3, screen: "Cafeteria Display", playlist: "Menu Board", day: "Mon", startHour: 11, endHour: 14 },
  { id: 4, screen: "Reception TV", playlist: "Company Info", day: "Wed", startHour: 8, endHour: 20 },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ screen: "", playlist: "", day: "Mon", startHour: "9", endHour: "17" });

  const addSchedule = () => {
    if (!form.screen || !form.playlist) return;
    setSchedules([
      ...schedules,
      {
        id: Date.now(),
        screen: form.screen,
        playlist: form.playlist,
        day: form.day,
        startHour: Number(form.startHour),
        endHour: Number(form.endHour),
      },
    ]);
    setOpen(false);
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
                  <Select value={form.screen} onValueChange={(v) => setForm({ ...form, screen: v })}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select screen" /></SelectTrigger>
                    <SelectContent>
                      {screens.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Playlist</Label>
                  <Select value={form.playlist} onValueChange={(v) => setForm({ ...form, playlist: v })}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select playlist" /></SelectTrigger>
                    <SelectContent>
                      {playlists.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                <Button onClick={addSchedule} className="w-full">Create Schedule</Button>
              </div>
            </DialogContent>
          </Dialog>
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
                      {blocks.map((b) => (
                        h === b.startHour && (
                          <div
                            key={b.id}
                            className="absolute inset-y-1 left-0 bg-primary/20 border border-primary/30 rounded text-[9px] text-primary px-1 flex items-center overflow-hidden z-10"
                            style={{ width: `${(b.endHour - b.startHour) * 100}%` }}
                          >
                            <span className="truncate">{b.playlist}</span>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule list */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Active Schedules</h2>
          </div>
          <div className="divide-y divide-border">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4">
                <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{s.screen}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <ListMusic className="h-3 w-3" />
                    <span>{s.playlist}</span>
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    <span>{s.day} {s.startHour}:00–{s.endHour}:00</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
