const EnergyData  = require('../models/EnergyData');
const RATE = 25; // Rs per kWh

exports.getRealtimeData = async (req, res) => {
  try {
    const data = await EnergyData.find({ isHardware:true })
      .sort({ timestamp:-1 }).limit(100);
    res.json(data.reverse());
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.getWaveformData = async (req, res) => {
  try {
    const data = await EnergyData.findOne({ isHardware:true })
      .sort({ timestamp:-1 }).select('waveform timestamp');
    res.json(data);
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── Daily consumption: aggregate directly from EnergyData ─────────────────
exports.getDailyConsumption = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0,0,0,0);

    // Group readings by calendar day
    const raw = await EnergyData.find({
      timestamp:  { $gte: since },
      isHardware: true
    }).sort({ timestamp: 1 }).select('timestamp power');

    if (!raw.length) return res.json([]);

    // Bucket by date string
    const buckets = {};
    raw.forEach(d => {
      const key = new Date(d.timestamp).toISOString().slice(0,10);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(d);
    });

    const result = Object.entries(buckets).map(([date, readings]) => {
      // Energy (kWh) = average power × duration in hours / 1000
      const n    = readings.length;
      const avgP = readings.reduce((s,r)=>s+r.power,0) / n;
      const durH = (new Date(readings[n-1].timestamp) - new Date(readings[0].timestamp)) / 3600000 || (n * 0.2 / 3600); // fallback: 200ms per reading
      const energy = (avgP * durH) / 1000;
      return { date, energy: +energy.toFixed(4), cost: +(energy * RATE).toFixed(2) };
    });

    res.json(result);
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.getMonthlyConsumption = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const since  = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1); since.setHours(0,0,0,0);

    const raw = await EnergyData.find({
      timestamp: { $gte: since }, isHardware: true
    }).sort({ timestamp:1 }).select('timestamp power');

    if (!raw.length) return res.json([]);

    const buckets = {};
    raw.forEach(d => {
      const dt = new Date(d.timestamp);
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(d);
    });

    const result = Object.entries(buckets).map(([month, readings]) => {
      const n    = readings.length;
      const avgP = readings.reduce((s,r)=>s+r.power,0) / n;
      const durH = (new Date(readings[n-1].timestamp) - new Date(readings[0].timestamp)) / 3600000 || 1;
      const energy = (avgP * durH) / 1000;
      return { date: month, energy: +energy.toFixed(3), cost: +(energy*RATE).toFixed(2) };
    });

    res.json(result);
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const data  = await EnergyData.find({ timestamp:{ $gte:today }, isHardware:true });
    const n     = data.length;
    if (!n) return res.json({ currentPower:0, todayEnergy:0, avgVoltage:0, avgCurrent:0, temperature:0 });
    const avgP = data.reduce((s,d)=>s+d.power,0) / n;
    const durH = (new Date(data[n-1].timestamp) - new Date(data[0].timestamp)) / 3600000 || 0;
    res.json({
      currentPower: data[n-1].power,
      todayEnergy:  (avgP * durH) / 1000,
      avgVoltage:   data.reduce((s,d)=>s+d.voltage,0) / n,
      avgCurrent:   data.reduce((s,d)=>s+d.current,0) / n,
      temperature:  data[n-1].temperature
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    const start = new Date();
    if (range === '24h')  start.setHours(start.getHours() - 24);
    else if (range === '7d')  start.setDate(start.getDate() - 7);
    else if (range === '30d') start.setDate(start.getDate() - 30);

    const data = await EnergyData.find({
      timestamp: { $gte: start }
    }).sort({ timestamp:1 });

    if (!data.length) return res.json({ powerTrend:[], stats:null });

    const step = Math.max(1, Math.floor(data.length / 300));
    const powerTrend = data
      .filter((_,i) => i % step === 0)
      .map(d => ({
        timestamp: d.timestamp,
        time:    new Date(d.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
        power:   +d.power.toFixed(2),
        voltage: +d.voltage.toFixed(2),
        current: +d.current.toFixed(3)
      }));

    const n    = data.length;
    const avgP = data.reduce((s,d)=>s+d.power,0) / n;
    const avgPF= data.reduce((s,d)=>s+(d.powerFactor||0),0) / n;
    const durH = (new Date(data[n-1].timestamp) - new Date(data[0].timestamp)) / 3600000 || 1;
    const energy = (avgP * durH) / 1000;

    res.json({
      powerTrend,
      stats: {
        totalEnergy: +energy.toFixed(4),
        totalCost:   +(energy * RATE).toFixed(2),
        peakPower:   +Math.max(...data.map(d=>d.power)).toFixed(2),
        avgPF:       +avgPF.toFixed(3)
      }
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.getHistory = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error:'Date required' });
    const s = new Date(date); s.setHours(0,0,0,0);
    const e = new Date(date); e.setHours(23,59,59,999);
    const data = await EnergyData.find({ timestamp:{$gte:s,$lte:e} }).sort({timestamp:1});
    res.json(data);
  } catch(e) { res.status(500).json({ error:e.message }); }
};
