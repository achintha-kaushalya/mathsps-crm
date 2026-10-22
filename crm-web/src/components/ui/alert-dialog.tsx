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
      className={cn("p-6 transition-all", className)}
      style={{
        background: '#131b2e',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        color: '#ffffff',
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
      className={cn("font-bold flex items-center gap-2", className)}
      style={{
        color: '#f8fafc',
        fontSize: '16px',
        fontWeight: 700,
        margin: 0,
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
      className={cn("leading-relaxed", className)}
      style={{
        color: '#94a3b8',
        fontSize: '13px',
        lineHeight: 1.6,
        margin: '6px 0 0',
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
      className={cn("flex items-center justify-end gap-3", className)}
      style={{
        marginTop: '22px',
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: '#dc2626',
        color: '#ffffff',
        border: 'none',
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '8px',
        fontWeight: 600,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
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
        "inline-flex items-center justify-center rounded-lg font-medium cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: 'transparent',
        color: '#cbd5e1',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '7px 14px',
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
