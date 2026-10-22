import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export interface AlertDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const emptySubscribe = () => () => {}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!open || !isMounted) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Clean Subtle Backdrop (dim overlay, not pitch black) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1,
        }}
        onClick={() => onOpenChange?.(false)}
      />

      {/* Dialog Surface Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '420px',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-5 transition-all text-slate-100", className)}
      style={{
        background: '#0b0f17',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        color: '#f1f5f9',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogContent.displayName = "AlertDialogContent"

export const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-3 text-left", className)}
      style={{ ...style }}
      {...props}
    />
  )
)
AlertDialogHeader.displayName = "AlertDialogHeader"

export const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, style, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("font-semibold text-slate-100", className)}
      style={{
        color: '#f8fafc',
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '-0.015em',
        margin: 0,
        lineHeight: 1.25,
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, style, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-slate-400 text-sm leading-normal", className)}
      style={{
        color: '#94a3b8',
        fontSize: '13px',
        lineHeight: 1.5,
        margin: 0,
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-2 pt-4 mt-1 border-t border-slate-800/60", className)}
      style={{
        marginTop: '16px',
        paddingTop: '14px',
        borderTop: '1px solid rgba(30, 41, 59, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '8px',
        ...style,
      }}
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
        "inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer active:scale-95 transition-all disabled:opacity-50 select-none",
        className
      )}
      style={{
        background: '#dc2626',
        color: '#ffffff',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '6px',
        fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
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
        "inline-flex items-center justify-center font-medium cursor-pointer active:scale-95 transition-all disabled:opacity-50 select-none",
        className
      )}
      style={{
        background: 'transparent',
        color: '#94a3b8',
        border: '1px solid #334155',
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '6px',
        fontWeight: 500,
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogCancel.displayName = "AlertDialogCancel"
