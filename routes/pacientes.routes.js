const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientes.controller');
const checkAuthOrApiKey = require('../middleware/checkAuthOrApiKey');

// Crear un nuevo paciente
router.post('/create', checkAuthOrApiKey, pacientesController.createPatient);

// Añadir un historial clínico...
router.post('/:id_paciente/historial', checkAuthOrApiKey, pacientesController.addHistorial);

// Editar un paciente
router.put('/update/:id', checkAuthOrApiKey, pacientesController.updatePatient);

// Editar el historial clínico...
router.put('/:id_paciente/historial', checkAuthOrApiKey, pacientesController.updateHistorial);

// Buscar pacientes (query params)
router.get('/search', checkAuthOrApiKey, pacientesController.searchPatients);

// ──────────────────────────────────────────
// *Primero* la ruta específica "/empresa"
router.get('/empresa', checkAuthOrApiKey, pacientesController.getEmpresaInfo);

// Después la ruta dinámica "/:id"
router.get('/:id', checkAuthOrApiKey, pacientesController.getPatientById);

// Eliminar un paciente
router.delete('/delete/:id', checkAuthOrApiKey, pacientesController.deletePatient);

module.exports = router;
