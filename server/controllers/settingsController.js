const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) { settings = new Settings(); await settings.save(); }
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      // Merge each group explicitly so partial updates work
      const groups = ['voltage','current','power','frequency','temperature','powerFactor'];
      groups.forEach(g => {
        if (req.body[g]) settings[g] = { ...settings[g].toObject?.() ?? settings[g], ...req.body[g] };
      });
      settings.updatedAt = new Date();
    }
    await settings.save();
    // Broadcast updated thresholds to all connected browser clients
    const io = req.app.get('io');
    if (io) io.emit('settings-updated', settings);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.resetSettings = async (req, res) => {
  try {
    await Settings.deleteMany({});
    const settings = new Settings();
    await settings.save();
    const io = req.app.get('io');
    if (io) io.emit('settings-updated', settings);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.migrateSettings = async (req, res) => {
  res.json({ success: true, message: 'No migration needed' });
};
