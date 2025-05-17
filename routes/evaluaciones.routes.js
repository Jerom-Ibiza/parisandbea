const express = require('express');
const router = express.Router();
const checkApiKey = require('../middleware/checkApiKey');
const evaluacionesController = require('../controllers/evaluaciones.controller');

// -------------------------------------------
// Rutas para EVALUACIONES
// -------------------------------------------
router.get('/evaluaciones', checkApiKey, evaluacionesController.getAllEvaluaciones);
router.get('/evaluaciones/:id', checkApiKey, evaluacionesController.getEvaluacionById);
router.get('/evaluaciones/patient/:id_paciente', checkApiKey, evaluacionesController.getEvaluacionesByPatient);
router.post('/evaluaciones', checkApiKey, evaluacionesController.createEvaluacion);
router.put('/evaluaciones/:id', checkApiKey, evaluacionesController.updateEvaluacion);
router.delete('/evaluaciones/:id', checkApiKey, evaluacionesController.deleteEvaluacion);

// -------------------------------------------
// Rutas para TRATAMIENTOS
// -------------------------------------------
router.get('/tratamientos', checkApiKey, evaluacionesController.getAllTratamientos);
router.get('/tratamientos/:id', checkApiKey, evaluacionesController.getTratamientoById);
router.get('/tratamientos/patient/:id_paciente', checkApiKey, evaluacionesController.getTratamientosByPatient);
router.post('/tratamientos', checkApiKey, evaluacionesController.createTratamiento);
router.put('/tratamientos/:id', checkApiKey, evaluacionesController.updateTratamiento);
router.delete('/tratamientos/:id', checkApiKey, evaluacionesController.deleteTratamiento);

// -------------------------------------------
// Rutas para CONSENTIMIENTOS
// -------------------------------------------
// NUEVA RUTA: consentimiento fusionado
router.post(
  '/consentimientos',
  checkApiKey,
  evaluacionesController.createConsentimientoFusionado
);

module.exports = router;
