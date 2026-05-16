const mongoose = require('mongoose');

const energyDataSchema = new mongoose.Schema({
  timestamp:   { type: Date, default: Date.now, index: true },
  voltage:     { type: Number, required: true },
  current:     { type: Number, required: true },
  power:       { type: Number, required: true },
  frequency:   { type: Number, required: true },
  temperature: { type: Number, required: true },
  waveform: {
    type: {
      type: String,
      // Added SQUR — Arduino sends this for square wave detection
      enum: ['SINE','SQUARE','SQUR','TRIANGLE','NONE',
             'sine','square','squr','triangle','unknown'],
      default: 'SINE'
    },
    samples: [Number]
  },
  powerFactor: { type: Number, default: 1 },
  isHardware:  { type: Boolean, default: false }
}, {
  timeseries: {
    timeField:   'timestamp',
    granularity: 'seconds'
  }
});

energyDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model('EnergyData', energyDataSchema);
