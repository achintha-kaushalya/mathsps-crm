import * as React from "react"
import { cn } from "@/lib/utils"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning" | "success" | "info"
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-card/60 text-foreground border-border",
      destructive: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      warning: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
      info: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-xl border p-4 backdrop-blur-md transition-all flex items-start gap-3",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Alert.displayName = "Alert"

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("text-xs font-bold leading-tight tracking-tight", className)}
      {...props}
    />
  )
)
AlertTitle.displayName = "AlertTitle"

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-xs leading-relaxed opacity-90", className)}
      {...props}
    />
  )
)
AlertDescription.displayName = "AlertDescription"
