import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useIncidentsSocket } from '@/src/hooks/useIncidentsSocket';

export function GlobalToasts() {
  const previousStates = useRef<Record<string, string>>({});

  useIncidentsSocket((data: any) => {
    // Handle note_added
    if (data.type === 'note_added') {
      toast.success(`New note added to ${data.incident_id.slice(0,8)}`, {
        icon: '💬',
      });
      return;
    }

    // Handle incident updates
    if (data.id && data.state) {
      const prev = previousStates.current[data.id];
      const isNew = !prev;
      
      if (isNew && data.state === 'OPEN') {
        toast.error(
          <div>
            <div className="font-semibold text-sm">New {data.severity} Incident</div>
            <div className="text-xs opacity-90">{data.component_id}</div>
          </div>,
          { duration: 6000, style: { minWidth: '250px' } }
        );
      } else if (prev && prev !== data.state) {
        toast(
          <div>
            <div className="font-semibold text-sm">State Changed</div>
            <div className="text-xs opacity-90">{data.id.slice(0,8)} → {data.state}</div>
          </div>,
          { icon: '🔄', duration: 4000 }
        );
      }

      previousStates.current[data.id] = data.state;
    }
  });

  return null;
}
