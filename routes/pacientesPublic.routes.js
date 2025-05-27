const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pacientesPublic.controller');

router.post('/register', ctrl.register);   // POST /api/public/pacientes/register?token=xxx

module.exports = router;
