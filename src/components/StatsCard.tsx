import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  positive?: boolean;
}

export function StatsCard({ label, value, icon: Icon, change, positive }: StatsCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {change && (
        <p className={cn("text-xs mt-1", positive ? "text-success" : "text-destructive")}>
          {change}
        </p>
      )}
    </div>
  );
}
