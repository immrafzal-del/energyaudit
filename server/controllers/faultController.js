const Fault = require('../models/Fault');

// Get all faults — with loading-safe response
exports.getAllFaults = async (req, res) => {
  try {
    const { severity, limit = 200 } = req.query;
    const query = severity ? { severity } : {};
    const faults = await Fault.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();       // lean() is faster — returns plain objects
    res.json(faults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new fault
exports.createFault = async (req, res) => {
  try {
    const fault = new Fault(req.body);
    await fault.save();
    if (req.app.get('io')) req.app.get('io').emit('fault-alert', fault);
    res.status(201).json(fault);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resolve fault
exports.resolveFault = async (req, res) => {
  try {
    const fault = await Fault.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!fault) return res.status(404).json({ error: 'Fault not found' });
    res.json(fault);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete single fault
exports.deleteFault = async (req, res) => {
  try {
    const fault = await Fault.findByIdAndDelete(req.params.id);
    if (!fault) return res.status(404).json({ error: 'Fault not found' });
    res.json({ message: 'Fault deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── DELETE ALL faults ─────────────────────────────────────────────────────
// Also resets the dataProcessor cooldown map so it does not instantly
// re-generate 98 fault records from the existing cooldown state.
exports.deleteAllFaults = async (req, res) => {
  try {
    const result = await Fault.deleteMany({});

    // Reset the in-memory cooldown map in dataProcessor so that
    // all fault types are treated as "never seen" after a clear.
    // This prevents the burst of re-saved faults on the next data packet.
    try {
      const dp = require('../services/dataProcessor');
      if (typeof dp.resetCooldowns === 'function') dp.resetCooldowns();
    } catch (_) { /* dataProcessor may not export resetCooldowns yet */ }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fault stats
exports.getFaultStats = async (req, res) => {
  try {
    const stats = await Fault.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);
    const result = { critical: 0, warning: 0, info: 0 };
    stats.forEach(s => { result[s._id] = s.count; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
