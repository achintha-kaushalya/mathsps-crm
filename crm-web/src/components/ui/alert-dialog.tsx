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
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: '14px',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        color: '#f8fafc',
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
      className={cn("flex flex-col gap-2.5 text-left", className)}
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
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
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
        lineHeight: 1.5,
        margin: '2px 0 0',
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
      className={cn("flex items-center justify-end gap-2.5", className)}
      style={{
        marginTop: '20px',
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: '#e11d48',
        color: '#ffffff',
        border: '1px solid rgba(225, 29, 72, 0.4)',
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '7px',
        fontWeight: 600,
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
        "inline-flex items-center justify-center rounded-lg font-medium cursor-pointer active:scale-98 transition-all disabled:opacity-50",
        className
      )}
      style={{
        background: '#1e293b',
        color: '#cbd5e1',
        border: '1px solid #334155',
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '7px',
        fontWeight: 500,
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    />
  )
)
AlertDialogCancel.displayName = "AlertDialogCancel"
