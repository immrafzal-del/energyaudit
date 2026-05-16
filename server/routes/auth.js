const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth routes
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);

module.exports = router;
