const express = require('express');
const router  = express.Router();
const fc      = require('../controllers/faultController');

// IMPORTANT: specific routes BEFORE parameterised /:id routes
router.get('/stats',  fc.getFaultStats);
router.delete('/all', fc.deleteAllFaults);   // Clear All — must be before /:id

router.get('/',           fc.getAllFaults);
router.post('/',          fc.createFault);
router.put('/:id/resolve',fc.resolveFault);
router.delete('/:id',     fc.deleteFault);

module.exports = router;
