// server/routes/advanced.js
// Handles the /api/advanced/* endpoints called by Dashboard.jsx
const express    = require('express');
const router     = express.Router();
const EnergyData = require('../models/EnergyData');
const Fault      = require('../models/Fault');

// GET /api/advanced/system-status
router.get('/system-status', async (req, res) => {
  try {
    const now     = new Date();
    const since1h = new Date(now - 3600000);

    const [recentCount, faultCount, latest] = await Promise.all([
      EnergyData.countDocuments({ timestamp: { $gte: since1h } }),
      Fault.countDocuments({ resolved: false }),
      EnergyData.findOne({}, {}, { sort: { timestamp: -1 } }).lean()
    ]);

    const isHardware = latest ? latest.isHardware : false;
    const v = latest ? latest.voltage : 0;
    const f = latest ? latest.frequency : 0;

    res.json({
      status:      faultCount === 0 ? 'normal' : 'fault',
      isHardware,
      dataRate:    recentCount,      // packets received in last hour
      activeFaults: faultCount,
      voltage:     v,
      frequency:   f,
      lastSeen:    latest ? latest.timestamp : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/advanced/load-identification
router.get('/load-identification', async (req, res) => {
  try {
    const latest = await EnergyData.findOne(
      { isHardware: true },
      {},
      { sort: { timestamp: -1 } }
    ).lean();

    if (!latest) {
      return res.json({ loadType: 'Unknown', confidence: 0, reason: 'No hardware data' });
    }

    const pf = latest.powerFactor || 1;
    const pw = latest.power || 0;

    let loadType, confidence, reason;
    if (pf >= 0.95) {
      loadType='Resistive'; confidence=95;
      reason='High power factor indicates purely resistive load (heater, lamp, kettle)';
    } else if (pf >= 0.80) {
      loadType='Mixed'; confidence=80;
      reason='Moderate power factor indicates mixed resistive-inductive load (motor + heater)';
    } else {
      loadType='Inductive'; confidence=85;
      reason='Low power factor indicates inductive load (motor, transformer, SMPS)';
    }

    res.json({ loadType, confidence, reason, powerFactor: pf, power: pw });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/advanced/predictive
router.get('/predictive', async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 86400000);
    const records  = await EnergyData.find(
      { isHardware: true, timestamp: { $gte: since24h } },
      { power: 1, voltage: 1, temperature: 1, timestamp: 1 }
    ).sort({ timestamp: 1 }).lean();

    if (records.length < 10) {
      return res.json({
        energyForecast:  null,
        anomalies:       [],
        recommendation:  'Collect more hardware data for predictive analysis',
        hoursOfData:     0
      });
    }

    const n       = records.length;
    const avgP    = records.reduce((s,r)=>s+r.power, 0) / n;
    const maxP    = Math.max(...records.map(r=>r.power));
    const avgV    = records.reduce((s,r)=>s+r.voltage, 0) / n;
    const hours   = (records[n-1].timestamp - records[0].timestamp) / 3600000;
    const kwhUsed = (avgP * hours) / 1000;

    const anomalies = [];
    if (maxP > avgP * 1.5) anomalies.push(`Power spike detected: ${maxP.toFixed(0)} W (avg ${avgP.toFixed(0)} W)`);
    if (avgV < 200) anomalies.push(`Low average voltage: ${avgV.toFixed(1)} V`);

    const dailyKwh = hours > 0 ? (kwhUsed / hours) * 24 : 0;

    res.json({
      energyForecast:  +dailyKwh.toFixed(3),
      anomalies,
      recommendation:  anomalies.length === 0
        ? 'System operating normally. No issues predicted.'
        : 'Review detected anomalies to prevent equipment damage.',
      hoursOfData:     +hours.toFixed(1),
      avgPower:        +avgP.toFixed(1),
      peakPower:       +maxP.toFixed(1)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
