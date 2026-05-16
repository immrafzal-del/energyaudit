const mongoose = require('mongoose');

const consumptionSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  type: { type: String, enum: ['daily', 'monthly'], required: true },
  totalEnergy: { type: Number, required: true }, // kWh
  totalCost: { type: Number, default: 0 },
  avgVoltage: { type: Number },
  avgCurrent: { type: Number },
  avgTemperature: { type: Number },
  peakPower: { type: Number },
  minPower: { type: Number }
});

consumptionSchema.index({ date: -1, type: 1 });

module.exports = mongoose.model('Consumption', consumptionSchema);
