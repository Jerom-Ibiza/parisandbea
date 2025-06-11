const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');
const checkApiKey = require('../middleware/checkApiKey');

// Crear una nueva cita
router.post('/create', checkApiKey, citasController.createAppointment);

// Actualizar una cita
router.put('/update/:id', checkApiKey, citasController.updateAppointment);

// Eliminar una cita
router.delete('/delete/:id', checkApiKey, citasController.deleteAppointment);

// Buscar citas
router.get('/search', checkApiKey, citasController.searchAppointments);

// Obtener cita por ID (al final para no colisionar con /search)
router.get('/:id', checkApiKey, citasController.getAppointmentById);

module.exports = router;
