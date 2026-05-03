import React from 'react';
import { CheckCircle2, AlertCircle, FileText, Activity, MessageSquare, AlertTriangle } from 'lucide-react';
import { IncidentEvent } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

interface TimelineProps {
  events: IncidentEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) {
    return <div className="p-8 text-center text-[var(--color-text-tertiary)] text-[13px]">No timeline events recorded.</div>;
  }

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--color-border-default)] before:to-transparent pt-2">
      {events.map((event, idx) => {
        let Icon = Activity;
        let colorClass = 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        
        switch (event.event_type) {
          case 'CREATED':
            Icon = AlertCircle;
            colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
            break;
          case 'STATE_CHANGE':
            if (event.new_state === 'RESOLVED' || event.new_state === 'CLOSED') {
              Icon = CheckCircle2;
              colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            } else {
              Icon = Activity;
              colorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
            }
            break;
          case 'RCA_SUBMITTED':
            Icon = FileText;
            colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            break;
          case 'NOTE_ADDED':
            Icon = MessageSquare;
            colorClass = 'text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border-[var(--color-border-subtle)]';
            break;
          case 'SLA_BREACH':
            Icon = AlertTriangle;
            colorClass = 'text-red-500 bg-red-500/20 border-red-500/30 font-bold';
            break;
        }

        return (
          <div key={event.id} className="relative flex items-start gap-4 md:gap-6 group">
            {/* Desktop: Timestamp (Left) */}
            <div className="hidden md:flex flex-col items-end w-[120px] shrink-0 pt-1 text-right">
              <span className="text-[12px] font-mono font-medium text-[var(--color-text-secondary)]">
                {format(new Date(event.timestamp), 'HH:mm:ss')}
              </span>
              <span className="text-[10px] text-[var(--color-text-ghost)]">
                {format(new Date(event.timestamp), 'MMM d')}
              </span>
            </div>

            {/* Icon */}
            <div className={cn("relative z-10 flex shrink-0 items-center justify-center w-10 h-10 rounded-full border shadow-sm ring-4 ring-[var(--color-surface-base)]", colorClass)}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 pt-1 pb-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {event.event_type === 'CREATED' ? 'Incident Detected' :
                   event.event_type === 'STATE_CHANGE' ? `State changed to ${event.new_state}` :
                   event.event_type === 'RCA_SUBMITTED' ? 'RCA Submitted' :
                   event.event_type === 'NOTE_ADDED' ? 'Operator Note' :
                   event.event_type === 'SLA_BREACH' ? 'SLA Breached' :
                   event.event_type}
                </p>
                {/* Mobile Timestamp */}
                <span className="md:hidden text-[11px] font-mono text-[var(--color-text-ghost)]">
                  {format(new Date(event.timestamp), 'HH:mm')}
                </span>
              </div>
              
              {event.detail && (
                <div className="mt-1.5 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  {event.detail}
                </div>
              )}
              
              <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-[8px] font-mono border border-[var(--color-border-subtle)]">
                  {event.actor.slice(0,2).toUpperCase()}
                </div>
                <span className="text-[10px] text-[var(--color-text-ghost)] font-mono">{event.actor}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
