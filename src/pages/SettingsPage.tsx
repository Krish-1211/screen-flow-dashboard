import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
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

          <TabsContent value="appearance" className="mt-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-medium text-foreground">Theme</h2>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
              <div className="flex gap-3">
                <button className="border-2 border-primary rounded-lg p-4 flex flex-col items-center gap-2 bg-secondary">
                  <div className="h-8 w-12 rounded bg-[hsl(240,10%,6%)] border border-border" />
                  <span className="text-xs text-foreground">Dark</span>
                </button>
                <button className="border-2 border-border rounded-lg p-4 flex flex-col items-center gap-2">
                  <div className="h-8 w-12 rounded bg-[hsl(0,0%,100%)] border border-border" />
                  <span className="text-xs text-foreground">Light</span>
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
