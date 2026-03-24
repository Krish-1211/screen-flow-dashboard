import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "online" | "offline";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          status === "online" ? "bg-success" : "bg-muted-foreground"
        )}
      />
      <span className="text-sm capitalize">{status}</span>
    </div>
  );
}
