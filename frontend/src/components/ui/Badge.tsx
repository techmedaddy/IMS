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
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
      variant === 'default' ? "border-transparent bg-slate-100 text-slate-900" : "text-slate-200 border-slate-700",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export const SeverityBadge = ({ severity }: { severity: Severity }) => {
  const colors = {
    P0: "bg-red-500/10 border-red-500/50 text-red-500",
    P1: "bg-orange-500/10 border-orange-500/50 text-orange-500",
    P2: "bg-yellow-500/10 border-yellow-500/50 text-yellow-500",
    P3: "bg-green-500/10 border-green-500/50 text-green-500",
  };

  return (
    <Badge className={cn("border", colors[severity])}>
      {severity}
    </Badge>
  );
};

export const StatusBadge = ({ state }: { state: IncidentState }) => {
  const colors = {
    OPEN: "bg-red-500/10 border-red-500/50 text-red-500",
    INVESTIGATING: "bg-blue-500/10 border-blue-500/50 text-blue-500",
    RESOLVED: "bg-green-500/10 border-green-500/50 text-green-500",
    CLOSED: "bg-slate-500/10 border-slate-500/50 text-slate-500",
  };

  return (
    <Badge className={cn("border font-mono tracking-tight", colors[state])}>
      {state}
    </Badge>
  );
};

export { Badge }
