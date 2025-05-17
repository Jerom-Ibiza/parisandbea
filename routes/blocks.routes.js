const express = require('express');
const router  = express.Router();
const blocks  = require('../controllers/blocks.controller');

router.post('/upload', blocks.handleBlock);
module.exports = router;
