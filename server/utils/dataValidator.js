const validateEnergyData = (data) => {
  const errors = [];

  // Voltage 0–300 V
  if (typeof data.v !== 'number' || data.v < 0 || data.v > 300)
    errors.push('Invalid voltage');

  // Current 0–30 A
  if (typeof data.i !== 'number' || data.i < 0 || data.i > 30)
    errors.push('Invalid current');

  // Frequency 0–1000 Hz (allow wide range; fault logic checks 49.5–50.5)
  if (typeof data.f !== 'number' || data.f < 0 || data.f > 1000)
    errors.push('Invalid frequency');

  // Temperature -40 to 150°C (NTC can read sub-zero)
  if (typeof data.t !== 'number' || data.t < -40 || data.t > 150)
    errors.push('Invalid temperature');

  // Waveform type — optional; accept SINE, SQUARE, SQUR, NONE
  if (data.waveform &&
      !['SINE','SQUARE','SQUR','TRIANGLE','NONE',
        'sine','square','squr','triangle','none'].includes(data.waveform))
    errors.push('Invalid waveform type');

  return { isValid: errors.length === 0, errors };
};

const sanitizeEnergyData = (data) => ({
  v:        Math.max(0,   Math.min(300,  parseFloat(data.v)  || 0)),
  i:        Math.max(0,   Math.min(30,   parseFloat(data.i)  || 0)),
  p:        Math.max(0,               parseFloat(data.p)  || 0),
  pf:       Math.max(0,   Math.min(1,    parseFloat(data.pf) || 0)),
  f:        Math.max(0,   Math.min(1000, parseFloat(data.f)  || 0)),
  t:        Math.max(-40, Math.min(150,  parseFloat(data.t)  || 25)),
  waveform: data.waveform || 'SINE',
});

module.exports = { validateEnergyData, sanitizeEnergyData };
