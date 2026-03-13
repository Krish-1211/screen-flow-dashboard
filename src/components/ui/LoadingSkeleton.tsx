import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
    return (
        <div className="bg-card w-full h-32 rounded-lg p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full space-y-4">
            <div className="flex justify-between p-4 border-b">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-20" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex justify-between p-4">
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className="h-4 w-24" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function MediaGridSkeleton({ items = 8 }: { items?: number }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-2 space-y-2">
                    <Skeleton className="w-full h-32 rounded-md" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    );
}

export function PlaylistSkeleton({ items = 4 }: { items?: number }) {
    return (
        <div className="space-y-3 w-full">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 bg-card p-3 rounded-lg border">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
            ))}
        </div>
    );
}
