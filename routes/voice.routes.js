const express = require('express');
const router  = express.Router();
const voice   = require('../controllers/voice.controller');

// No pedimos API-KEY, basta con que exista la sesión
router.post('/identify', voice.identifyPatient);
router.post('/identify-text', voice.identifyPatientByText);

module.exports = router;
