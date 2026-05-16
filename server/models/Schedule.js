const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  period:     { type: String, enum: ['10min','30min','1hr','6hr','daily','weekly'], default: 'daily' },
  enabled:    { type: Boolean, default: true },
  lastRun:    { type: Date, default: null },
  nextRun:    { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
