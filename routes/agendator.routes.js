const express = require('express');
const router = express.Router();
const agendaStream = require('../controllers/agendatorResponses.stream');

router.post('/chat-stream', agendaStream.chatStream);

module.exports = router;