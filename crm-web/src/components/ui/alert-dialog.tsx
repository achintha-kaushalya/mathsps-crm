import * as React from "react"
import { cn } from "@/lib/utils"

export interface AlertDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 100001,
        }}
        onClick={() => onOpenChange?.(false)}
      />
      {/* Dialog Surface */}
      <div
        style={{
          position: 'relative',
          zIndex: 100002,
          width: '100%',
          maxWidth: '460px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl p-6 shadow-2xl transition-all", className)}
      style={{
        background: 'var(--bg-card, #0f172a)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        color: 'var(--text-primary, #ffffff)',
        ...style,
      }}
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
  ({ className, style, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-base font-bold flex items-center gap-2", className)}
      style={{ color: 'var(--text-primary, #ffffff)', ...style }}
      {...props}
    />
  )
)
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, style, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs leading-relaxed", className)}
      style={{ color: 'var(--text-secondary, #94a3b8)', ...style }}
      {...props}
    />
  )
)
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-3", className)}
      style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}
      {...props}
    />
  )
)
AlertDialogFooter.displayName = "AlertDialogFooter"

export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, style, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: '#ef4444',
        color: '#ffffff',
        border: 'none',
        padding: '8px 16px',
        fontSize: '12px',
        borderRadius: '8px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, style, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: 'transparent',
        color: 'var(--text-secondary, #94a3b8)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
        padding: '8px 16px',
        fontSize: '12px',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogCancel.displayName = "AlertDialogCancel"
