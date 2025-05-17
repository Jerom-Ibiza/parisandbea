/* ───────────────────────────
   RUTAS  FICHAJES
   ───────────────────────────*/
const express = require('express');
const router  = express.Router();
const fichajesController = require('../controllers/fichajes.controller');
const checkApiKey = require('../middleware/checkApiKey');

const multer = require('multer');
const path   = require('path');

/* --- subida de foto --- */
const storage = multer.diskStorage({
  destination: path.join(__dirname,'../images/fichajes'),
  filename   : (_req,_file,cb)=>
    cb(null,`fichaje-${Date.now()}.jpg`)
});
const upload = multer({ storage });

/*  POST  /api/fichajes/registrar   (SIN api‑key) */
router.post('/registrar', upload.single('imagen'), fichajesController.registrarFichaje);

/* ---- consultas (protegidas) ---- */
router.get('/consulta',    checkApiKey, fichajesController.getFichajes);
router.get('/incidencias', checkApiKey, fichajesController.getIncidencias);
router.get('/pdf',         checkApiKey, fichajesController.generarPdfFichajes);

/* ---- gestión PDFs (protegida) --- */
router.get   ('/pdf-files',             checkApiKey, fichajesController.listPdfFichajes);
router.put   ('/pdf-files/rename',      checkApiKey, fichajesController.renamePdfFichaje);
router.delete('/pdf-files/:filename',   checkApiKey, fichajesController.deletePdfFichaje);

module.exports = router;

