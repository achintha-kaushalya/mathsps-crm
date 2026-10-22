import * as React from "react"
import { cn } from "@/lib/utils"

export const InputGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative flex w-full items-center", className)}
      {...props}
    />
  )
)
InputGroup.displayName = "InputGroup"

export const InputGroupAddon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "inline-end" }>(
  ({ className, align = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "absolute z-10 flex items-center justify-center text-muted-foreground",
        align === "start" ? "left-3 pointer-events-none" : "right-3",
        className
      )}
      {...props}
    />
  )
)
InputGroupAddon.displayName = "InputGroupAddon"

export const InputGroupInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { addonAlign?: "start" | "end" | "both" }>(
  ({ className, addonAlign = "start", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg border border-border bg-input-bg text-xs text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        addonAlign === "start" && "pl-9 pr-3",
        addonAlign === "end" && "pl-3 pr-9",
        addonAlign === "both" && "pl-9 pr-9",
        className
      )}
      {...props}
    />
  )
)
InputGroupInput.displayName = "InputGroupInput"
