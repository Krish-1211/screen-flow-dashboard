import { useState } from "react";
import { toast } from "sonner";
import { 
  Plus, 
  MoreHorizontal, 
  RefreshCw, 
  Monitor, 
  CheckCircle2, 
  X, 
  Calendar, 
  Copy, 
  QrCode, 
  Trash2, 
  Search, 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  ArrowLeft,
  Settings2
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
  DialogTrigger,
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

export default function ScreensPage() {
  const queryClient = useQueryClient();
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [newName, setNewName] = useState("");
  const [newPlaylistId, setNewPlaylistId] = useState<string>("none");
  const [open, setOpen] = useState(false);
  
  const [newFolderName, setNewFolderName] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrScreen, setQrScreen] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ── Queries ──
  const { data: nodes = [], isLoading: loadingNodes } = useQuery({
    queryKey: ['nodes', currentNodeId],
    queryFn: () => screensApi.getNodes(currentNodeId || 'root'),
  });

  const { data: screens = [], isLoading: loadingScreens } = useQuery({
    queryKey: ['screens', currentNodeId],
    queryFn: () => screensApi.getAll(currentNodeId || 'root'),
    refetchInterval: 10000
  });

  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ['nodes', 'path', currentNodeId],
    queryFn: () => currentNodeId ? screensApi.getNodePath(currentNodeId) : Promise.resolve([]),
    enabled: !!currentNodeId
  });

  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: playlistsApi.getAll
  });

  // ── Mutations ──
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => screensApi.createNode(name, currentNodeId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes', currentNodeId] });
      setNewFolderName("");
      setFolderOpen(false);
      toast.success("Folder created");
    }
  });

  const createScreenMutation = useMutation({
    mutationFn: (payload: { name: string, playlist_id?: number, nodeId?: string }) => 
      screensApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentNodeId] });
      setNewName("");
      setNewPlaylistId("none");
      setOpen(false);
      toast.success("Screen registered successfully");
    }
  });

  const updateScreenMutation = useMutation({
    mutationFn: (vars: { id: string, payload: any }) => screensApi.update(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentNodeId] });
      toast.success("Screen updated");
    }
  });

  const deleteScreenMutation = useMutation({
    mutationFn: screensApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', currentNodeId] });
      toast.success("Screen deleted");
    }
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: string) => screensApi.deleteNode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes', currentNodeId] });
      toast.success("Folder deleted");
    }
  });

  // ── Handlers ──
  const handleDrillDown = (nodeId: string) => {
    setCurrentNodeId(nodeId);
    setSearchTerm("");
    setSelectedIds(new Set());
  };

  const handleGoBack = () => {
    if (breadcrumbs.length > 0) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      setCurrentNodeId(parent ? parent.id : null);
    } else {
      setCurrentNodeId(null);
    }
  };

  const addScreen = () => {
    if (!newName.trim()) return toast.error("Screen name is required");
    createScreenMutation.mutate({
      name: newName.trim(),
      playlist_id: newPlaylistId === "none" ? undefined : parseInt(newPlaylistId),
      nodeId: currentNodeId || undefined
    });
  };

  const filteredScreens = screens.filter((s: any) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.device_id && s.device_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredNodes = nodes.filter((n: any) => 
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header and Top Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {currentNodeId ? breadcrumbs[breadcrumbs.length - 1]?.name : "All Screens"}
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Monitor className="h-3.5 w-3.5" />
              <span>{screens.length} Screens</span>
              <span className="mx-1">•</span>
              <Folder className="h-3.5 w-3.5" />
              <span>{nodes.length} Folders</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFolderOpen(true)} className="h-9">
              <FolderPlus className="h-4 w-4 mr-2" />New Folder
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="h-9 shadow-lg shadow-primary/10">
              <Plus className="h-4 w-4 mr-2" />Register Screen
            </Button>
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries()} className="h-9 w-9">
              <RefreshCw className={cn("h-4 w-4", (loadingScreens || loadingNodes) && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Navigation Bar (Breadcrumbs & Search) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentNodeId(null)} 
                className={cn("h-8 w-8 shrink-0", !currentNodeId && "text-primary bg-primary/10")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            
            {currentNodeId && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDrillDown(crumb.id)}
                    className={cn(
                      "h-7 px-2 text-xs font-medium transition-colors",
                      idx === breadcrumbs.length - 1 ? "text-foreground bg-secondary/50" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {crumb.name}
                  </Button>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                </div>
              ))}
            </div>
          </div>

          <div className="relative group max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search folders or screens..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-secondary/40 border-border/50 pl-10 h-10 focus:bg-secondary/60 transition-all rounded-xl"
            />
          </div>
        </div>

        {/* Browser Content */}
        <div className="space-y-8">
          {/* Folders Section */}
          {(filteredNodes.length > 0 || (currentNodeId && !searchTerm)) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Folders</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentNodeId && !searchTerm && (
                   <div 
                    onClick={handleGoBack}
                    className="flex items-center gap-4 p-4 bg-secondary/20 border border-dashed border-border/60 rounded-2xl cursor-pointer hover:bg-secondary/40 transition-all group"
                   >
                     <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                     </div>
                     <div>
                       <span className="text-sm font-medium">Go Back</span>
                       <p className="text-[10px] text-muted-foreground">Up one level</p>
                     </div>
                   </div>
                )}
                
                {filteredNodes.map((node: any) => (
                  <div 
                    key={node.id}
                    className="relative flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 flex-1" onClick={() => handleDrillDown(node.id)}>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Folder className="h-5 w-5 fill-primary/20" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold truncate block group-hover:text-primary transition-colors">{node.name}</span>
                        <p className="text-[10px] text-muted-foreground">Folder</p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const name = prompt("Rename Folder", node.name);
                          if (name) screensApi.updateNode(node.id, { name }).then(() => queryClient.invalidateQueries());
                        }}>Rename</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => {
                           if (confirm("Delete this folder? Contents will be moved up.")) {
                             deleteNodeMutation.mutate(node.id);
                           }
                        }}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screens Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Screens</h3>
            </div>
            
            {loadingScreens ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary/20" />
                <p className="text-sm text-muted-foreground">Loading screens...</p>
              </div>
            ) : filteredScreens.length === 0 ? (
              <div className="bg-secondary/10 border border-dashed border-border/60 rounded-3xl p-20 text-center">
                <Monitor className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground font-medium">No screens in this level</p>
                {searchTerm && <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredScreens.map((screen: any) => (
                  <div 
                    key={screen.id} 
                    className="bg-card border border-border/50 rounded-2xl p-4 hover:shadow-lg transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          screen.status === 'online' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          <Monitor className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{screen.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusBadge status={screen.status} />
                            <span className="text-[10px] text-muted-foreground font-mono">{screen.device_id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedScreen(screen); setDetailOpen(true); }}>
                            <Settings2 className="h-4 w-4 mr-2" />Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setQrScreen(screen); setQrOpen(true); }}>
                            <QrCode className="h-4 w-4 mr-2" />Show QR
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const url = `${window.location.origin}/display?device_id=${screen.device_id}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Player URL copied");
                          }}>
                            <Copy className="h-4 w-4 mr-2" />Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteScreenMutation.mutate(screen.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-secondary/30 rounded-xl space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Current Playlist</Label>
                        <Select
                          value={screen.playlistId || "none"}
                          onValueChange={(val) => updateScreenMutation.mutate({ 
                            id: screen.id, 
                            payload: { playlistId: val === "none" ? null : val } 
                          })}
                        >
                          <SelectTrigger className="w-full h-8 bg-transparent border-none p-0 text-xs font-medium cursor-pointer ring-offset-0 focus:ring-0">
                            <SelectValue placeholder="No Playlist" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Content</SelectItem>
                            {playlists.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between px-1">
                         <div className="flex items-center gap-1.5">
                           {screen.is_scheduled && (
                             <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                               <Calendar className="h-2.5 w-2.5 text-primary" />
                             </div>
                           )}
                           <span className="text-[10px] text-muted-foreground">
                             {screen.lastPing ? `Seen ${new Date(screen.lastPing).toLocaleTimeString()}` : "Never seen"}
                           </span>
                         </div>
                         <Button variant="ghost" size="sm" onClick={() => window.open(`/display?device_id=${screen.device_id}`, '_blank')} className="h-6 text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-white rounded-full">
                           LIVE VIEW
                         </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Folders help you organize screens at a location.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Folder Name</Label>
            <Input 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Ground Floor"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && createFolderMutation.mutate(newFolderName)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderOpen(false)}>Cancel</Button>
            <Button onClick={() => createFolderMutation.mutate(newFolderName)} disabled={!newFolderName.trim()}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Screen</DialogTitle>
            <DialogDescription>This screen will appear in {currentNodeId ? "this folder" : "the root level"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Screen Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Lobby Display"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Playlist</Label>
              <Select value={newPlaylistId} onValueChange={setNewPlaylistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Playlist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Playlist</SelectItem>
                  {playlists.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addScreen} disabled={createScreenMutation.isPending} className="w-full">
              {createScreenMutation.isPending ? "Registering..." : "Register Screen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Screen</DialogTitle>
            <DialogDescription>Scan this QR with the player app.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="bg-white p-4 rounded-xl">
              {qrScreen && (
                <QRCodeSVG
                  value={JSON.stringify({
                    serverUrl: window.location.origin,
                    deviceId: qrScreen.device_id
                  })}
                  size={200}
                />
              )}
            </div>
            <div className="bg-secondary p-3 rounded-lg text-xs font-mono w-full">
              <p>ID: {qrScreen?.device_id}</p>
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
