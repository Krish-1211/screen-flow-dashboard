import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import ScreensPage from "./pages/ScreensPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import SchedulesPage from "./pages/SchedulesPage";
import DisplayPlayerPage from "./pages/DisplayPlayerPage";
import BillingPage from "./pages/BillingPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/screens" element={<ScreensPage />} />
          <Route path="/media" element={<MediaLibraryPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/display/:screenId" element={<DisplayPlayerPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
