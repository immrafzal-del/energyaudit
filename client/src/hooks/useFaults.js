import { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';
import socketService from '../services/socket';
import { checkFaults } from '../utils/faultDetector';

export const useFaults = (energyData) => {
  const [faults, setFaults] = useState([]);
  const settingsRef  = useRef(null);
  const cooldownRef  = useRef({});
  const COOLDOWN_MS  = 10000; // 10 seconds — matches server

  useEffect(() => {
    // Load faults already saved in DB
    apiService.getFaults()
      .then(data => setFaults(Array.isArray(data) ? data : []))
      .catch(err  => console.error('Error fetching faults:', err));

    // Load thresholds from DB (same values the server uses)
    apiService.getSettings()
      .then(s => { settingsRef.current = s; })
      .catch(err => console.error('Error loading settings for fault detection:', err));

    // Keep thresholds in sync when user saves Settings page
    const handleSettingsUpdated = (s) => { settingsRef.current = s; };
    socketService.on('settings-updated', handleSettingsUpdated);

    // When server saves a new fault, refresh the fault list from DB
    const handleFaultSaved = () => {
      apiService.getFaults()
        .then(data => setFaults(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    socketService.on('fault-saved', handleFaultSaved);

    return () => {
      socketService.off('settings-updated', handleSettingsUpdated);
      socketService.off('fault-saved', handleFaultSaved);
    };
  }, []);

  // Run client-side fault check on each new reading (for instant UI feedback)
  useEffect(() => {
    if (!energyData || energyData.voltage === 0) return;
    const settings = settingsRef.current;
    if (!settings) return;

    const detected = checkFaults(energyData, settings);
    if (!detected.length) return;

    const now = Date.now();
    const fresh = detected.filter(f => {
      const last = cooldownRef.current[f.type] || 0;
      if (now - last < COOLDOWN_MS) return false;
      cooldownRef.current[f.type] = now;
      return true;
    });
    if (!fresh.length) return;

    // Add timestamp and save to DB
    const stamped = fresh.map(f => ({ ...f, timestamp: new Date() }));
    setFaults(prev => [...stamped, ...prev].slice(0, 200));
    stamped.forEach(fault =>
      apiService.createFault(fault).catch(err => console.error('Error saving fault:', err))
    );
  }, [energyData]);

  const clearFault = (index) => setFaults(prev => prev.filter((_, i) => i !== index));

  return { faults, clearFault };
};
