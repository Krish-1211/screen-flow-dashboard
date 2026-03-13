import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/components/theme-provider";

const DashboardPage = lazy(() => import("./pages/dashboard"));
const ScreensPage = lazy(() => import("./pages/screens"));
const MediaLibraryPage = lazy(() => import("./pages/media"));
const PlaylistsPage = lazy(() => import("./pages/playlists"));
const SchedulesPage = lazy(() => import("./pages/schedules"));
const DisplayPlayerPage = lazy(() => import("./pages/display"));
const BillingPage = lazy(() => import("./pages/billing"));
const SettingsPage = lazy(() => import("./pages/settings"));
const LoginPage = lazy(() => import("./pages/login"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    async function checkAuth() {
      // 1. Check for manual dummy auth
      if (localStorage.getItem('sb-dummy-auth') === 'true') {
        setIsAuthenticated(true);
        return;
      }

      // 2. Check for Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('sb-dummy-auth') === 'true') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(!!session);
      }
    });

    return () => subscription.unsubscribe();
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <Suspense fallback={<DefaultFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/display/:screenId" element={<DisplayPlayerPage />} />

                {/* Protected Protected Routes */}
                <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/screens" element={<ProtectedRoute><ScreensPage /></ProtectedRoute>} />
                <Route path="/media" element={<ProtectedRoute><MediaLibraryPage /></ProtectedRoute>} />
                <Route path="/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
                <Route path="/schedules" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
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
