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
      className={cn("p-6 transition-all text-slate-100", className)}
      style={{
        background: '#0d131f',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        color: '#f8fafc',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
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
      className={cn("flex flex-col gap-3.5 text-left", className)}
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
        fontSize: '16px',
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
        lineHeight: 1.55,
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
      className={cn("flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-slate-800/80", className)}
      style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '10px',
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
        "inline-flex items-center justify-center gap-1.5 font-medium cursor-pointer active:scale-95 transition-all disabled:opacity-50 select-none hover:brightness-110",
        className
      )}
      style={{
        background: '#ef4444',
        color: '#ffffff',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        padding: '8px 16px',
        fontSize: '12px',
        borderRadius: '8px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
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
        "inline-flex items-center justify-center font-medium cursor-pointer active:scale-95 transition-all disabled:opacity-50 select-none hover:bg-slate-800/60 hover:text-slate-200",
        className
      )}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        color: '#94a3b8',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px 16px',
        fontSize: '12px',
        borderRadius: '8px',
        fontWeight: 500,
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogCancel.displayName = "AlertDialogCancel"
