const mongoose = require('mongoose');

const baselineSchema = new mongoose.Schema({
  name:           { type: String, default: 'Normal Operation' },
  avgVoltage:     { type: Number, required: true },
  avgCurrent:     { type: Number, required: true },
  avgPower:       { type: Number, required: true },
  avgPF:          { type: Number, required: true },
  avgFrequency:   { type: Number, required: true },
  avgTemperature: { type: Number, required: true },
  stdVoltage:     { type: Number, default: 0 },
  stdCurrent:     { type: Number, default: 0 },
  stdPower:       { type: Number, default: 0 },
  sampleCount:    { type: Number, default: 0 },
  recordedAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Baseline', baselineSchema);
