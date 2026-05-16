const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Settings routes
router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSettings);
router.post('/reset', settingsController.resetSettings);
router.post('/migrate', settingsController.migrateSettings);

module.exports = router;
