const express = require('express');
const router = express.Router();
const assistant = require('../controllers/assistantResponses.controller');
const assistantStream = require('../controllers/assistantResponses.stream');

router.post('/chat', assistant.chat);
router.post('/chat-stream', assistantStream.chatStream);

module.exports = router;
