import { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';
import apiService    from '../services/api';

export const useEnergyData = () => {
  const [energyData, setEnergyData] = useState({
    voltage: 0, current: 0, power: 0,
    powerFactor: null, frequency: 0, temperature: 0,
    waveformType: 'none', isHardware: false
  });

  // waveformData holds the ACTUAL ADC sample arrays from Arduino
  // voltageWaveform: 100 values in Volts (instantaneous)
  // currentWaveform: 100 values in Amps  (instantaneous)
  const [waveformData, setWaveformData]     = useState({ voltage: [], current: [] });
  const [historicalData, setHistoricalData] = useState([]);

  useEffect(() => {
    apiService.getRealtimeData()
      .then(data => setHistoricalData(data))
      .catch(err => console.error('useEnergyData init:', err));

    const handleEnergyData = (data) => {
      // Update scalar measurements (gauges, stats)
      setEnergyData(data);
      setHistoricalData(prev => [...prev.slice(-299), data]);

      // Use the real ADC waveform arrays sent by the server
      // These are already converted to V and A in dataProcessor.js
      // If hardware is not connected (simulation mode), arrays are empty
      // and the oscilloscope correctly shows "NO SIGNAL"
      const vWave = Array.isArray(data.voltageWaveform) && data.voltageWaveform.length >= 2
        ? data.voltageWaveform : [];
      const iWave = Array.isArray(data.currentWaveform) && data.currentWaveform.length >= 2
        ? data.currentWaveform : [];

      setWaveformData({ voltage: vWave, current: iWave });
    };

    socketService.onEnergyData(handleEnergyData);

    return () => {
      socketService.off('energy-data', handleEnergyData);
    };
  }, []);

  return { energyData, waveformData, historicalData };
};
