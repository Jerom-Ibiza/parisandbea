const express = require('express');
const router = express.Router();
const loginController = require('../controllers/login.controller');

// POST /api/login -> iniciar sesión
router.post('/', loginController.login);

// GET /api/login/logout -> cerrar sesión
router.get('/logout', loginController.logout);

// PUT /api/login/change-password -> cambiar contraseña
router.put('/change-password', loginController.changePassword);

module.exports = router;
