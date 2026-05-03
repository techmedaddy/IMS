import { useEffect } from 'react';
import { Incident } from '../types';

export function useIncidentsSocket(
  onIncidentUpdate: (incident: Incident) => void
) {
  useEffect(() => {
    // Construct WebSocket URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // e.g., localhost:5173 or api.domain.com
    // Our vite proxy doesn't proxy websockets automatically unless configured,
    // but assuming standard setup, we can point to the backend directly if needed.
    // Let's use the standard relative path and assume Vite handles ws proxy, 
    // or we point to the API port. The backend runs on 8000.
    const wsUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('http', 'ws') + '/ws/incidents'
      : `ws://localhost:8000/api/ws/incidents`;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onIncidentUpdate(data);
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };

      ws.onclose = () => {
        // Reconnect after 2 seconds
        reconnectTimer = setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error', err);
        ws.close();
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [onIncidentUpdate]);
}
