const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');
const checkAuthOrApiKey = require('../middleware/checkAuthOrApiKey');

// Crear una nueva cita
router.post('/create', checkAuthOrApiKey, citasController.createAppointment);

// Actualizar una cita
router.put('/update/:id', checkAuthOrApiKey, citasController.updateAppointment);

// Eliminar una cita
router.delete('/delete/:id', checkAuthOrApiKey, citasController.deleteAppointment);

// Buscar citas
router.get('/search', checkAuthOrApiKey, citasController.searchAppointments);

// Obtener cita por ID (al final para no colisionar con /search)
router.get('/:id', checkAuthOrApiKey, citasController.getAppointmentById);

module.exports = router;
