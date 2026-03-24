import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { syncService } from "@/services/sync-service";

const DashboardPage = lazy(() => import("@/pages/dashboard/index"));
const ScreensPage = lazy(() => import("@/pages/screens/index"));
const MediaLibraryPage = lazy(() => import("@/pages/media/index"));
const PlaylistsPage = lazy(() => import("@/pages/playlists/index"));
const SchedulesPage = lazy(() => import("@/pages/schedules/index"));
const DisplayPlayerPage = lazy(() => import("@/pages/display/index"));
const BillingPage = lazy(() => import("@/pages/billing/index"));
const SettingsPage = lazy(() => import("@/pages/settings/index"));
const AuditLogPage = lazy(() => import("@/pages/audit/index"));
const LoginPage = lazy(() => import("@/pages/login/index"));
const NotFound = lazy(() => import("@/pages/not-found/index"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    function checkAuth() {
      // Check for our new JWT token
      const token = localStorage.getItem('sf_token');
      setIsAuthenticated(!!token);
    }

    checkAuth();

    // Listen for storage changes (e.g. login/logout)
    const handleStorageChange = () => checkAuth();
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (isAuthenticated === null) return <DefaultFallback />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-6 h-screen w-screen bg-background text-foreground">
      <h2 className="text-xl font-semibold mb-2 text-destructive">Something went wrong</h2>
      <pre className="text-sm bg-muted p-4 rounded-md mb-4 max-w-full overflow-auto">{error.message}</pre>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

const DefaultFallback = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="text-sm text-muted-foreground animate-pulse">Loading App...</span>
    </div>
  </div>
);

const SyncManager = () => {
  useEffect(() => {
    syncService.connect();
    
    // Global invalidations
    syncService.on('screen-refresh', () => {
      console.log('Sync: Refreshing screens...');
      queryClient.invalidateQueries({ queryKey: ['screens'] });
    });
    
    syncService.on('playlist-updated', () => {
      console.log('Sync: Refreshing playlists...');
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    });

    syncService.on('schedule-updated', () => {
      console.log('Sync: Refreshing schedules...');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    });

    return () => syncService.disconnect();
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SyncManager />
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <Suspense fallback={<DefaultFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/display" element={<DisplayPlayerPage />} />

                {/* Protected Protected Routes */}
                <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/screens" element={<ProtectedRoute><ScreensPage /></ProtectedRoute>} />
                <Route path="/media" element={<ProtectedRoute><MediaLibraryPage /></ProtectedRoute>} />
                <Route path="/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
                <Route path="/schedules" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
