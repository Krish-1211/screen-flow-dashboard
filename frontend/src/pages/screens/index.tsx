import { useState } from "react";
import { toast } from "sonner";
import { 
  Plus, 
  MoreHorizontal, 
  RefreshCw, 
  Monitor, 
  X, 
  Calendar, 
  Copy, 
  QrCode, 
  Trash2, 
  Search, 
  Layout, 
  PlusSquare, 
  ChevronRight, 
  ArrowLeft,
  Settings2,
  Box,
  Layers
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { screensApi } from "@/services/api/screens";
import { playlistsApi } from "@/services/api/playlists";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ScreenDetailModal } from "@/components/screens/ScreenDetailModal";
import type { Space, Screen, Playlist } from "@/types";

export default function ScreensPage() {
  const queryClient = useQueryClient();
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newPlaylistId, setNewPlaylistId] = useState<string>("none");
  const [screenModalOpen, setScreenModalOpen] = useState(false);
  
  const [newSpaceName, setNewSpaceName] = useState("");
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrScreen, setQrScreen] = useState<Screen | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isRoot = !currentSpaceId;

  // ── Queries ──
  const { data: spaces = [], isLoading: loadingSpaces } = useQuery<Space[]>({
    queryKey: ['spaces', currentSpaceId],
    queryFn: () => screensApi.getSpaces(currentSpaceId || 'root'),
  });

  const { data: screens = [], isLoading: loadingScreens } = useQuery<Screen[]>({
    queryKey: ['screens', currentSpaceId],
    queryFn: () => screensApi.getAll(currentSpaceId || 'root'),
    refetchInterval: 10000,
    enabled: !isRoot // Root level behavior: do NOT show screens
  });

  const { data: breadcrumbs = [] } = useQuery<Space[]>({
    queryKey: ['spaces', 'path', currentSpaceId],
    queryFn: () => currentSpaceId ? screensApi.getSpacePath(currentSpaceId) : Promise.resolve([]),
    enabled: !!currentSpaceId
  });

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  // ── Mutations ──
  const createSpaceMutation = useMutation({
    mutationFn: (name: string) => screensApi.createSpace(name, currentSpaceId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', currentSpaceId] });
      setNewSpaceName("");
      setSpaceModalOpen(false);
      toast.success("Space created");
    }
  });

  const createScreenMutation = useMutation({
    mutationFn: (payload: { name: string, playlist_id?: number, spaceId?: string }) => 
      screensApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentSpaceId] });
      setNewName("");
      setNewPlaylistId("none");
      setScreenModalOpen(false);
      toast.success("Screen registered successfully");
    }
  });

  const updateScreenMutation = useMutation({
    mutationFn: (vars: { id: string | number, payload: Partial<Screen> }) => screensApi.update(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentSpaceId] });
      toast.success("Screen updated");
    }
  });

  const deleteScreenMutation = useMutation({
    mutationFn: screensApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentSpaceId] });
      toast.success("Screen deleted");
    }
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: (id: string) => screensApi.deleteSpace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', currentSpaceId] });
      toast.success("Space deleted");
    }
  });

  // ── Handlers ──
  const handleDrillDown = (spaceId: string) => {
    setCurrentSpaceId(spaceId);
    setSearchTerm("");
  };

  const handleGoBack = () => {
    if (breadcrumbs.length > 0) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      setCurrentSpaceId(parent ? parent.id : null);
    } else {
      setCurrentSpaceId(null);
    }
  };

  const addScreen = () => {
    if (!newName.trim()) return toast.error("Screen name is required");
    createScreenMutation.mutate({
      name: newName.trim(),
      playlist_id: newPlaylistId === "none" ? undefined : parseInt(newPlaylistId),
      spaceId: currentSpaceId || undefined
    });
  };

  const filteredScreens = (screens || []).filter((s) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.device_id && s.device_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSpaces = (spaces || []).filter((n) => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1600px] mx-auto">
        {/* Header and Top Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
             <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
                <Layers className="h-4 w-4" />
                <span>Spaces Dashboard</span>
             </div>
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
              {currentSpaceId ? breadcrumbs[breadcrumbs.length - 1]?.name : "Your Spaces"}
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              {isRoot 
                 ? "Organize your screens into dedicated spaces for better management." 
                 : `Manage screens in the ${breadcrumbs[breadcrumbs.length - 1]?.name} space.`}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={() => setSpaceModalOpen(true)} className="h-11 px-6 rounded-xl border-border/60 hover:bg-secondary/40 transition-all">
              <PlusSquare className="h-4 w-4 mr-2" />New Space
            </Button>
            {!isRoot && (
              <Button onClick={() => setScreenModalOpen(true)} className="h-11 px-6 rounded-xl shadow-xl shadow-primary/20 transition-all">
                <Plus className="h-4 w-4 mr-2" />Register Screen
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries()} className="h-11 w-11 rounded-xl">
              <RefreshCw className={cn("h-5 w-5", (loadingSpaces || loadingScreens) && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Navigation Bar (Breadcrumbs & Search) */}
        <div className="flex flex-col md:flex-row items-center gap-6 pb-2">
          <div className="flex items-center gap-2 overflow-hidden flex-1 w-full md:w-auto">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentSpaceId(null)} 
                className={cn("h-10 w-10 shrink-0 rounded-xl", isRoot && "bg-primary text-white hover:bg-primary/90")}
            >
              <Layout className="h-5 w-5" />
            </Button>
            
            {currentSpaceId && <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDrillDown(crumb.id)}
                    className={cn(
                      "h-9 px-4 text-sm font-semibold transition-all rounded-xl",
                      idx === breadcrumbs.length - 1 
                        ? "text-primary bg-primary/10 hover:bg-primary/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    )}
                  >
                    {crumb.name}
                  </Button>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/30" />}
                </div>
              ))}
            </div>
          </div>

          <div className="relative group w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search spaces or screens..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-card/50 border-border/40 pl-12 h-12 focus:bg-card focus:ring-primary/20 transition-all rounded-2xl shadow-sm"
            />
          </div>
        </div>

        {/* Spaces Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Spaces</h3>
          </div>
          
          {loadingSpaces ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
               {[1,2,3,4].map(i => <div key={i} className="h-44 rounded-3xl bg-secondary/20 animate-pulse border border-border/40" />)}
             </div>
          ) : filteredSpaces.length === 0 && isRoot && !searchTerm ? (
            <div className="bg-card/40 border border-dashed border-border/80 rounded-[2.5rem] p-32 text-center shadow-inner">
               <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-primary/5">
                  <Box className="h-10 w-10 text-primary/40" />
               </div>
               <h2 className="text-2xl font-bold text-foreground">No Spaces yet</h2>
               <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-lg">Created dedicated spaces to organize your digital signage fleet.</p>
               <Button onClick={() => setSpaceModalOpen(true)} className="mt-8 h-12 px-8 rounded-2xl shadow-lg shadow-primary/10">
                 Create your first Space
               </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {currentSpaceId && !searchTerm && (
                 <div 
                  onClick={handleGoBack}
                  className="flex flex-col justify-center gap-4 p-8 bg-secondary/10 border-2 border-dashed border-border/40 rounded-[2rem] cursor-pointer hover:bg-secondary/20 hover:border-primary/20 transition-all group h-[180px]"
                 >
                   <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <ArrowLeft className="h-6 w-6" />
                   </div>
                   <div>
                     <span className="text-lg font-bold group-hover:text-primary transition-colors">Go Back</span>
                     <p className="text-sm text-muted-foreground">Up one level</p>
                   </div>
                 </div>
              )}
              
              {filteredSpaces.map((space) => (
                <div 
                  key={space.id}
                  className="relative flex flex-col justify-between p-8 bg-card border border-border/40 rounded-[2rem] hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer group h-[180px] overflow-hidden"
                >
                  <div className="flex-1" onClick={() => handleDrillDown(space.id)}>
                    <div className="flex items-start justify-between">
                       <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <Layout className="h-7 w-7" />
                       </div>
                    </div>
                    <div className="mt-6 flex flex-col gap-1">
                      <span className="text-xl font-extrabold truncate block group-hover:text-primary transition-colors tracking-tight">{space.name}</span>
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                           <Monitor className="h-3 w-3" />
                           {space.screenCount || 0} Screens
                         </span>
                         <span className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                           <Box className="h-3 w-3" />
                           {space.subspaceCount || 0} Sub-spaces
                         </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute top-6 right-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-secondary/50">
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[160px]">
                        <DropdownMenuItem onClick={() => {
                          const name = prompt("Rename Space", space.name);
                          if (name) screensApi.updateSpace(space.id, { name }).then(() => queryClient.invalidateQueries());
                        }} className="rounded-xl py-2 cursor-pointer">Rename Space</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive rounded-xl py-2 cursor-pointer" onClick={() => {
                           if (confirm("Delete this space? Contents will be moved up.")) {
                             deleteSpaceMutation.mutate(space.id);
                           }
                        }}>Delete Space</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Screens Section */}
        {!isRoot && (
          <div className="space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Screens inside this Space</h3>
            </div>
            
            {loadingScreens ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="h-44 rounded-3xl bg-secondary/20 animate-pulse border border-border/40" />)}
              </div>
            ) : filteredScreens.length === 0 ? (
              <div className="bg-secondary/5 border-2 border-dashed border-border/40 rounded-[2rem] p-24 text-center">
                <Monitor className="h-14 w-14 text-muted-foreground/20 mx-auto mb-6" />
                <p className="text-xl font-bold text-muted-foreground">This Space is empty</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Register a screen to see it here.</p>
                <Button onClick={() => setScreenModalOpen(true)} variant="outline" className="mt-6 rounded-xl border-border/60">
                   Register Screen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredScreens.map((screen) => (
                  <div 
                    key={screen.id} 
                    className="bg-card border border-border/40 rounded-3xl p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                          screen.status === 'online' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          <Monitor className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{screen.name}</h4>
                          <div className="flex items-center gap-3 mt-1.5">
                            <StatusBadge status={screen.status} />
                            <span className="text-[10px] text-muted-foreground font-mono bg-secondary/40 px-1.5 py-0.5 rounded uppercase tracking-tighter">ID: {screen.device_id?.slice(0, 8)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 h-10 rounded-xl hover:bg-secondary/60">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[160px]">
                          <DropdownMenuItem onClick={() => { setSelectedScreen(screen); setDetailOpen(true); }} className="rounded-xl py-2 cursor-pointer">
                            <Settings2 className="h-4 w-4 mr-3" />Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setQrScreen(screen); setQrOpen(true); }} className="rounded-xl py-2 cursor-pointer">
                            <QrCode className="h-4 w-4 mr-3" />Show QR
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const url = `${window.location.origin}/display?device_id=${screen.device_id}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Player URL copied");
                          }} className="rounded-xl py-2 cursor-pointer">
                            <Copy className="h-4 w-4 mr-3" />Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive rounded-xl py-2 cursor-pointer" onClick={() => deleteScreenMutation.mutate(screen.id)}>
                            <Trash2 className="h-4 w-4 mr-3" />Delete Screen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-secondary/20 rounded-2xl space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pl-0.5">Active Content</Label>
                        <Select
                          value={screen.playlistId?.toString() || "none"}
                          onValueChange={(val) => updateScreenMutation.mutate({ 
                            id: screen.id, 
                            payload: { playlistId: val === "none" ? undefined : parseInt(val) } 
                          })}
                        >
                          <SelectTrigger className="w-full h-10 bg-transparent border-none p-0 text-sm font-bold cursor-pointer ring-offset-0 focus:ring-0">
                            <SelectValue placeholder="No Playlist" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            <SelectItem value="none">No Content</SelectItem>
                            {playlists.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between px-1">
                         <div className="flex items-center gap-2">
                           {(screen as any).is_scheduled && (
                             <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                               <Calendar className="h-3 w-3 text-primary" />
                             </div>
                           )}
                           <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                             {screen.lastPing ? `Pulsed ${new Date(screen.lastPing).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : "Never Pulsed"}
                           </span>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => window.open(`/display?device_id=${screen.device_id}`, '_blank')} className="h-8 px-4 text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-white rounded-xl tracking-widest uppercase transition-all">
                           Live Preview
                         </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <Dialog open={spaceModalOpen} onOpenChange={setSpaceModalOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Create New Space</DialogTitle>
            <DialogDescription className="text-lg">Designate a new space for your displays.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Space Name</Label>
            <Input 
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="e.g. Mumbai HQ, Building A"
              className="h-14 px-5 text-lg rounded-2xl bg-secondary/30 border-none focus:bg-secondary/50 focus:ring-primary/20 transition-all font-medium"
              onKeyDown={(e) => e.key === 'Enter' && createSpaceMutation.mutate(newSpaceName)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSpaceModalOpen(false)} className="h-12 px-6 rounded-2xl font-bold">Cancel</Button>
            <Button onClick={() => createSpaceMutation.mutate(newSpaceName)} disabled={!newSpaceName.trim()} className="h-12 px-8 rounded-2xl font-bold shadow-lg shadow-primary/20">Create Space</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={screenModalOpen} onOpenChange={setScreenModalOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Register Screen</DialogTitle>
            <DialogDescription className="text-lg">This screen will be assigned to <b>{isRoot ? "Root" : breadcrumbs[breadcrumbs.length - 1]?.name}</b>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Screen Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Lobby Entrance, Cafeteria"
                className="h-14 px-5 text-lg rounded-2xl bg-secondary/30 border-none focus:bg-secondary/50 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Initial Content</Label>
              <Select value={newPlaylistId} onValueChange={setNewPlaylistId}>
                <SelectTrigger className="h-14 px-5 text-lg rounded-2xl bg-secondary/30 border-none focus:bg-secondary/50 focus:ring-primary/20 transition-all font-medium">
                  <SelectValue placeholder="Select Playlist" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="none">No Playlist</SelectItem>
                  {playlists.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addScreen} disabled={createScreenMutation.isPending} className="w-full h-14 text-lg rounded-2xl font-bold shadow-xl shadow-primary/20 mt-4">
              {createScreenMutation.isPending ? "Registering..." : "Complete Registration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center">Sync Display</DialogTitle>
            <DialogDescription className="text-lg text-center">Scan this code with the player app.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl ring-1 ring-border">
              {qrScreen && (
                <QRCodeSVG
                  value={JSON.stringify({
                    serverUrl: window.location.origin,
                    deviceId: qrScreen.device_id
                  })}
                  size={240}
                  level="H"
                />
              )}
            </div>
            <div className="bg-secondary/30 p-5 rounded-2xl text-xs font-mono w-full flex items-center justify-between border border-border/40">
              <span className="text-muted-foreground font-bold tracking-widest uppercase">Hardware ID:</span>
              <span className="font-bold text-foreground">{qrScreen?.device_id?.slice(0, 16)}...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScreenDetailModal 
        screen={selectedScreen} 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
      />
    </DashboardLayout>
  );
}
