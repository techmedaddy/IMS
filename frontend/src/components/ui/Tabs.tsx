import * as React from "react"
import { cn } from "@/src/lib/utils"

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-full", className)} {...props} />
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center gap-0.5 rounded-lg bg-[var(--color-surface-overlay)] p-1 text-[var(--color-text-tertiary)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }
>(({ className, isActive, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[12px] font-medium transition-all cursor-pointer",
      isActive
        ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm"
        : "hover:bg-[var(--color-surface-hover)]/50 hover:text-[var(--color-text-secondary)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-4", className)}
    {...props}
  />
))
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
