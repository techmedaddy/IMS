import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-3 py-1 text-[13px] text-[var(--color-text-primary)] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-text-ghost)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] focus-visible:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] shadow-sm placeholder:text-[var(--color-text-ghost)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)] focus-visible:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-40 resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 block",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Input, Textarea, Label }
