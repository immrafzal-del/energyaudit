const mongoose = require('mongoose');

const calibrationSchema = new mongoose.Schema({
  voltageOffset:  { type: Number, default: 0 },     // add to measured voltage
  voltageScale:   { type: Number, default: 1.0 },   // multiply measured voltage
  currentOffset:  { type: Number, default: 0 },
  currentScale:   { type: Number, default: 1.0 },
  powerOffset:    { type: Number, default: 0 },
  updatedAt:      { type: Date, default: Date.now }
});

module.exports = mongoose.model('Calibration', calibrationSchema);
