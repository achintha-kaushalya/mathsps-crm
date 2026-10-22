import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "border-transparent bg-primary/15 text-primary border border-primary/25",
    secondary: "border-transparent bg-muted text-muted-foreground",
    destructive: "border-transparent bg-red-500/15 text-red-400 border border-red-500/25",
    outline: "text-foreground border border-border",
    success: "border-transparent bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    warning: "border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/25",
    info: "border-transparent bg-sky-500/15 text-sky-400 border border-sky-500/25",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
