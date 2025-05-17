/* routes/profesionales.routes.js */
const express = require('express');
const router  = express.Router();

const profesionalesController = require('../controllers/profesionales.controller');
const checkApiKey             = require('../middleware/checkApiKey');

/* ---------- CRUD protegido ---------- */
router.get ('/all',        checkApiKey, profesionalesController.getAllProfesionales);
router.post('/create',     checkApiKey, profesionalesController.createProfesional);
router.put ('/update/:id', checkApiKey, profesionalesController.updateProfesional);
router.delete('/delete/:id', checkApiKey, profesionalesController.deleteProfesional);

/* ---------- Horarios (protegido) ----- */
router.get   ('/:id/horarios',           checkApiKey, profesionalesController.getHorariosByProfesional);
router.post  ('/:id/horarios',           checkApiKey, profesionalesController.createHorario);
router.put   ('/horarios/:id_horario',   checkApiKey, profesionalesController.updateHorario);
router.delete('/horarios/:id_horario',   checkApiKey, profesionalesController.deleteHorario);

/* ---------- RUTA PÚBLICA (sin api‑key) ----- */
router.get('/slim', profesionalesController.getSlimList);   // <-- nombre correcto

module.exports = router;
