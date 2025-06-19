const express = require('express');
const router = express.Router();
const ctlVoice = require('../controllers/assistantVoice.controller');
const ctlVoiceStream = require('../controllers/assistantVoice.stream');

router.post('/voice', ctlVoice.handleVoice);
router.post('/voice-stream', ctlVoiceStream.handleVoiceStream);

module.exports = router;
