import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]"

    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground shadow hover:opacity-90",
      destructive: "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25",
      outline: "border border-border bg-transparent hover:bg-card-hover text-foreground",
      secondary: "bg-muted text-muted-foreground hover:bg-muted/80",
      ghost: "hover:bg-card-hover text-muted-foreground hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      glass: "bg-white/[0.04] hover:bg-white/[0.08] text-foreground border border-white/[0.08] shadow-sm backdrop-blur-md",
    }

    const sizes: Record<string, string> = {
      default: "h-9 px-4 py-2",
      sm: "h-7.5 rounded-md px-3 text-[11px]",
      lg: "h-11 rounded-md px-8 text-sm",
      icon: "size-8 rounded-md p-0",
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
