import * as React from "react"
import { cn } from "@/lib/utils"

export interface AlertDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({ open, children }: AlertDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in-0 duration-200" />
      {/* Dialog Surface */}
      <div className="relative z-50 w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  )
}

export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/[0.12] bg-[#0c1322]/95 p-6 shadow-2xl backdrop-blur-xl transition-all",
        className
      )}
      {...props}
    />
  )
)
AlertDialogContent.displayName = "AlertDialogContent"

export const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2 text-left", className)} {...props} />
  )
)
AlertDialogHeader.displayName = "AlertDialogHeader"

export const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-base font-bold text-foreground flex items-center gap-2", className)} {...props} />
  )
)
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground leading-relaxed", className)} {...props} />
  )
)
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-end gap-3 mt-6", className)} {...props} />
  )
)
AlertDialogFooter.displayName = "AlertDialogFooter"

export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500 cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-card-hover hover:text-foreground cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
AlertDialogCancel.displayName = "AlertDialogCancel"
