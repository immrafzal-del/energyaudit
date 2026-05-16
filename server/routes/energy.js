const express    = require('express');
const router     = express.Router();
const energyController = require('../controllers/energyController');
const EnergyData = require('../models/EnergyData');
const Fault      = require('../models/Fault');

router.get('/realtime',            energyController.getRealtimeData);
router.get('/waveform',            energyController.getWaveformData);
router.get('/consumption/daily',   energyController.getDailyConsumption);
router.get('/consumption/monthly', energyController.getMonthlyConsumption);
router.get('/stats',               energyController.getStats);
router.get('/analytics',           energyController.getAnalytics);
router.get('/history',             energyController.getHistory);

router.delete('/reset', async (req, res) => {
  try {
    const [e, f] = await Promise.all([EnergyData.deleteMany({}), Fault.deleteMany({})]);
    res.json({ success: true, energyDeleted: e.deletedCount, faultsDeleted: f.deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
