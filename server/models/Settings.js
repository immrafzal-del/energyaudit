const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  voltage: {
    min:     { type: Number, default: 200 },
    max:     { type: Number, default: 250 },
    nominal: { type: Number, default: 230 }
  },
  current: {
    max:     { type: Number, default: 30 },
    warning: { type: Number, default: 25 }
  },
  power: {
    max:     { type: Number, default: 3000 },
    warning: { type: Number, default: 2500 }
  },
  frequency: {
    min:     { type: Number, default: 49 },
    max:     { type: Number, default: 51 },
    nominal: { type: Number, default: 50 }
  },
  temperature: {
    max:     { type: Number, default: 75 },
    warning: { type: Number, default: 60 }
  },
  powerFactor: {
    min:     { type: Number, default: 0.80 }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
