import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webhooksApi, type Webhook } from "@/services/api/webhooks";
import { Plus, Trash2, Globe, Shield, Activity, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [companyName, setCompanyName] = useState("Acme Corp");
  const [defaultDuration, setDefaultDuration] = useState("10");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="account">
          <TabsList className="bg-secondary">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="defaults">Screen Defaults</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input defaultValue="John Doe" className="bg-secondary" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue="john@acmecorp.com" className="bg-secondary" />
                </div>
              </div>
              <Button size="sm">Save Changes</Button>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Password</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" className="bg-secondary" />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" className="bg-secondary" />
                </div>
              </div>
              <Button size="sm" variant="outline">Update Password</Button>
            </div>
          </TabsContent>

          <TabsContent value="organization" className="mt-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Organization</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-secondary" />
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">Click or drag to upload logo</p>
                  </div>
                </div>
              </div>
              <Button size="sm">Save</Button>
            </div>
          </TabsContent>

          <TabsContent value="defaults" className="mt-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Screen Defaults</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Image Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    className="bg-secondary w-32"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Auto-loop Playlists</p>
                    <p className="text-xs text-muted-foreground">Automatically restart playlist when finished</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Show Status Overlay</p>
                    <p className="text-xs text-muted-foreground">Display connection status on screens</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <Button size="sm">Save</Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Theme</h2>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "border-2 rounded-lg p-4 flex flex-col items-center gap-2 bg-secondary transition-all",
                    theme === "dark" ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="h-8 w-12 rounded bg-[hsl(240,10%,6%)] border border-border" />
                  <span className="text-xs text-foreground font-medium">Dark</span>
                </button>
                <button 
                  onClick={() => setTheme("light")}
                  className={cn(
                    "border-2 rounded-lg p-4 flex flex-col items-center gap-2 bg-background transition-all",
                    theme === "light" ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="h-8 w-12 rounded bg-[hsl(0,0%,100%)] border border-border" />
                  <span className="text-xs text-foreground font-medium">Light</span>
                </button>
              </div>
            </div>

            <InstallPWAPrompt />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhooksSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function InstallPWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(
    (window as any).deferredPrompt || null
  );
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to allow browser to fire event
    const timer = setTimeout(() => setIsChecking(false), 2000);

    const handler = (e: Event) => {
      console.log('✅ PWA: beforeinstallprompt event fired');
      // e.preventDefault(); // Commented out to allow the browser's native banner to show as requested.
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      setIsChecking(false);
    };

    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsChecking(false);
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Installation prompt not available. Please try using Chrome or Edge, or look for the 'Install' icon in your address bar.");
      return;
    }
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User choice outcome: ${outcome}`);
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      }
    } catch (err) {
      console.error('PWA: Install error:', err);
    }
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Install App</h2>
        {isChecking && !deferredPrompt && !isStandalone && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" title="Checking installation status..." />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Install ScreenFlow as an application on your device for quick access and offline capabilities.
      </p>

      {isStandalone ? (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
          <p className="text-sm text-primary font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            App is currently installed and running natively.
          </p>
        </div>
      ) : deferredPrompt ? (
        <Button onClick={handleInstallClick} size="sm" className="w-full sm:w-auto shadow-lg shadow-primary/20">
          Install Native App
        </Button>
      ) : (
        <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md border border-border/50 italic">
          <p>Installation prompt not triggered yet.</p>
          <ul className="list-disc ml-4 mt-2 space-y-1 not-italic">
            <li>Ensure you are in <b>Chrome</b>, <b>Edge</b>, or <b>Safari</b>.</li>
            <li>Look for the <b>⊕ Install</b> icon in your URL bar.</li>
            <li>Or use <b>"Add to Home Screen"</b> in your browser menu.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function WebhooksSettings() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: "", secret: "", events: ["screen.offline"] });

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.getAll
  });

  const createMutation = useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setOpen(false);
      setNewWebhook({ url: "", secret: "", events: ["screen.offline"] });
      toast.success("Webhook created");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create webhook")
  });

  const deleteMutation = useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success("Webhook deleted");
    }
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: number, enabled: boolean }) => webhooksApi.update(vars.id, { enabled: vars.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Outbound Webhooks</h2>
            <p className="text-xs text-muted-foreground mt-1">Receive real-time notifications for system events</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Webhook</DialogTitle>
                <DialogDescription>Configure a URL to receive ScreenFlow event notifications.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Payload URL</Label>
                  <Input 
                    placeholder="https://hooks.slack.com/services/..." 
                    className="bg-secondary"
                    value={newWebhook.url}
                    onChange={e => setNewWebhook({...newWebhook, url: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret (Optional)</Label>
                  <Input 
                    type="password" 
                    placeholder="X-ScreenFlow-Secret" 
                    className="bg-secondary"
                    value={newWebhook.secret}
                    onChange={e => setNewWebhook({...newWebhook, secret: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <Label>Events</Label>
                  <div className="flex items-center gap-3 bg-secondary/30 p-3 rounded-md border border-border/50">
                    <Checkbox id="evt-offline" checked={newWebhook.events.includes("screen.offline")} onCheckedChange={() => {}} />
                    <Label htmlFor="evt-offline" className="text-sm cursor-pointer">screen.offline</Label>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => createMutation.mutate(newWebhook as any)}
                  disabled={!newWebhook.url || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Webhook"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-20" />
              <p className="text-xs">Loading webhooks...</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Globe className="h-10 w-10 opacity-10 mx-auto mb-4" />
              <p className="text-sm">No webhooks configured yet.</p>
            </div>
          ) : (
            webhooks.map((wh: Webhook) => (
              <div key={wh.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground truncate max-w-[300px]">{wh.url}</h3>
                    <div className="flex gap-2 mt-1">
                      {wh.events.map(e => (
                        <span key={e} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">{e}</span>
                      ))}
                      {wh.secret && <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-md border border-border"><Shield className="h-2 w-2 inline mr-1" />Secret set</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch 
                    checked={wh.enabled} 
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: wh.id, enabled: checked })} 
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => deleteMutation.mutate(wh.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
