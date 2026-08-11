import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input/90 bg-background/80 px-3.5 py-2 text-base text-foreground shadow-e1 outline-none backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground/80 hover:border-border-strong focus-visible:border-brand/55 focus-visible:ring-4 focus-visible:ring-brand/10 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
