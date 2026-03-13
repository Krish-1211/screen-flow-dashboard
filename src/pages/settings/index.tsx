import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

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
      e.preventDefault();
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
