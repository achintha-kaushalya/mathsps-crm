import * as React from "react"
import { cn } from "@/lib/utils"

export const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-4", className)} {...props} />
  )
)
FieldGroup.displayName = "FieldGroup"

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal"
  "data-invalid"?: boolean
  "data-disabled"?: boolean
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        orientation === "horizontal" ? "flex-row items-center justify-between gap-4" : "flex-col gap-1.5",
        "data-[invalid=true]:text-red-400 data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Field.displayName = "Field"

export const FieldLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
)
FieldLabel.displayName = "FieldLabel"

export const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[11px] text-muted-foreground leading-normal", className)} {...props} />
  )
)
FieldDescription.displayName = "FieldDescription"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-border bg-input-bg px-3 py-1.5 text-xs text-foreground shadow-sm transition-all file:border-0 file:bg-transparent file:text-xs file:font-semibold placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
