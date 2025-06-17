const express = require('express');
const router = express.Router();
const assistant = require('../controllers/assistantResponses.controller');
const { chatStream } = require('../controllers/assistantResponses.stream');

router.post('/chat', assistant.chat);
router.post('/chat/stream', chatStream);

module.exports = router;
