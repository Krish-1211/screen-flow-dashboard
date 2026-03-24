import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Capture the PWA install prompt globally before React mounts down deep
window.addEventListener('beforeinstallprompt', (e) => {
    // We no longer call e.preventDefault() here to allow the browser's native banner to show as requested.
    // If the user still wants the custom button, it will still work as we store the event.
    (window as any).deferredPrompt = e;
});

// next-themes will handle theme via ThemeProvider in App.tsx
createRoot(document.getElementById("root")!).render(<App />);
