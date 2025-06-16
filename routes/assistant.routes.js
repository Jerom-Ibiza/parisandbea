const express = require('express');
const router = express.Router();
const assistant = require('../controllers/assistantResponses.controller');

router.post('/chat', assistant.chat);

module.exports = router;
