// Fault detection — mirrors server/services/dataProcessor.js detectAndSaveFaults()
// Uses thresholds loaded from the API (same DB values the server uses).

export const checkFaults = (data, settings) => {
  if (!settings) return [];
  const faults = [];

  // ── 1. Voltage ────────────────────────────────────────────────────────────
  if (settings.voltage && data.voltage > 1) {
    if (data.voltage > settings.voltage.max)
      faults.push({ type:'Overvoltage', severity:'critical',
        message:`Voltage ${data.voltage.toFixed(1)} V exceeds max ${settings.voltage.max} V`,
        value:`${data.voltage.toFixed(1)} V`, threshold:`${settings.voltage.max} V` });
    else if (data.voltage < settings.voltage.min)
      faults.push({ type:'Undervoltage', severity:'warning',
        message:`Voltage ${data.voltage.toFixed(1)} V below min ${settings.voltage.min} V`,
        value:`${data.voltage.toFixed(1)} V`, threshold:`${settings.voltage.min} V` });
  }

  // ── 2. Current ────────────────────────────────────────────────────────────
  if (settings.current) {
    if (data.current > settings.current.max)
      faults.push({ type:'Overcurrent', severity:'critical',
        message:`Current ${data.current.toFixed(2)} A exceeds max ${settings.current.max} A`,
        value:`${data.current.toFixed(2)} A`, threshold:`${settings.current.max} A` });
    else if (settings.current.warning && data.current > settings.current.warning)
      faults.push({ type:'High Current', severity:'warning',
        message:`Current ${data.current.toFixed(2)} A above warning ${settings.current.warning} A`,
        value:`${data.current.toFixed(2)} A`, threshold:`${settings.current.warning} A` });
  }

  // ── 3. Power ──────────────────────────────────────────────────────────────
  if (settings.power) {
    if (data.power > settings.power.max)
      faults.push({ type:'Overload', severity:'critical',
        message:`Power ${data.power.toFixed(1)} W exceeds max ${settings.power.max} W`,
        value:`${data.power.toFixed(1)} W`, threshold:`${settings.power.max} W` });
    else if (settings.power.warning && data.power > settings.power.warning)
      faults.push({ type:'High Power', severity:'warning',
        message:`Power ${data.power.toFixed(1)} W above warning ${settings.power.warning} W`,
        value:`${data.power.toFixed(1)} W`, threshold:`${settings.power.warning} W` });
  }

  // ── 4. Frequency ──────────────────────────────────────────────────────────
  if (settings.frequency && data.frequency > 10 && data.frequency < 1000) {
    if (data.frequency > settings.frequency.max || data.frequency < settings.frequency.min)
      faults.push({ type:'Frequency Deviation', severity:'warning',
        message:`Frequency ${data.frequency.toFixed(2)} Hz outside ${settings.frequency.min}–${settings.frequency.max} Hz`,
        value:`${data.frequency.toFixed(2)} Hz`, threshold:`${settings.frequency.min}–${settings.frequency.max} Hz` });
  }

  // ── 5. Temperature ────────────────────────────────────────────────────────
  if (settings.temperature) {
    if (data.temperature > settings.temperature.max)
      faults.push({ type:'Overtemperature', severity:'critical',
        message:`Temperature ${data.temperature.toFixed(1)} °C exceeds max ${settings.temperature.max} °C`,
        value:`${data.temperature.toFixed(1)} °C`, threshold:`${settings.temperature.max} °C` });
    else if (settings.temperature.warning && data.temperature > settings.temperature.warning)
      faults.push({ type:'High Temperature', severity:'warning',
        message:`Temperature ${data.temperature.toFixed(1)} °C above warning ${settings.temperature.warning} °C`,
        value:`${data.temperature.toFixed(1)} °C`, threshold:`${settings.temperature.warning} °C` });
  }

  // ── 6. Power Factor ───────────────────────────────────────────────────────
  if (settings.powerFactor?.min && data.current > 0.1) {
    const pf = data.powerFactor;
    if (pf !== null && pf !== undefined && pf > 0 && pf < settings.powerFactor.min)
      faults.push({ type:'Low Power Factor', severity:'warning',
        message:`Power factor ${pf.toFixed(3)} below minimum ${settings.powerFactor.min}`,
        value:`${pf.toFixed(3)}`, threshold:`≥ ${settings.powerFactor.min}` });
  }

  return faults;
};
