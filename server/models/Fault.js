const mongoose = require('mongoose');

const faultSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  message: { type: String, required: true },
  value: { type: String },
  threshold: { type: String },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date }
});

faultSchema.index({ timestamp: -1 });
faultSchema.index({ severity: 1 });

module.exports = mongoose.model('Fault', faultSchema);
