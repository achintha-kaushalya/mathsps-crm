import * as React from "react"
import { cn } from "@/lib/utils"

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end"
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, align = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex w-full gap-3 py-2",
        align === "end" ? "flex-row-reverse" : "flex-row",
        className
      )}
      {...props}
    />
  )
)
Message.displayName = "Message"

export const MessageAvatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-shrink-0 mt-0.5", className)} {...props} />
  )
)
MessageAvatar.displayName = "MessageAvatar"

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end"
}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, align = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        align === "end" ? "items-end" : "items-start",
        className
      )}
      {...props}
    />
  )
)
MessageContent.displayName = "MessageContent"

export const MessageHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-[11px] font-semibold text-muted-foreground px-1", className)} {...props} />
  )
)
MessageHeader.displayName = "MessageHeader"

export const MessageFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-[10px] text-muted-foreground/75 px-1", className)} {...props} />
  )
)
MessageFooter.displayName = "MessageFooter"

export interface BubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "muted" | "tinted" | "outline"
  align?: "start" | "end"
}

export const Bubble = React.forwardRef<HTMLDivElement, BubbleProps>(
  ({ className, variant = "default", align = "start", ...props }, ref) => {
    const variantStyles = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground border border-border/50",
      muted: "bg-muted text-foreground",
      tinted: "bg-sky-500/15 text-sky-200 border border-sky-500/30",
      outline: "bg-card border border-border text-foreground",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm",
          align === "end" ? "rounded-br-xs" : "rounded-bl-xs",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Bubble.displayName = "Bubble"

export const BubbleContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("break-words", className)} {...props} />
  )
)
BubbleContent.displayName = "BubbleContent"

export const MessageScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col h-full overflow-y-auto px-4 py-2 space-y-3", className)} {...props} />
  )
)
MessageScroller.displayName = "MessageScroller"
