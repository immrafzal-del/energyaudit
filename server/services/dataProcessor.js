const EnergyData = require('../models/EnergyData');
const Fault      = require('../models/Fault');
const { validateEnergyData, sanitizeEnergyData } = require('../utils/dataValidator');

let simulationInterval = null;
let lastDataTime       = Date.now();
let isSimulating       = false;

const THRESHOLDS = {
  voltageHigh: 250, voltageLow: 180,
  currentHigh: 10,  powerHigh:  2000,
  pfLow: 0.70,      freqHigh:   52.0, freqLow: 48.0,
};

const faultCooldown = {};
const COOLDOWN_MS   = 15000;

function resetCooldowns() {
  Object.keys(faultCooldown).forEach(k => delete faultCooldown[k]);
}

async function detectAndSaveFaults(data, io) {
  const now = Date.now(), checks = [];
  if (data.v > 1) {
    if (data.v > THRESHOLDS.voltageHigh) checks.push({ type:'Overvoltage', severity:'critical',
      message:`Voltage ${data.v.toFixed(1)} V exceeds ${THRESHOLDS.voltageHigh} V`,
      value:`${data.v.toFixed(1)} V`, threshold:`${THRESHOLDS.voltageHigh} V` });
    if (data.v < THRESHOLDS.voltageLow) checks.push({ type:'Undervoltage', severity:'warning',
      message:`Voltage ${data.v.toFixed(1)} V below ${THRESHOLDS.voltageLow} V`,
      value:`${data.v.toFixed(1)} V`, threshold:`${THRESHOLDS.voltageLow} V` });
  }
  if (data.i > THRESHOLDS.currentHigh) checks.push({ type:'Overcurrent', severity:'critical',
    message:`Current ${data.i.toFixed(2)} A exceeds ${THRESHOLDS.currentHigh} A`,
    value:`${data.i.toFixed(2)} A`, threshold:`${THRESHOLDS.currentHigh} A` });
  const pw = data.p > 0 ? data.p : data.v * data.i;
  if (pw > THRESHOLDS.powerHigh) checks.push({ type:'Overload', severity:'critical',
    message:`Power ${pw.toFixed(1)} W exceeds ${THRESHOLDS.powerHigh} W`,
    value:`${pw.toFixed(1)} W`, threshold:`${THRESHOLDS.powerHigh} W` });
  if (data.i > 0.05 && typeof data.pf === 'number' && data.pf < THRESHOLDS.pfLow && data.pf > 0)
    checks.push({ type:'Low Power Factor', severity:'warning',
      message:`PF ${data.pf.toFixed(3)} below ${THRESHOLDS.pfLow}`,
      value:`${data.pf.toFixed(3)}`, threshold:`${THRESHOLDS.pfLow}` });
  if (data.f > 10 && data.f < 100 && (data.f > THRESHOLDS.freqHigh || data.f < THRESHOLDS.freqLow))
    checks.push({ type:'Frequency Deviation', severity:'warning',
      message:`Frequency ${data.f.toFixed(2)} Hz outside ${THRESHOLDS.freqLow}–${THRESHOLDS.freqHigh} Hz`,
      value:`${data.f.toFixed(2)} Hz`, threshold:`${THRESHOLDS.freqLow}–${THRESHOLDS.freqHigh} Hz` });
  for (const c of checks) {
    const last = faultCooldown[c.type] || 0;
    if ((now - last) < COOLDOWN_MS) continue;
    faultCooldown[c.type] = now;
    try {
      const f = new Fault({ ...c, timestamp: new Date() });
      await f.save();
      if (io) io.emit('fault-alert', f);
      console.log(`⚠  [${c.severity}] ${c.type} — ${c.message}`);
    } catch(e) { console.error('Fault save:', e.message); }
  }
}

function makeSineWave(n=100) {
  return Array.from({length:n},(_,i)=>Math.round(512+400*Math.sin((i/n)*2*Math.PI)));
}

async function processData(rawData, io, isHardware=true) {
  try {
    if (isSimulating && isHardware) { console.log('HW connected — stopping sim'); stopSimulation(); }
    lastDataTime = Date.now();
    const val = validateEnergyData(rawData);
    if (!val.isValid) { console.error('Validation failed:', val.errors); return; }
    const s  = sanitizeEnergyData(rawData);
    const wt = (s.waveform || 'SINE').toUpperCase();
    const pf = s.i < 0.05 ? null : (typeof s.pf === 'number' && s.pf > 0 ? s.pf : null);
    const rec = new EnergyData({
      voltage:s.v, current:s.i, power:s.p>0?s.p:s.v*s.i,
      frequency:s.f, temperature:s.t, powerFactor:pf,
      waveform:{type:wt, samples:makeSineWave()}, isHardware
    });
    await rec.save();
    if (isHardware) await detectAndSaveFaults(s, io);

    // ── Convert raw ADC arrays to physical values ────────────────────────
    // rawData.vs[] and rawData.is[] = raw 10-bit ADC samples from Arduino
    // Calibration constants exactly matching Arduino firmware
    const VCAL = 2000 / 21 / 109;   // ADC counts → instantaneous volts
    const ICAL = 1 / 10.0;          // ADC counts → instantaneous amps

    let voltageWaveform = [];
    let currentWaveform = [];

    if (isHardware && Array.isArray(rawData.vs) && rawData.vs.length >= 2) {
      const vsNums = rawData.vs.map(Number);

      // Check for real AC signal: must have variation > 50 ADC counts
      // (all-zeros or all-same = ADC saturated / A0 not connected to circuit)
      const vsMax = Math.max(...vsNums);
      const vsMin = Math.min(...vsNums);
      const vsRange = vsMax - vsMin;

      if (vsRange > 50) {
        // Real signal — convert to volts (instantaneous, centred on 0)
        voltageWaveform = vsNums.map(adc => (adc - 512) * VCAL);

        // True RMS from waveform samples
        const sumSqV = vsNums.reduce((s,a) => { const v=(a-512)*VCAL; return s+v*v; }, 0);
        const vRms = Math.sqrt(sumSqV / vsNums.length);

        // Only override Arduino scalar if waveform gives plausible result
        // Valid range for Pakistan 230V grid: 150V–280V RMS
        if (s.v < 10 && vRms > 50 && vRms < 280) {
          s.v = vRms;
          rec.voltage = vRms;
          console.log(`  V from waveform: ${vRms.toFixed(1)} V rms  peak=${((vsMax-512)*VCAL).toFixed(1)} V`);
        } else {
          console.log(`  vs: range=${vsRange} ADC  V_rms=${vRms.toFixed(1)}V  Arduino_v=${s.v}V`);
        }
      } else {
        // ADC stuck — A0 not connected or 2.5V bias circuit issue
        console.log(`  vs: ADC range=${vsRange} counts (< 50) — A0 not reading AC signal`);
        voltageWaveform = []; // don't display garbage flat line
      }
    }

    if (isHardware && Array.isArray(rawData.is) && rawData.is.length >= 2) {
      const isNums = rawData.is.map(Number);
      const isMean = isNums.reduce((s,v) => s+v, 0) / isNums.length;
      const isMax  = Math.max(...isNums);
      const isMin  = Math.min(...isNums);
      const isRange = isMax - isMin;

      // Always convert and send current waveform — never block it
      // ADC is centred at 512 (= 2.5V = 0A for ACS712)
      // If mean differs from 512, offset is applied so waveform is centred on 0A
      const adcMidpoint = isMean; // use actual mean as midpoint if hardware offset exists
      currentWaveform = isNums.map(adc => (adc - adcMidpoint) * ICAL);

      // True RMS from waveform
      const sumSqI = currentWaveform.reduce((s,v) => s+v*v, 0);
      const iRms   = Math.sqrt(sumSqI / currentWaveform.length);

      // Override Arduino scalar if waveform gives valid value
      if (s.i < 0.001 && iRms > 0.005) {
        s.i = iRms;
        rec.current = iRms;
      }

      console.log(`  is: mean_adc=${isMean.toFixed(0)}  range=${isRange}  I_rms=${iRms.toFixed(4)}A`);
    }

    // Fix frequency if Arduino reported 0 but vs[] has real signal
    let emitFreq = rec.frequency;
    if (emitFreq < 1 && voltageWaveform.length >= 2) {
      // Count zero crossings in vs[] — 100 samples over ~20ms window
      let zc = 0;
      for (let k = 1; k < voltageWaveform.length; k++) {
        if (voltageWaveform[k-1] < 0 && voltageWaveform[k] >= 0) zc++;
      }
      // 100 samples = 20.8ms window → freq = zc * 1000/20.8
      if (zc >= 1) {
        emitFreq = zc * (1000 / 20.8);
        // Snap to grid frequencies
        if (emitFreq > 47 && emitFreq < 53) emitFreq = 50.0;
        else if (emitFreq > 57 && emitFreq < 63) emitFreq = 60.0;
        console.log(`  Freq from waveform ZC: ${zc} crossings → ${emitFreq.toFixed(1)} Hz`);
        rec.frequency = emitFreq;
      }
    }

    io.emit('energy-data', {
      timestamp:      rec.timestamp,
      voltage:        rec.voltage,
      current:        rec.current,
      power:          rec.power > 0 ? rec.power : rec.voltage * rec.current,
      powerFactor:    pf,
      frequency:      emitFreq,
      temperature:    rec.temperature,
      waveformType:   wt,
      isHardware,
      voltageWaveform,   // instantaneous V values — empty in simulation
      currentWaveform,   // instantaneous A values — empty in simulation
    });
  } catch(e) { console.error('processData:', e.message); }
}

function startSimulation(io) {
  if ((Date.now()-lastDataTime)<10000||isSimulating) return;
  console.log('No ESP32 data — simulation mode');
  isSimulating=true;
  simulationInterval=setInterval(async()=>{
    const v=220+Math.random()*10, i=1+Math.random()*2, pf=0.85+Math.random()*0.14;
    await processData({v,i,p:v*i*pf,pf,f:50+(Math.random()-0.5)*0.3,
      t:25+Math.random()*5,waveform:'SINE'},io,false);
  },200);
}
function stopSimulation() {
  if(simulationInterval){clearInterval(simulationInterval);simulationInterval=null;isSimulating=false;}
}
function getConnectionStatus() {
  return {isSimulating,lastDataTime,timeSinceLastData:Date.now()-lastDataTime};
}
module.exports={processData,startSimulation,stopSimulation,getConnectionStatus,resetCooldowns};
