const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientes.controller');
const checkApiKey = require('../middleware/checkApiKey');

// Crear un nuevo paciente
router.post('/create', checkApiKey, pacientesController.createPatient);

// Añadir un historial clínico...
router.post('/:id_paciente/historial', checkApiKey, pacientesController.addHistorial);

// Editar un paciente
router.put('/update/:id', checkApiKey, pacientesController.updatePatient);

// Editar el historial clínico...
router.put('/:id_paciente/historial', checkApiKey, pacientesController.updateHistorial);

// Buscar pacientes (query params)
router.get('/search', checkApiKey, pacientesController.searchPatients);

// ──────────────────────────────────────────
// *Primero* la ruta específica "/empresa"
router.get('/empresa', checkApiKey, pacientesController.getEmpresaInfo);

// Después la ruta dinámica "/:id"
router.get('/:id', checkApiKey, pacientesController.getPatientById);

// Eliminar un paciente
router.delete('/delete/:id', checkApiKey, pacientesController.deletePatient);

module.exports = router;
