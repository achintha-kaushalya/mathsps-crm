import * as React from "react"
import { cn } from "@/lib/utils"

export const Empty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-card/20 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
)
Empty.displayName = "Empty"

export const EmptyHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col items-center gap-2", className)} {...props} />
  )
)
EmptyHeader.displayName = "EmptyHeader"

export interface EmptyMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "icon" | "image"
}

export const EmptyMedia = React.forwardRef<HTMLDivElement, EmptyMediaProps>(
  ({ className, variant = "icon", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center text-muted-foreground/60 mb-2",
        variant === "icon" && "w-12 h-12 rounded-xl bg-card border border-border shadow-inner text-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
EmptyMedia.displayName = "EmptyMedia"

export const EmptyTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-sm font-bold text-foreground tracking-tight", className)}
      {...props}
    />
  )
)
EmptyTitle.displayName = "EmptyTitle"

export const EmptyDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs text-muted-foreground max-w-sm leading-relaxed", className)}
      {...props}
    />
  )
)
EmptyDescription.displayName = "EmptyDescription"

export const EmptyContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-4 flex items-center justify-center gap-2", className)} {...props} />
  )
)
EmptyContent.displayName = "EmptyContent"
