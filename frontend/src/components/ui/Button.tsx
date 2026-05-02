import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] font-medium shadow-sm shadow-[var(--color-brand)]/20",
      secondary: "bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-default)]",
      outline: "border border-[var(--color-border-default)] bg-transparent hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
      ghost: "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
      danger: "bg-red-600/90 text-white hover:bg-red-600 shadow-sm",
    };

    const sizes = {
      sm: "h-7 px-3 text-[12px] rounded-md gap-1.5",
      md: "h-8 px-3.5 text-[13px] rounded-md gap-2",
      lg: "h-10 px-5 text-sm rounded-lg gap-2",
      icon: "h-8 w-8 rounded-md",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
