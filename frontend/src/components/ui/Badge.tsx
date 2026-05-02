import * as React from "react"
import { cn } from "@/src/lib/utils"
import { Severity, IncidentState } from "@/src/types"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline';
  className?: string;
  children?: React.ReactNode;
}

const Badge = ({ className, variant = 'default', children, ...props }: BadgeProps) => (
  <div
    className={cn(
      "inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] font-medium tracking-tight transition-colors",
      variant === 'default' ? "border-transparent bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]" : "text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const styles = {
    P0: "bg-red-500/10 border-red-500/30 text-red-400",
    P1: "bg-orange-500/10 border-orange-500/30 text-orange-400",
    P2: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    P3: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  };

  return (
    <Badge className={cn("border font-semibold font-mono text-[10px]", styles[severity])}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {severity}
    </Badge>
  );
};

export const StatusBadge = ({ state }: { state: IncidentState }) => {
  const styles = {
    OPEN: "bg-red-500/8 border-red-500/25 text-red-400",
    INVESTIGATING: "bg-indigo-500/8 border-indigo-500/25 text-indigo-400",
    RESOLVED: "bg-emerald-500/8 border-emerald-500/25 text-emerald-400",
    CLOSED: "bg-gray-500/8 border-gray-500/25 text-gray-400",
  };

  return (
    <Badge className={cn("border font-mono text-[10px] tracking-tight", styles[state])}>
      {state}
    </Badge>
  );
};

export { Badge }
