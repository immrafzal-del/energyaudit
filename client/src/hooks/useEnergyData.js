import { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';
import apiService from '../services/api';

export const useEnergyData = () => {
  const [energyData, setEnergyData] = useState({
    voltage: 0, current: 0, power: 0,
    powerFactor: null, frequency: 0, temperature: 0,
    waveformType: 'none', isHardware: false
  });
  const [waveformData, setWaveformData]     = useState({ voltage: [], current: [] });
  const [historicalData, setHistoricalData] = useState([]);

  useEffect(() => {
    apiService.getRealtimeData()
      .then(data => setHistoricalData(data))
      .catch(err => console.error('Error fetching historical data:', err));

    const handleEnergyData = (data) => {
      setEnergyData(data);
      setHistoricalData(prev => [...prev.slice(-299), data]);

      // Extract real ADC waveform arrays sent by server
      const vArr = Array.isArray(data.voltageWaveform) && data.voltageWaveform.length >= 2
        ? data.voltageWaveform : [];
      const iArr = Array.isArray(data.currentWaveform) && data.currentWaveform.length >= 2
        ? data.currentWaveform : [];

      setWaveformData({ voltage: vArr, current: iArr });
    };

    socketService.onEnergyData(handleEnergyData);

    return () => {
      socketService.off('energy-data', handleEnergyData);
    };
  }, []);

  return { energyData, waveformData, historicalData };
};
