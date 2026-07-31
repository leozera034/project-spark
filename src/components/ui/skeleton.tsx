import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer soft-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
