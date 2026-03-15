import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Trash2, Clock, Check } from "lucide-react";
import { schedulesApi, type Schedule } from "@/services/api/schedules";
import { playlistsApi } from "@/services/api/playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScreenDetailModalProps {
    screen: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ScreenDetailModal({ screen, open, onOpenChange }: ScreenDetailModalProps) {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState("schedules");

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ['schedules', screen?.id],
        queryFn: () => schedulesApi.getAll(screen?.id),
        enabled: !!screen?.id
    });

    const { data: playlists = [] } = useQuery({
        queryKey: ['playlists'],
        queryFn: playlistsApi.getAll
    });

    const [newSch, setNewSch] = useState({
        name: "",
        playlist_id: "",
        start_time: "09:00",
        end_time: "17:00",
        days_of_week: [0, 1, 2, 3, 4],
        active: true
    });

    const createMutation = useMutation({
        mutationFn: (payload: any) => schedulesApi.create({ ...payload, screen_id: screen.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', screen.id] });
            queryClient.invalidateQueries({ queryKey: ['screens'] });
            setNewSch({ name: "", playlist_id: "", start_time: "09:00", end_time: "17:00", days_of_week: [0, 1, 2, 3, 4], active: true });
            toast.success("Schedule created");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to create schedule");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: schedulesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', screen.id] });
            queryClient.invalidateQueries({ queryKey: ['screens'] });
            toast.success("Schedule deleted");
        }
    });

    const toggleDay = (dayIndex: number) => {
        setNewSch(prev => ({
            ...prev,
            days_of_week: prev.days_of_week.includes(dayIndex)
                ? prev.days_of_week.filter(d => d !== dayIndex)
                : [...prev.days_of_week, dayIndex]
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{screen?.name}</DialogTitle>
                    <DialogDescription>ID: {screen?.id} • {screen?.status}</DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={setTab} className="mt-4">
                    <TabsList className="bg-secondary">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="schedules">Schedules</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4 pt-4">
                        <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                            <h4 className="text-sm font-medium mb-2">Technical Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Device ID</span>
                                    <span className="font-mono">{screen?.device_id}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Last Ping</span>
                                    <span>{screen?.lastPing ? new Date(screen.lastPing).toLocaleString() : 'Never'}</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="schedules" className="space-y-6 pt-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Scheduled Overrides</h4>
                                <p className="text-xs text-muted-foreground">Highest priority content</p>
                            </div>

                            <div className="bg-secondary/20 p-4 rounded-lg border border-dashed border-border space-y-4">
                                <p className="text-xs font-medium uppercase text-muted-foreground">Add New Schedule</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Schedule Name</Label>
                                        <Input 
                                            placeholder="e.g. Lunch Special" 
                                            value={newSch.name}
                                            onChange={e => setNewSch({...newSch, name: e.target.value})}
                                            className="h-8 text-xs bg-secondary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Playlist</Label>
                                        <Select 
                                            value={newSch.playlist_id} 
                                            onValueChange={v => setNewSch({...newSch, playlist_id: v})}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-secondary">
                                                <SelectValue placeholder="Select Playlist" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {playlists.map((p: any) => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Start Time</Label>
                                        <Input 
                                            type="time" 
                                            value={newSch.start_time}
                                            onChange={e => setNewSch({...newSch, start_time: e.target.value})}
                                            className="h-8 text-xs bg-secondary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">End Time</Label>
                                        <Input 
                                            type="time" 
                                            value={newSch.end_time}
                                            onChange={e => setNewSch({...newSch, end_time: e.target.value})}
                                            className="h-8 text-xs bg-secondary"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Days of Week</Label>
                                    <div className="flex gap-1">
                                        {DAYS.map((day, i) => (
                                            <button
                                                key={day}
                                                onClick={() => toggleDay(i)}
                                                className={cn(
                                                    "w-8 h-8 rounded text-[10px] font-medium border transition-all",
                                                    newSch.days_of_week.includes(i)
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                                                )}
                                            >
                                                {day[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <Button 
                                    size="sm" 
                                    className="w-full h-8" 
                                    disabled={!newSch.playlist_id || createMutation.isPending}
                                    onClick={() => createMutation.mutate(newSch)}
                                >
                                    {createMutation.isPending ? "Adding..." : "Add Schedule"}
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {isLoading ? (
                                    <p className="text-center text-xs text-muted-foreground py-4">Loading schedules...</p>
                                ) : schedules.length === 0 ? (
                                    <div className="text-center py-8 bg-secondary/10 rounded-lg">
                                        <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                        <p className="text-xs text-muted-foreground">No schedules defined for this screen.</p>
                                    </div>
                                ) : (
                                    schedules.map((s: Schedule) => (
                                        <div key={s.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg group">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{s.name || "Untitled Schedule"}</span>
                                                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                                                            {playlists.find((p: any) => p.id === s.playlist_id)?.name || s.playlist_id}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                        <span>{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                                                        <span>•</span>
                                                        <div className="flex gap-0.5">
                                                            {DAYS.map((day, i) => (
                                                                <span 
                                                                    key={day} 
                                                                    className={cn(
                                                                        "w-3 text-center",
                                                                        s.days_of_week.includes(i) ? "text-primary font-bold" : "text-muted-foreground/30"
                                                                    )}
                                                                >
                                                                    {day[0]}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch checked={s.active} onCheckedChange={() => {}} />
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                    onClick={() => deleteMutation.mutate(s.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
