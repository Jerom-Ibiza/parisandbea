const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/registroTokens.controller');

router.post('/create', ctrl.create);            // sesión requerida
router.get('/validate/:token', ctrl.validate);   // pública
router.get('/kiosk', ctrl.createKiosk);        // GET /api/tokens/kiosk?key=XXX

module.exports = router;
