const express  = require('express');
const router   = express.Router();
const Schedule = require('../models/Schedule');

router.get('/', async (req, res) => {
  try { res.json(await Schedule.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, period } = req.body;
    const s = new Schedule({ name, period, nextRun: calcNextRun(period) });
    await s.save();
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const s = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function calcNextRun(period) {
  const now = new Date();
  switch (period) {
    case '10min':  return new Date(now.getTime() + 10  * 60 * 1000);
    case '30min':  return new Date(now.getTime() + 30  * 60 * 1000);
    case '1hr':    return new Date(now.getTime() + 60  * 60 * 1000);
    case '6hr':    return new Date(now.getTime() + 360 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default: { // daily — midnight
      const next = new Date(now); next.setDate(next.getDate() + 1); next.setHours(0,0,0,0); return next;
    }
  }
}

module.exports = router;
module.exports.calcNextRun = calcNextRun;
