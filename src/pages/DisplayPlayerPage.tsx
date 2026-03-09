import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

const demoMedia = [
  { type: "image" as const, color: "from-primary/30 to-primary/10", label: "Spring Promotion" },
  { type: "image" as const, color: "from-success/30 to-success/10", label: "Welcome Message" },
  { type: "image" as const, color: "from-warning/30 to-warning/10", label: "Menu Board" },
];

export default function DisplayPlayerPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % demoMedia.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = demoMedia[currentIndex];

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden">
      {/* Full screen content */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${current.color} transition-all duration-1000 flex items-center justify-center`}
      >
        <div className="text-center animate-fade-in">
          <p className="text-4xl font-semibold text-foreground">{current.label}</p>
          <p className="text-muted-foreground mt-2">Display content placeholder</p>
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-full px-3 py-1.5">
        {connected ? (
          <Wifi className="h-3 w-3 text-success" />
        ) : (
          <WifiOff className="h-3 w-3 text-destructive" />
        )}
        <span className="text-[10px] text-muted-foreground">
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-6 flex gap-2">
        {demoMedia.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
