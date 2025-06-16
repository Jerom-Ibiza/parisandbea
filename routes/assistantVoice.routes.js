const express = require('express');
const router = express.Router();
const ctlVoice = require('../controllers/assistantVoice.controller');

router.post('/voice', ctlVoice.handleVoice);

module.exports = router;
