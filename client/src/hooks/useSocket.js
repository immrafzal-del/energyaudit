import { useEffect, useState } from 'react';
import socketService from '../services/socket';

export const useSocket = () => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socketService.connect();

    const handleConnectionStatus = ({ connected }) => {
      setConnected(connected);
    };

    socketService.onConnectionStatus(handleConnectionStatus);

    return () => {
      socketService.off('connection-status', handleConnectionStatus);
    };
  }, []);

  return { connected, socket: socketService };
};
