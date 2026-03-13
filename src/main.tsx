import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

registerSW({ immediate: true });

// Capture the PWA install prompt globally before React mounts down deep
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPrompt = e;
});

// Apply dark mode by default
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
