// Waveform detection utility

function detectWaveformType(samples) {
  if (!samples || samples.length < 10) return 'unknown';
  
  const peaks = samples.filter((v, i) => 
    i > 0 && i < samples.length - 1 && v > samples[i-1] && v > samples[i+1]
  );
  
  const valleys = samples.filter((v, i) => 
    i > 0 && i < samples.length - 1 && v < samples[i-1] && v < samples[i+1]
  );
  
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / samples.length;
  
  // Square wave: low variance, sharp transitions
  if (variance < 100 && peaks.length < 3) return 'square';
  
  // Sine wave: smooth, regular peaks
  if (peaks.length >= 1 && peaks.length <= 2) return 'sine';
  
  // Triangle wave: linear transitions
  if (peaks.length >= 2 && variance > 100) return 'triangle';
  
  return 'sine';
}

module.exports = { detectWaveformType };
