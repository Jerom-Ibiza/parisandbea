const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const checkApiKey = require('../middleware/checkApiKey');

// ---------------------- SERVICIOS ----------------------
router.post('/create', checkApiKey, serviciosController.createService);

// Rutas para listar servicios (con filtros), se pueden poner aquí
router.get('/', checkApiKey, serviciosController.getServices);

// ---------- SERVICIOS PÚBLICOS (sin API-KEY) ----------
router.get('/public', serviciosController.getPublicServices);
router.get('/public/:slug', serviciosController.getPublicServiceBySlug);
router.get('/public/:slug/profesionales', serviciosController.getPublicProfessionals);

// ---------------------- TIPOS_BONOS ----------------------
// (Importante: definimos estas rutas ANTES de las que llevan :id en la URL)

router.get('/tipos-bonos', checkApiKey, serviciosController.getTiposBonos);
router.post('/tipos-bonos/create', checkApiKey, serviciosController.createTipoBono);
router.get('/tipos-bonos/:id', checkApiKey, serviciosController.getTipoBonoById);
router.put('/tipos-bonos/update/:id', checkApiKey, serviciosController.updateTipoBono);
router.delete('/tipos-bonos/delete/:id', checkApiKey, serviciosController.deleteTipoBono);


router.get('/:id_servicio/bonos', serviciosController.getBonosByService);

// ---------------------- SERVICIO POR ID ----------------------
router.get('/:id', checkApiKey, serviciosController.getServiceById);
router.put('/update/:id', checkApiKey, serviciosController.updateService);
router.delete('/delete/:id', checkApiKey, serviciosController.deleteService);

// ---------------------- SERVICIOS_PROFESIONALES ----------------------
router.post('/:id_servicio/professionals/assign', checkApiKey, serviciosController.assignProfessional);
router.delete('/:id_servicio/professionals/:id_profesional', checkApiKey, serviciosController.removeProfessional);
router.get('/:id_servicio/professionals', checkApiKey, serviciosController.getProfessionalsByService);
router.get('/profesional/:id_profesional', checkApiKey, serviciosController.getServicesByProfessional);

module.exports = router;
