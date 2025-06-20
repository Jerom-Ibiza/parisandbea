const express = require('express');
const router = express.Router();
const agendaStream = require('../controllers/agendatorResponses.stream');
const voiceStream = require('../controllers/agendatorVoice.stream');

router.post('/chat-stream', agendaStream.chatStream);
router.post('/voice-stream', voiceStream.handleVoiceStream);

module.exports = router;