const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/viafirmaCallback.controller');

router.post('/callback', ctrl.handle);   //  POST /api/viafirma/callback

module.exports = router;
