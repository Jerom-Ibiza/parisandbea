const express = require('express');
const router = express.Router();
const assistantR = require('../controllers/assistantResponses.controller');

router.post('/assistantR/chat', assistantR.chat);

module.exports = router;
